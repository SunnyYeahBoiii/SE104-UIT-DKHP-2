import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

/** NFR-05: both counters are needed — a bot can rotate IPs or accounts. */
export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_WINDOW_SECONDS = 15 * 60

@Injectable()
export class LoginRateLimiter implements OnModuleDestroy {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/7', {
      maxRetriesPerRequest: 1,
    })
    this.redis.on('error', () => undefined)
  }

  private key(kind: 'account' | 'ip', value: string) {
    return `dkhp:login:${kind}:${value}`
  }

  /** Returns the retry delay in seconds, or 0 when the attempt is allowed. */
  async retryAfter(account: string, ip: string): Promise<number> {
    const accountKey = this.key('account', account)
    const ipKey = this.key('ip', ip)
    const [accountCount, ipCount] = await this.redis.mget(accountKey, ipKey)
    let retryAfter = 0
    if (Number(accountCount ?? 0) >= LOGIN_MAX_ATTEMPTS)
      retryAfter = Math.max(retryAfter, await this.redis.ttl(accountKey))
    if (Number(ipCount ?? 0) >= LOGIN_MAX_ATTEMPTS)
      retryAfter = Math.max(retryAfter, await this.redis.ttl(ipKey))
    return retryAfter
  }

  async recordFailure(account: string, ip: string): Promise<void> {
    const accountKey = this.key('account', account)
    const ipKey = this.key('ip', ip)
    const results = (await this.redis.multi().incr(accountKey).incr(ipKey).exec()) ?? []
    if (results[0]?.[1] === 1) await this.redis.expire(accountKey, LOGIN_WINDOW_SECONDS)
    if (results[1]?.[1] === 1) await this.redis.expire(ipKey, LOGIN_WINDOW_SECONDS)
  }

  async clear(account: string, ip: string): Promise<void> {
    await this.redis.del(this.key('account', account), this.key('ip', ip))
  }

  onModuleDestroy(): void {
    void this.redis.quit()
  }
}
