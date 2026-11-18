import 'reflect-metadata'

// The finance suite owns Redis DB 2; the auth and catalog suites use DB 7 and DB 9.
process.env.REDIS_URL = 'redis://localhost:6379/2'

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'

import { AppModule } from '../src/app.module'
import { ReceivingAccountService } from '../src/finance/receiving-account.service'
import { PrismaService } from '../src/prisma/prisma.service'

const PASSWORD = 'Dkhp@2026'
const THEORY_KEY = 'tuition.theoryCreditRate'
const PRACTICE_KEY = 'tuition.practiceCreditRate'

type ApiError = { code?: string; message?: string }
type Settings = {
  defaults: { theoryCreditRate: number; practiceCreditRate: number }
  feeSchedules: {
    id: number
    cohortId: number
    cohortCode: string
    trainingSystemCode: string
    baseTuition: number
    theoryCreditRate: number
    practiceCreditRate: number
    studentCount: number
  }[]
  missingFeeSchedules: {
    cohortId: number
    cohortCode: string
    trainingSystemCode: string
    studentCount: number
  }[]
  receivingAccount: { gateway: string; accountNumber: string; accountName: string }
  tuitionDeadlines: { id: number; termCode: string; tuitionDeadline: string }[]
  history: { id: number; action: string; actorName: string | null }[]
}

describe('finance settings (integration: Postgres + Redis)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accounts: ReceivingAccountService
  let baseUrl: string
  let cookie: string
  let csrf: string
  let sequence = 0
  const suffix = randomUUID().slice(0, 8)
  const yearBase = 2200 + (parseInt(suffix, 16) % 100_000)
  const cohortIds: number[] = []
  const feeIds: number[] = []
  const originalDefaults: Record<string, unknown> = {}
  let originalAccount: { gateway: string; accountNumber: string; accountName: string }

  const key = () => `${suffix}${++sequence}`

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)
    accounts = app.get(ReceivingAccountService)

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'tv.lan', password: PASSWORD }),
    })
    expect(login.status).toBe(200)
    const cookies = (login.headers.get('set-cookie') ?? '').split(/,\s*/)
    const sessionCookie = cookies.find((part) => part.startsWith('dkhp_session='))!.split(';')[0]!
    const csrfCookie = cookies.find((part) => part.startsWith('dkhp_csrf='))!.split(';')[0]!
    cookie = `${sessionCookie}; ${csrfCookie}`
    csrf = decodeURIComponent(csrfCookie.split('=')[1]!)
    expect(csrf.length).toBeGreaterThan(0)

    for (const parameter of await prisma.systemParameter.findMany({
      where: { key: { in: [THEORY_KEY, PRACTICE_KEY] } },
    }))
      originalDefaults[parameter.key] = parameter.value
    originalAccount = await accounts.current()
  })

  afterAll(async () => {
    for (const [keyName, value] of Object.entries(originalDefaults)) {
      await prisma.systemParameter.update({
        where: { key: keyName },
        data: { value: value as never },
      })
    }
    await prisma.systemParameter.update({
      where: { key: 'payment.bankAccount' },
      data: { value: originalAccount as never },
    })
    if (feeIds.length) await prisma.feeSchedule.deleteMany({ where: { id: { in: feeIds } } })
    if (cohortIds.length) await prisma.cohort.deleteMany({ where: { id: { in: cohortIds } } })
    await app.close()
  })

  const send = (
    method: string,
    path: string,
    body?: unknown,
    options: { withCsrf?: boolean } = {},
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        cookie,
        ...(options.withCsrf ? { 'x-csrf-token': csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const settings = async (): Promise<Settings> => {
    const response = await send('GET', '/finance/settings')
    expect(response.status).toBe(200)
    return (await response.json()) as Settings
  }

  const makeCohort = async () => {
    const cohort = await prisma.cohort.create({
      data: { code: `W50C${key()}`, admissionYear: yearBase + sequence },
    })
    cohortIds.push(cohort.id)
    return cohort
  }

  const system = async (code: string) =>
    prisma.trainingSystem.findUniqueOrThrow({ where: { code } })

  const createSchedule = async (
    cohortId: number,
    trainingSystemId: number,
    baseTuition: number,
    theoryCreditRate: number,
    practiceCreditRate: number,
  ) => {
    const response = await send(
      'POST',
      '/finance/fee-schedules',
      {
        cohortId,
        trainingSystemId,
        baseTuition,
        theoryCreditRate,
        practiceCreditRate,
      },
      { withCsrf: true },
    )
    if (response.status === 201) {
      const row = ((await response.json()) as Settings['feeSchedules'][number]).id
      feeIds.push(row)
    }
    return response
  }

  it('NFR-08/HP-01: finance mutations require a CSRF token matching the session cookie', async () => {
    const body = { theoryCreditRate: 27_000, practiceCreditRate: 37_000 }
    const missing = await send('PATCH', '/finance/settings/credit-rates', body)
    expect(missing.status).toBe(403)
    expect(((await missing.json()) as ApiError).code).toBe('CSRF_REQUIRED')

    const wrong = await fetch(`${baseUrl}/finance/settings/credit-rates`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie,
        'x-csrf-token': 'not-the-cookie-token',
      },
      body: JSON.stringify(body),
    })
    expect(wrong.status).toBe(403)
    expect(((await wrong.json()) as ApiError).code).toBe('CSRF_REQUIRED')

    const ok = await send('PATCH', '/finance/settings/credit-rates', body, { withCsrf: true })
    expect(ok.status).toBe(200)
  })

  it('HP-01: a duplicate (cohort, training system) pair is rejected by the database constraint', async () => {
    const cohort = await makeCohort()
    const cqui = await system('CQUI')
    const created = await createSchedule(cohort.id, cqui.id, 15_000_000, 27_000, 37_000)
    expect(created.status).toBe(201)

    const duplicate = await createSchedule(cohort.id, cqui.id, 16_000_000, 27_000, 37_000)
    expect(duplicate.status).toBe(409)
    expect(((await duplicate.json()) as ApiError).code).toBe('FEE_SCHEDULE_EXISTS')

    const fraction = await createSchedule(cohort.id, cqui.id, 15_000_000.5, 27_000, 37_000)
    expect(fraction.status).toBe(400)
    expect(((await fraction.json()) as ApiError).code).toBe('INVALID_MONEY')
  })

  it('HP-01/HP-04: default rates prefill only new schedules; edits never rewrite posted amounts', async () => {
    const original = await settings()
    const oldRates = original.defaults
    const first = await makeCohort()
    const second = await makeCohort()
    const cqui = await system('CQUI')
    expect((await createSchedule(first.id, cqui.id, 15_000_000, 27_000, 37_000)).status).toBe(201)

    const posted = await prisma.ledgerEntry.findFirstOrThrow({
      where: { type: 'BASE_TUITION', student: { cohort: { code: 'K19' } } },
    })
    const frozen = await prisma.enrollment.findFirstOrThrow({ where: { creditRate: { gt: 0n } } })

    const updated = await send(
      'PATCH',
      '/finance/settings/credit-rates',
      { theoryCreditRate: 30_000, practiceCreditRate: 40_000 },
      { withCsrf: true },
    )
    expect(updated.status).toBe(200)

    try {
      const afterDefaults = await settings()
      expect(afterDefaults.defaults).toEqual({
        theoryCreditRate: 30_000,
        practiceCreditRate: 40_000,
      })
      const existing = afterDefaults.feeSchedules.find((row) => row.cohortId === first.id)!
      expect(existing.theoryCreditRate).toBe(27_000)
      expect(existing.practiceCreditRate).toBe(37_000)

      const prefill = await createSchedule(
        second.id,
        cqui.id,
        15_500_000,
        afterDefaults.defaults.theoryCreditRate,
        afterDefaults.defaults.practiceCreditRate,
      )
      expect(prefill.status).toBe(201)
      const fresh = (await settings()).feeSchedules.find((row) => row.cohortId === second.id)!
      expect(fresh.theoryCreditRate).toBe(30_000)
      expect(fresh.practiceCreditRate).toBe(40_000)

      const edit = await send(
        'PATCH',
        `/finance/fee-schedules/${existing.id}`,
        {
          cohortId: first.id,
          trainingSystemId: cqui.id,
          baseTuition: 99_999_999,
          theoryCreditRate: 1,
          practiceCreditRate: 1,
        },
        { withCsrf: true },
      )
      expect(edit.status).toBe(200)

      expect(
        (await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: posted.id } })).amount,
      ).toBe(posted.amount)
      expect(
        (await prisma.enrollment.findUniqueOrThrow({ where: { id: frozen.id } })).creditRate,
      ).toBe(frozen.creditRate)
    } finally {
      const restore = await send('PATCH', '/finance/settings/credit-rates', oldRates, {
        withCsrf: true,
      })
      expect(restore.status).toBe(200)
    }
  })

  it('HP-01: (cohort, system) pairs with students but no schedule are reported as warnings', async () => {
    const result = await settings()
    const warning = result.missingFeeSchedules.find(
      (row) => row.cohortCode === 'K20' && row.trainingSystemCode === 'CLC',
    )
    expect(warning?.studentCount).toBeGreaterThan(0)
    expect(
      result.feeSchedules.some(
        (row) => row.cohortCode === 'K19' && row.trainingSystemCode === 'CQUI',
      ),
    ).toBe(true)
    expect(
      result.feeSchedules.some(
        (row) => row.cohortCode === 'K20' && row.trainingSystemCode === 'CLC',
      ),
    ).toBe(false)
  })

  it('TT-03/TT-04: the receiving account change is immediately visible to QR and webhook checks', async () => {
    const before = (await settings()).receivingAccount
    const changed = {
      gateway: ' Vietcombank ',
      accountNumber: '1234567890',
      accountName: 'truong dai hoc cong nghe',
    }
    const response = await send('PATCH', '/finance/receiving-account', changed, { withCsrf: true })
    expect(response.status).toBe(200)

    try {
      expect((await settings()).receivingAccount.accountNumber).toBe('1234567890')
      const live = await accounts.current()
      expect(live.accountNumber).toBe('1234567890')
      expect(live.gateway).toBe('Vietcombank')
      expect(await accounts.accepts('1234567890')).toBe(true)
      expect(await accounts.accepts(before.accountNumber)).toBe(false)

      const badAccount = await send(
        'PATCH',
        '/finance/receiving-account',
        { ...changed, accountNumber: '12a456' },
        { withCsrf: true },
      )
      expect(badAccount.status).toBe(400)
      expect(((await badAccount.json()) as ApiError).code).toBe('INVALID_BANK_ACCOUNT')
    } finally {
      const restored = await send('PATCH', '/finance/receiving-account', before, { withCsrf: true })
      expect(restored.status).toBe(200)
    }
  })

  it('NFR-08/HP-08: change history comes from the audit log and deadlines stay read-only', async () => {
    const result = await settings()
    for (const action of [
      'DEFAULT_CREDIT_RATE_UPDATE',
      'FEE_SCHEDULE_CREATE',
      'FEE_SCHEDULE_UPDATE',
      'RECEIVING_ACCOUNT_UPDATE',
    ])
      expect(result.history.some((item) => item.action === action)).toBe(true)
    expect(result.history.some((item) => item.actorName === 'Ngô Thị Lan')).toBe(true)

    const deadline = result.tuitionDeadlines.find((item) => item.termCode === '20262')
    expect(deadline).toBeDefined()
    expect(Date.parse(deadline!.tuitionDeadline)).toBeGreaterThan(0)
    const denied = await send(
      'PATCH',
      '/finance/tuition-deadlines/20262',
      { tuitionDeadline: '2027-01-01' },
      {
        withCsrf: true,
      },
    )
    expect(denied.status).toBe(404)
  })

  it('QV-01: a student session cannot reach finance settings', async () => {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: '24520001', password: PASSWORD }),
    })
    const studentCookie = (login.headers.get('set-cookie') ?? '').split(/,\s*/)[0]!.split(';')[0]!
    const denied = await fetch(`${baseUrl}/finance/settings`, {
      headers: { cookie: studentCookie },
    })
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as ApiError).code).toBe('FORBIDDEN')
  })
})
