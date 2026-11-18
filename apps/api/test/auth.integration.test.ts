import 'reflect-metadata'

import { Controller, Get } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { Roles } from '../src/auth/auth.guard'
import { SESSION_COOKIE, SESSION_TTL_SECONDS, SessionStore } from '../src/auth/session.store'
import { Role } from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { DEV_PASSWORD } from '../prisma/seed/scenarios'

@Controller('probe')
class ProbeController {
  @Get('finance')
  @Roles(Role.FINANCE_OFFICE)
  finance() {
    return { ok: true }
  }

  @Get('academic')
  @Roles(Role.ACADEMIC_OFFICE)
  academic() {
    return { ok: true }
  }
}

@Controller('boom')
class BoomController {
  @Get()
  boom() {
    throw new Error('probe failure')
  }
}

type AuthBody = {
  status?: string
  code?: string
  message?: string
  retryAfter?: number
  requestId?: string
  switchableRoles?: Role[]
  user?: { expiresIn: number; mustChangePassword: boolean; activeRole: Role | null }
}

const readJson = async (response: Response): Promise<AuthBody> =>
  (await response.json()) as AuthBody

const DEV_IP = '203.0.113.7'
const NEW_ACCOUNT = '25520010'
const NEW_PASSWORD = 'Moi@12345'

describe('auth (integration: Postgres + Redis)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let redis: Redis
  let baseUrl: string
  let originalHash: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController, BoomController],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)
    redis = new Redis('redis://localhost:6379/7', { maxRetriesPerRequest: 1 })
    redis.on('error', () => undefined)
    originalHash = (await prisma.user.findUniqueOrThrow({ where: { username: NEW_ACCOUNT } }))
      .passwordHash
    // Self-contained: E2E may have changed this account's password in the shared dev database.
    await prisma.user.update({
      where: { username: NEW_ACCOUNT },
      data: {
        passwordHash: await Bun.password.hash(DEV_PASSWORD, { algorithm: 'argon2id' }),
        mustChangePassword: true,
      },
    })
  })

  afterAll(async () => {
    if (originalHash) {
      await prisma.user.update({
        where: { username: NEW_ACCOUNT },
        data: { passwordHash: originalHash, mustChangePassword: true },
      })
    }
    await redis.flushdb()
    await redis.quit()
    await app.close()
  })

  beforeEach(async () => {
    await redis.flushdb()
  })

  const post = (path: string, body: unknown, cookie?: string, ip = DEV_IP) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })

  const get = (path: string, cookie?: string) =>
    fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {} })

  const cookieFrom = (response: Response) =>
    (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

  const login = async (username: string, password = DEV_PASSWORD, ip = DEV_IP) => {
    const response = await post('/auth/login', { username, password }, undefined, ip)
    return { response, cookie: cookieFrom(response), body: await readJson(response) }
  }

  it('NFR-08: argon2id hash, opaque Redis session, Secure/httpOnly/SameSite cookie, absolute 8h', async () => {
    const { response, cookie } = await login('24520001')
    expect(response.status).toBe(200)
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
    const setCookie = response.headers.get('set-cookie') ?? ''
    for (const attribute of [
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      `Max-Age=${SESSION_TTL_SECONDS}`,
    ])
      expect(setCookie).toContain(attribute)

    const stored = await prisma.user.findUniqueOrThrow({ where: { username: '24520001' } })
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true)
    expect(await redis.get(`dkhp:s:${cookie.split('=')[1]}`)).toContain('24520001')
    expect(await redis.ttl(`dkhp:s:${cookie.split('=')[1]}`)).toBeLessThanOrEqual(
      SESSION_TTL_SECONDS,
    )

    const me = await get('/auth/me', cookie)
    const { user } = await readJson(me)
    expect(user?.expiresIn).toBeGreaterThan(SESSION_TTL_SECONDS - 60)
    expect(user?.expiresIn).toBeLessThanOrEqual(SESSION_TTL_SECONDS)
  })

  it('A.6: wrong credentials give one generic message; per-account and per-IP lockout with retry time', async () => {
    const badPassword = await post('/auth/login', { username: '24520001', password: 'Sai@12345' })
    const unknownUser = await post('/auth/login', {
      username: 'khong-ton-tai',
      password: 'Sai@12345',
    })
    expect(badPassword.status).toBe(unknownUser.status)
    const badBody = await readJson(badPassword)
    const unknownBody = await readJson(unknownUser)
    expect(badBody.code).toBe(unknownBody.code)
    expect(badBody.message).toBe(unknownBody.message)

    for (let attempt = 0; attempt < 5; attempt++) {
      await post('/auth/login', { username: '24520002', password: 'Sai@12345' })
    }
    // A different account from the same IP shares the lock: rate limiting is per account *and* IP.
    const locked = await post('/auth/login', { username: '24520003', password: DEV_PASSWORD })
    expect(locked.status).toBe(429)
    const body = await readJson(locked)
    expect(body.code).toBe('LOGIN_LOCKED')
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(body.message).toMatch(/phút/)
  })

  it('NFR-08: must-change-password blocks all routes; changing it revokes other sessions', async () => {
    const first = await login(NEW_ACCOUNT)
    const second = await login(NEW_ACCOUNT)
    expect(first.body.status).toBe('MUST_CHANGE_PASSWORD')

    const status = await get('/auth/me', first.cookie)
    expect(status.status).toBe(200)
    expect((await readJson(status)).user?.mustChangePassword).toBe(true)
    const blockedProbe = await get('/probe/academic', first.cookie)
    expect(blockedProbe.status).toBe(403)

    const weak = await post(
      '/auth/change-password',
      { currentPassword: DEV_PASSWORD, newPassword: '123' },
      first.cookie,
    )
    expect(weak.status).toBe(400)
    expect((await readJson(weak)).code).toBe('WEAK_PASSWORD')

    const changed = await post(
      '/auth/change-password',
      { currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD },
      first.cookie,
    )
    expect(changed.status).toBe(200)
    const stored = await prisma.user.findUniqueOrThrow({ where: { username: NEW_ACCOUNT } })
    expect(stored.mustChangePassword).toBe(false)
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true)

    const revoked = await get('/auth/me', second.cookie)
    expect(revoked.status).toBe(401)
    expect((await readJson(revoked)).code).toBe('SESSION_EXPIRED')
    expect((await get('/auth/me', first.cookie)).status).toBe(200)

    // A later reset must still reach the session kept by the previous change.
    await app.get(SessionStore).deleteAllExcept(stored.id, 'another-session')
    expect((await get('/auth/me', first.cookie)).status).toBe(401)
  })

  it('QV/roles: multi-role account selects a role, switches without re-login, and gets a switch hint on 403', async () => {
    const { cookie, body } = await login('tv.viet')
    expect(body.status).toBe('ROLE_SELECTION')
    expect(body.user?.activeRole).toBeNull()

    const noRole = await get('/probe/academic', cookie)
    expect(noRole.status).toBe(403)
    expect((await readJson(noRole)).switchableRoles).toContain(Role.ACADEMIC_OFFICE)

    const key = `dkhp:s:${cookie.split('=')[1]}`
    const ttlBefore = await redis.ttl(key)
    const switched = await post('/auth/switch-role', { role: Role.ACADEMIC_OFFICE }, cookie)
    expect(switched.status).toBe(200)
    expect((await readJson(switched)).user?.activeRole).toBe(Role.ACADEMIC_OFFICE)
    expect(Math.abs((await redis.ttl(key)) - ttlBefore)).toBeLessThanOrEqual(2)
    expect((await get('/probe/academic', cookie)).status).toBe(200)

    const wrongRole = await get('/probe/finance', cookie)
    expect(wrongRole.status).toBe(403)
    expect((await readJson(wrongRole)).switchableRoles).toContain(Role.FINANCE_OFFICE)

    const singleRole = await login('pdt.hang')
    const forbidden = await get('/probe/finance', singleRole.cookie)
    expect(forbidden.status).toBe(403)
    expect((await readJson(forbidden)).code).toBe('FORBIDDEN')
  })

  it('A.5: session expiry is rejected and a session about to expire reports its remaining time', async () => {
    const { cookie } = await login('24520001')
    const key = `dkhp:s:${cookie.split('=')[1]}`
    const raw = JSON.parse((await redis.get(key)) ?? '{}') as Record<string, unknown>
    await redis.set(
      key,
      JSON.stringify({ ...raw, expiresAt: new Date(Date.now() + 4 * 60_000).toISOString() }),
      'KEEPTTL',
    )
    const me = await get('/auth/me', cookie)
    expect((await readJson(me)).user?.expiresIn).toBeLessThan(300)

    await redis.del(key)
    const expired = await get('/auth/me', cookie)
    expect(expired.status).toBe(401)
    expect((await readJson(expired)).code).toBe('SESSION_EXPIRED')
  })

  it('A.5: 500 responses carry the request id; cross-origin writes are rejected', async () => {
    const { cookie } = await login('24520001')
    const failed = await fetch(`${baseUrl}/boom`, { headers: { cookie } })
    expect(failed.status).toBe(500)
    expect((await readJson(failed)).requestId).toBe(failed.headers.get('x-request-id') ?? undefined)

    const forged = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{}',
    })
    expect(forged.status).toBe(403)
    expect((await readJson(forged)).code).toBe('BAD_ORIGIN')
  })
})
