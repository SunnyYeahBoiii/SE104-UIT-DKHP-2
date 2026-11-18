import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

/** ADR-0005/NFR-04/NFR-05: 24-hour idempotency and a per-student write budget, both in Redis DB 14. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
export const RATE_WINDOW_SECONDS = 60
export const REGISTRATION_RATE_MAX = 20

type Stored<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; response: Record<string, unknown> }
  | { pending: true }

function isPending<T>(stored: Stored<T>): stored is { pending: true } {
  return 'pending' in stored
}

function errorResponse(error: unknown): { status: number; response: Record<string, unknown> } {
  if (error instanceof HttpException) {
    const body = error.getResponse()
    return {
      status: error.getStatus(),
      response:
        typeof body === 'string'
          ? { code: 'HTTP_ERROR', message: body }
          : (body as Record<string, unknown>),
    }
  }
  return {
    status: 500,
    response: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi. Vui lòng thử lại.' },
  }
}

@Injectable()
export class RegistrationIdempotency implements OnModuleDestroy {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REGISTRATION_REDIS_URL ?? 'redis://localhost:6379/14', {
      maxRetriesPerRequest: 1,
    })
    this.redis.on('error', () => undefined)
  }

  private key(scope: string, userId: number, key: string): string {
    return `dkhp:idem:${scope}:${userId}:${key}`
  }

  /** Replaying a key returns the original result, including the original error. */
  async run<T>(
    scope: 'register' | 'cancel' | 'payment',
    userId: number,
    key: string,
    work: () => Promise<T>,
  ): Promise<T> {
    if (!key || key.length > 200)
      throw new HttpException(
        { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Thiếu khoá chống lặp cho thao tác ghi.' },
        400,
      )

    const name = this.key(scope, userId, key)
    const cached = await this.redis.get(name)
    if (cached) return this.replay<T>(JSON.parse(cached) as Stored<T>)

    const claimed = await this.redis.set(
      name,
      JSON.stringify({ pending: true } satisfies Stored<never>),
      'EX',
      30,
      'NX',
    )
    if (claimed !== 'OK') {
      // A concurrent request owns the key; wait for its result instead of writing twice.
      for (let attempt = 0; attempt < 100; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        const value = await this.redis.get(name)
        if (value) {
          const stored = JSON.parse(value) as Stored<T>
          if (!isPending(stored)) return this.replay(stored)
        }
      }
      throw new HttpException(
        { code: 'REQUEST_IN_PROGRESS', message: 'Thao tác trước đang xử lý. Vui lòng thử lại.' },
        409,
      )
    }

    try {
      const value = await work()
      await this.redis.set(
        name,
        JSON.stringify({ ok: true, value } satisfies Stored<T>),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
      )
      return value
    } catch (error) {
      const failure = errorResponse(error)
      await this.redis.set(
        name,
        JSON.stringify({ ok: false, ...failure } satisfies Stored<T>),
        'EX',
        IDEMPOTENCY_TTL_SECONDS,
      )
      throw error
    }
  }

  /** NFR-05: a fixed window per student; counted only on real work, never on idempotent replays. */
  async checkRate(userId: number): Promise<void> {
    const name = `dkhp:rate:registration:${userId}`
    const count = await this.redis.incr(name)
    if (count === 1) await this.redis.expire(name, RATE_WINDOW_SECONDS)
    if (count > REGISTRATION_RATE_MAX) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Bạn gửi quá nhanh. Vui lòng chờ một lát rồi thử lại.',
          retryAfter: await this.redis.ttl(name),
        },
        429,
      )
    }
  }

  private replay<T>(stored: Stored<T>): T {
    if (isPending(stored))
      throw new HttpException(
        { code: 'REQUEST_IN_PROGRESS', message: 'Thao tác trước đang xử lý.' },
        409,
      )
    if (!stored.ok) throw new HttpException(stored.response, stored.status)
    return stored.value
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit()
  }
}
