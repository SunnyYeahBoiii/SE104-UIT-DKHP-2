import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/5'

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'

import { AppModule } from '../src/app.module'
import {
  LedgerDirection,
  LedgerEntryType,
  Role,
  TermPhase,
  TermType,
} from '../src/generated/prisma/client'
import { EmailProcessor, MailerService, OutboxRelay, SEND_JOB } from '../src/payments/email.worker'
import { TUITION_SETTLED, type SettledPayload } from '../src/payments/settled-email'
import { PrismaService } from '../src/prisma/prisma.service'

const PASSWORD = 'Dkhp@2026'
const stamp = Number(String(Date.now()).slice(-8))
const serial = stamp % 10_000_000
const codes = [
  `7${String(serial).padStart(7, '0')}`,
  `7${String((serial + 1) % 10_000_000).padStart(7, '0')}`,
]
const year = 8000 + (stamp % 1000)
const termCode = `${year}1`

type ApiError = { code?: string }
type Payment = {
  receipt: { id: number; number: string; amount: number; amountInWords: string }
  after: { outstandingAmount: number }
  settled: boolean
  creditBalance: number
}

describe('counter payment (integration: Postgres dkhp_w53 + Redis DB 5)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let cookie: string
  let csrf: string
  let collectorId: number
  let redis: Redis
  let academicYearId: number
  let termId: number
  const studentIds: number[] = []
  const userIds: number[] = []
  let sequence = 0
  const runId = randomUUID().slice(0, 8)
  const key = () => `w53-${runId}-${++sequence}`
  const usedKeys: string[] = []
  let underpayKey: string

  const send = (
    path: string,
    body?: unknown,
    options: { csrf?: boolean; key?: string; method?: string } = {},
  ) =>
    fetch(`${baseUrl}${path}`, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers: {
        'content-type': 'application/json',
        cookie,
        ...(options.csrf ? { 'x-csrf-token': csrf } : {}),
        ...(options.key ? { 'idempotency-key': options.key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  const settledEvents = async () =>
    (await prisma.outboxEvent.findMany({ where: { type: TUITION_SETTLED } })).filter(
      (event) => (event.payload as unknown as SettledPayload).termCode === termCode,
    )

  const pay = (studentCode: string, amount: number, idempotencyKey: string, note?: string) => {
    usedKeys.push(idempotencyKey)
    return send(
      '/counter/payments',
      { studentCode, termCode, amount, note },
      { csrf: true, key: idempotencyKey },
    )
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)
    redis = new Redis('redis://localhost:6379/5', { maxRetriesPerRequest: 1 })

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'tv.lan', password: PASSWORD }),
    })
    expect(login.status).toBe(200)
    const cookies = (login.headers.get('set-cookie') ?? '').split(/,\s*/)
    const session = cookies.find((part) => part.startsWith('dkhp_session='))!.split(';')[0]!
    const token = cookies.find((part) => part.startsWith('dkhp_csrf='))!.split(';')[0]!
    cookie = `${session}; ${token}`
    csrf = decodeURIComponent(token.split('=')[1]!)
    collectorId = (await prisma.user.findUniqueOrThrow({ where: { username: 'tv.lan' } })).id

    const academicYear = await prisma.academicYear.create({ data: { startYear: year } })
    academicYearId = academicYear.id
    const term = await prisma.term.create({
      data: {
        academicYearId,
        type: TermType.FIRST,
        termCode,
        phase: TermPhase.CLOSED,
        startDate: new Date('2028-09-07T00:00:00.000Z'),
        registrationStartAt: new Date('2028-08-17T01:00:00.000Z'),
        registrationEndAt: new Date('2028-08-21T10:00:00.000Z'),
        adjustmentStartAt: new Date('2028-09-07T01:00:00.000Z'),
        adjustmentEndAt: new Date('2028-09-18T10:00:00.000Z'),
        tuitionDeadline: new Date('2028-10-31T10:00:00.000Z'),
        finalExamStartAt: new Date('2028-12-21T00:00:00.000Z'),
        minCredits: 0,
        maxCredits: 24,
      },
    })
    termId = term.id

    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })
    const system = await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CQUI' } })
    for (const [index, studentCode] of codes.entries()) {
      const user = await prisma.user.create({
        data: {
          username: `${studentCode}-w53`,
          passwordHash: 'not-used',
          fullName: `Sinh viên thử nghiệm ${index + 1}`,
          email: `w53-${studentCode}@uit.edu.vn`,
          roles: [Role.STUDENT],
          mustChangePassword: false,
        },
      })
      userIds.push(user.id)
      const student = await prisma.student.create({
        data: {
          studentCode,
          userId: user.id,
          fullName: `Sinh viên thử nghiệm ${index + 1}`,
          email: `w53-${studentCode}@uit.edu.vn`,
          cohortId: cohort.id,
          trainingSystemId: system.id,
        },
      })
      studentIds.push(student.id)
      await prisma.ledgerEntry.create({
        data: {
          studentId: student.id,
          termId,
          type: LedgerEntryType.BASE_TUITION,
          direction: LedgerDirection.DEBIT,
          amount: 5_000_000n,
          description: 'Học phí cố định (fixture TT-01)',
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE ledger_entry DISABLE TRIGGER ledger_entry_append_only',
    )
    try {
      await prisma.ledgerEntry.deleteMany({ where: { termId } })
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE ledger_entry ENABLE TRIGGER ledger_entry_append_only',
      )
    }
    await prisma.outboxEvent.deleteMany({
      where: { id: { in: (await settledEvents()).map((event) => event.id) } },
    })
    await prisma.receipt.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.term.delete({ where: { id: termId } }).catch(() => undefined)
    await prisma.academicYear.delete({ where: { id: academicYearId } }).catch(() => undefined)
    for (const name of usedKeys) await redis.del(`dkhp:idem:payment:${collectorId}:${name}`)
    await redis.quit()
    await app.close()
  })

  it('NFR-08: a counter payment needs the CSRF token matching the session', async () => {
    const missing = await send('/counter/payments', {
      studentCode: codes[0],
      termCode,
      amount: 1_000_000,
    })
    expect(missing.status).toBe(403)
    expect(((await missing.json()) as ApiError).code).toBe('CSRF_REQUIRED')
  })

  it('TT-01/TT-06: an underpayment writes one receipt and one credit row in one transaction', async () => {
    underpayKey = key()
    const response = await pay(codes[0]!, 1_000_000, underpayKey, 'Thu đợt 1')
    expect(response.status).toBe(201)
    const payment = (await response.json()) as Payment
    expect(payment.receipt.number).toBe(`PT-${termCode}-00001`)
    expect(payment.receipt.amountInWords).toBe('Một triệu đồng chẵn')
    expect(payment.after.outstandingAmount).toBe(4_000_000)
    expect(payment.settled).toBe(false)

    const receipts = await prisma.receipt.findMany({ where: { studentId: studentIds[0] } })
    const credits = await prisma.ledgerEntry.findMany({
      where: { studentId: studentIds[0], type: LedgerEntryType.PAYMENT },
    })
    expect(receipts).toHaveLength(1)
    expect(credits).toHaveLength(1)
    expect(credits[0]!.receiptId).toBe(receipts[0]!.id)
    expect(credits[0]!.amount).toBe(1_000_000n)
    expect(await settledEvents()).toHaveLength(0)
  })

  it('NFR-04: replaying the same idempotency key does not create a second receipt', async () => {
    const original = await pay(codes[0]!, 1_000_000, underpayKey)
    expect(original.status).toBe(201)
    const first = (await original.json()) as Payment

    const retry = await pay(codes[0]!, 1_000_000, underpayKey)
    expect(retry.status).toBe(201)
    expect((await retry.json()) as Payment).toEqual(first)
    expect(await prisma.receipt.count({ where: { studentId: studentIds[0] } })).toBe(1)
  })

  it('TT-10/QĐ23.1: a full payment writes the settled event into the outbox in the same transaction', async () => {
    const response = await pay(codes[0]!, 4_000_000, key())
    expect(response.status).toBe(201)
    const payment = (await response.json()) as Payment
    expect(payment.receipt.number).toBe(`PT-${termCode}-00002`)
    expect(payment.settled).toBe(true)
    expect(payment.after.outstandingAmount).toBe(0)

    const event = (await settledEvents())[0]!
    expect(event).toBeDefined()
    const payload = event.payload as unknown as SettledPayload
    expect(payload.email).toBe(`w53-${codes[0]}@uit.edu.vn`)
    expect(payload.receiptNumber).toBe(payment.receipt.number)
    expect(payload.paidAmount).toBe(5_000_000)
  })

  it('HP-11/TT-06: an overpayment becomes a credit balance and still settles', async () => {
    const response = await pay(codes[1]!, 5_500_000, key())
    expect(response.status).toBe(201)
    const payment = (await response.json()) as Payment
    expect(payment.after.outstandingAmount).toBe(-500_000)
    expect(payment.creditBalance).toBe(500_000)
    expect(payment.settled).toBe(true)
    expect(
      await prisma.ledgerEntry.count({
        where: { studentId: studentIds[1], type: LedgerEntryType.PAYMENT },
      }),
    ).toBe(1)
  })

  it('HP-13: there is no endpoint to cancel a receipt', async () => {
    const response = await send('/counter/payments/1', undefined, { method: 'DELETE', csrf: true })
    expect(response.status).toBe(404)
  })

  it('TT-10/ADR-0010: the email worker sends the queued event to the profile email', async () => {
    const event = (await settledEvents()).find(
      (row) => (row.payload as unknown as SettledPayload).studentCode === codes[0],
    )!
    expect(event).toBeDefined()
    const sent: { to: string; subject: string }[] = []
    const mailer = {
      send: (to: string, subject: string) => Promise.resolve(sent.push({ to, subject })),
    } as unknown as MailerService
    const relay = new OutboxRelay(prisma, {} as never, mailer)
    const processor = new EmailProcessor(relay)
    expect(await processor.process({ name: SEND_JOB, data: { outboxId: event.id } } as never)).toBe(
      true,
    )
    expect(sent).toHaveLength(1)
    expect(sent[0]!.to).toBe(`w53-${codes[0]}@uit.edu.vn`)
    expect(sent[0]!.subject).toContain('HK')
  })

  it('D.4.2: the shift list carries the collected receipts and their total', async () => {
    const response = await send('/counter/receipts')
    expect(response.status).toBe(200)
    const shift = (await response.json()) as { receipts: Payment['receipt'][]; totalAmount: number }
    const mine = shift.receipts.filter((receipt) => receipt.number.includes(termCode))
    expect(mine.length).toBeGreaterThanOrEqual(3)
    expect(shift.totalAmount).toBeGreaterThanOrEqual(10_500_000)
  })
})
