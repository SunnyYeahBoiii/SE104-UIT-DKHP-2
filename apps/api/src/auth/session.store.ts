import { randomBytes } from 'node:crypto'

import { Injectable, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

import type { Role } from '../generated/prisma/enums'

/** NFR-08 / ADR-0013: absolute lifetime, no idle extension. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60
export const SESSION_COOKIE = 'dkhp_session'

export type Session = {
  id: string
  userId: number
  username: string
  fullName: string
  roles: Role[]
  activeRole: Role | null
  mustChangePassword: boolean
  expiresAt: string
}

export type SessionInput = Omit<Session, 'id' | 'expiresAt'>

@Injectable()
export class SessionStore implements OnModuleDestroy {
  private readonly redis: Redis

  constructor() {
    // Database index 7 of the dev Redis service is reserved for auth (compose.dev.yml).
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379/7', {
      maxRetriesPerRequest: 1,
    })
    // A dead Redis must surface as 500s, not crash the process with an unhandled error event.
    this.redis.on('error', () => undefined)
  }

  private key(id: string) {
    return `dkhp:s:${id}`
  }

  private indexKey(userId: number) {
    return `dkhp:u:${userId}`
  }

  async create(input: SessionInput): Promise<Session> {
    const session: Session = {
      ...input,
      id: randomBytes(32).toString('base64url'),
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    }
    await this.redis
      .multi()
      .set(this.key(session.id), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS)
      .sadd(this.indexKey(session.userId), session.id)
      .expire(this.indexKey(session.userId), SESSION_TTL_SECONDS)
      .exec()
    return session
  }

  async get(id: string): Promise<Session | null> {
    const value = await this.redis.get(this.key(id))
    return value ? (JSON.parse(value) as Session) : null
  }

  /** KEEPTTL keeps the absolute 8-hour deadline when a user switches role. */
  async update(id: string, patch: Partial<SessionInput>): Promise<Session | null> {
    const session = await this.get(id)
    if (!session) return null
    const updated = { ...session, ...patch }
    await this.redis.set(this.key(id), JSON.stringify(updated), 'KEEPTTL')
    return updated
  }

  async delete(id: string): Promise<void> {
    const session = await this.get(id)
    await this.redis
      .multi()
      .del(this.key(id))
      .srem(this.indexKey(session?.userId ?? 0), id)
      .exec()
  }

  /** Registrar password reset and profile deletion revoke every device at once (ADR-0013). */
  async deleteAll(userId: number): Promise<void> {
    await this.deleteAllExcept(userId, '')
  }

  /** Changing/resetting a password revokes every other session at once (ADR-0013). */
  async deleteAllExcept(userId: number, keepId: string): Promise<void> {
    const ids = (await this.redis.smembers(this.indexKey(userId))).filter((id) => id !== keepId)
    if (ids.length === 0) return
    const multi = this.redis.multi()
    for (const id of ids) {
      multi.del(this.key(id))
      multi.srem(this.indexKey(userId), id)
    }
    await multi.exec()
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit()
  }
}
