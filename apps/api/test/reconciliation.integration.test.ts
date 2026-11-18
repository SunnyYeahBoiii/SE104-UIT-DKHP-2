import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/8'

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Queue } from 'bullmq'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { BANK_ACCOUNT_KEY } from '../src/finance/receiving-account.service'
import {
  BankTransactionStatus,
  LedgerDirection,
  LedgerEntryType,
  ReconciliationDiscrepancyType,
  Role,
  TermPhase,
  TermType,
} from '../src/generated/prisma/client'
import { EmailModule, MailerService, OutboxRelay } from '../src/payments/email.worker'
import { ReconciliationService } from '../src/payments/reconciliation.service'
import { ReconciliationProcessor } from '../src/payments/reconciliation.worker'
import { SEPAY_QUEUE, SepayService, sepayQueueConnection } from '../src/payments/sepay.service'
import { SepayProcessor } from '../src/payments/sepay.worker'
import { SEPAY_API_KEY } from '../src/payments/sepay.validation'
import { PrismaService } from '../src/prisma/prisma.service'

const stamp = Number(String(Date.now()).slice(-8))
const year = 9100 + (stamp % 1000)
const termCode = `${year}2`
const serial = stamp % 1_000_000
const codes = [
  `8${String(serial).padStart(7, '0')}`,
  `8${String((serial + 1) % 10_000_000).padStart(7, '0')}`,
]
const bankTime = (day: string) => `${day} 09:15:00`
const missedDay = '2027-02-10'
const mismatchDay = '2027-02-11'
const missedAt = new Date('2027-02-10T03:00:00.000Z')
const mismatchAt = new Date('2027-02-11T03:00:00.000Z')
const id = () => 88_000_000 + Math.floor(Math.random() * 1_000_000)
const PASSWORD = 'Dkhp@2026'

type ApiError = { code?: string }
type Run = {
  id: number
  bankCount: number
  systemCount: number
  backfilledCount: number
  residualCount: number
  status: string
  statusLabel: string
  backfilled: {
    receiptNumber: string | null
    studentCode: string | null
    transactionId: number
  }[]
  discrepancies: { type: ReconciliationDiscrepancyType; bankAmount: number | null }[]
}

describe('daily reconciliation (integration: Postgres dkhp_w56 + fake SePay API)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let reconciliation: ReconciliationService
  let sepay: SepayService
  let relay: OutboxRelay
  let baseUrl: string
  let accountNumber: string
  let server: ReturnType<typeof Bun.serve>
  let queue: Queue
  let apiRows: unknown[] = []
  let lastAuthorization: string | null = null
  let lastQuery = ''
  const sent: { to: string; subject: string }[] = []
  const studentIds: number[] = []
  const userIds: number[] = []
  const transactionIds: number[] = []
  let termId: number
  let academicYearId: number
  const runIds: number[] = []

  const paymentCode = (studentCode: string) => `HP${studentCode}${termCode}`
  const providerRow = (sepayId: number, code: string | null, amount: number, day: string) => ({
    id: sepayId,
    gateway: 'MBBank',
    transactionDate: bankTime(day),
    accountNumber,
    code,
    content: `${code ?? 'chuyen tien'} nop hoc phi`,
    referenceCode: `FT${sepayId}`,
    transferType: 'in',
    transferAmount: amount,
  })
  const login = async (username: string) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: PASSWORD }),
    })
    if (response.status !== 200) throw new Error(`login ${username}: ${await response.text()}`)
    return (response.headers.get('set-cookie') ?? '')
      .split(/,\s*/)
      .find((part) => part.startsWith('dkhp_session='))!
      .split(';')[0]!
  }

  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        lastAuthorization = request.headers.get('authorization')
        lastQuery = url.search
        return Response.json({ transactions: apiRows })
      },
    })
    process.env.SEPAY_API_BASE_URL = `http://127.0.0.1:${server.port}`

    const moduleRef = await Test.createTestingModule({ imports: [AppModule, EmailModule] })
      .overrideProvider(SepayProcessor)
      .useValue({})
      .overrideProvider(ReconciliationProcessor)
      .useValue({})
      .overrideProvider(MailerService)
      .useValue({
        send: (to: string, subject: string) => Promise.resolve(sent.push({ to, subject })),
      })
      .compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)
    sepay = app.get(SepayService)
    reconciliation = app.get(ReconciliationService)
    relay = app.get(OutboxRelay)
    queue = new Queue(SEPAY_QUEUE, { connection: sepayQueueConnection() })

    const account = await prisma.systemParameter.findUniqueOrThrow({
      where: { key: BANK_ACCOUNT_KEY },
    })
    accountNumber = (account.value as { accountNumber: string }).accountNumber

    const academicYear = await prisma.academicYear.create({ data: { startYear: year } })
    academicYearId = academicYear.id
    const term = await prisma.term.create({
      data: {
        academicYearId,
        type: TermType.SECOND,
        termCode,
        phase: TermPhase.CLOSED,
        startDate: new Date('2028-01-05T00:00:00.000Z'),
        registrationStartAt: new Date('2027-12-15T01:00:00.000Z'),
        registrationEndAt: new Date('2027-12-19T10:00:00.000Z'),
        adjustmentStartAt: new Date('2028-01-05T01:00:00.000Z'),
        adjustmentEndAt: new Date('2028-01-16T10:00:00.000Z'),
        tuitionDeadline: new Date('2028-02-28T10:00:00.000Z'),
        finalExamStartAt: new Date('2028-05-21T00:00:00.000Z'),
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
          username: `${studentCode}-w56`,
          passwordHash: 'not-used',
          fullName: `Sinh viên đối soát ${index + 1}`,
          email: `w56-${studentCode}@uit.edu.vn`,
          roles: [Role.STUDENT],
          mustChangePassword: false,
        },
      })
      userIds.push(user.id)
      const student = await prisma.student.create({
        data: {
          studentCode,
          userId: user.id,
          fullName: `Sinh viên đối soát ${index + 1}`,
          email: `w56-${studentCode}@uit.edu.vn`,
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
          description: 'Học phí cố định (fixture đối soát)',
        },
      })
    }
  })

  afterAll(async () => {
    if (!prisma) {
      await server?.stop(true)
      return
    }
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
      where: {
        type: 'TUITION_SETTLED',
        payload: { path: ['termCode'], equals: termCode },
      },
    })
    await prisma.receipt.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.reconciliationRun.deleteMany({ where: { id: { in: runIds } } })
    await prisma.bankTransaction.deleteMany({ where: { id: { in: transactionIds } } })
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.term.delete({ where: { id: termId } }).catch(() => undefined)
    await prisma.academicYear.delete({ where: { id: academicYearId } }).catch(() => undefined)
    await queue.close()
    await server.stop(true)
    await app.close()
  })

  it('QĐ21.1/TT-08: a transfer missing from the webhook is backfilled through the same job and settles with email', async () => {
    const sepayId = id()
    apiRows = [providerRow(sepayId, paymentCode(codes[0]!), 5_000_000, missedDay)]

    const run = (await reconciliation.reconcile(missedAt)) as Run
    runIds.push(run.id)
    expect(run).toMatchObject({
      bankCount: 1,
      systemCount: 0,
      backfilledCount: 1,
      residualCount: 0,
      status: 'MATCHED',
    })
    expect(lastAuthorization).toBe(`Apikey ${SEPAY_API_KEY}`)
    expect(lastQuery).toContain('startDate=2027-02-10+00%3A00%3A00')
    expect(lastQuery).toContain('endDate=2027-02-11+00%3A00%3A00')

    const stored = await prisma.bankTransaction.findUniqueOrThrow({
      where: { sepayId: BigInt(sepayId) },
    })
    transactionIds.push(stored.id)
    expect(stored.status).toBe('PENDING')
    expect(stored.reconciliationRunId).toBe(run.id)
    const job = await queue.getJob(`sepay-${sepayId}`)
    expect(job?.data).toEqual({ transactionId: stored.id })

    expect(await sepay.process(stored.id)).toBe('matched')
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { bankTransactionId: stored.id },
    })
    expect(receipt.amount).toBe(5_000_000n)
    expect(receipt.studentId).toBe(studentIds[0]!)

    const events = await prisma.outboxEvent.findMany({
      where: { type: 'TUITION_SETTLED' },
    })
    const event = events.find(
      (row) => (row.payload as { studentCode?: string }).studentCode === codes[0],
    )
    expect(event).toBeDefined()
    expect(await relay.send(event!.id)).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.to).toBe(`w56-${codes[0]}@uit.edu.vn`)
    expect(sent[0]!.subject).toContain('đóng đủ')
  })

  it('TT-05: a webhook arriving late for the backfilled row does not create a second receipt', async () => {
    const stored = await prisma.bankTransaction.findFirstOrThrow({
      where: { reconciliationRunId: { in: runIds } },
    })
    const response = await fetch(`${baseUrl}/webhooks/sepay`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Apikey ${SEPAY_API_KEY}`,
      },
      body: JSON.stringify(stored.rawPayload),
    })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { duplicate: boolean }).duplicate).toBe(true)
    expect(await sepay.process(stored.id)).toBe('skipped')
    expect(await prisma.receipt.count({ where: { bankTransactionId: stored.id } })).toBe(1)
    expect(await prisma.bankTransaction.count({ where: { sepayId: stored.sepayId } })).toBe(1)
  })

  it('QĐ21.2: amount mismatches and rows absent from the bank are stored as read-only discrepancies', async () => {
    const mismatchedId = id()
    const missingId = id()
    const stored = await prisma.bankTransaction.create({
      data: {
        sepayId: BigInt(mismatchedId),
        gateway: 'MBBank',
        accountNumber,
        transactionDate: new Date('2027-02-11T02:15:00.000Z'),
        code: paymentCode(codes[1]!),
        content: 'nop hoc phi',
        amount: 5_000_000n,
        status: BankTransactionStatus.PENDING,
        rawPayload: {},
      },
    })
    const absent = await prisma.bankTransaction.create({
      data: {
        sepayId: BigInt(missingId),
        gateway: 'MBBank',
        accountNumber,
        transactionDate: new Date('2027-02-11T03:15:00.000Z'),
        code: paymentCode(codes[1]!),
        content: 'nop hoc phi',
        amount: 2_000_000n,
        status: BankTransactionStatus.PENDING,
        rawPayload: {},
      },
    })
    transactionIds.push(stored.id, absent.id)
    apiRows = [providerRow(mismatchedId, null, 5_500_000, mismatchDay)]

    const run = (await reconciliation.reconcile(mismatchAt)) as Run
    runIds.push(run.id)
    expect(run).toMatchObject({
      bankCount: 1,
      systemCount: 2,
      backfilledCount: 0,
      residualCount: 2,
      status: 'HAS_DIFFERENCES',
    })
    expect(run.discrepancies.map((row) => row.type).sort()).toEqual([
      ReconciliationDiscrepancyType.AMOUNT_MISMATCH,
      ReconciliationDiscrepancyType.MISSING_AT_BANK,
    ])
    expect(
      run.discrepancies.find((row) => row.type === ReconciliationDiscrepancyType.AMOUNT_MISMATCH)
        ?.bankAmount,
    ).toBe(5_500_000)
  })

  it('TT-08: running the same day again returns the stored run and backfills nothing new', async () => {
    const extraId = id()
    apiRows = [providerRow(extraId, paymentCode(codes[1]!), 5_000_000, mismatchDay), ...apiRows]
    const before = await prisma.reconciliationRun.findUniqueOrThrow({
      where: { date: new Date('2027-02-11T00:00:00.000Z') },
    })
    const run = (await reconciliation.reconcile(mismatchAt)) as Run
    expect(run.id).toBe(before.id)
    expect(run.bankCount).toBe(1)
    expect(run.backfilledCount).toBe(0)
    expect(await prisma.reconciliationRun.count({ where: { date: before.date } })).toBe(1)
    expect(await prisma.bankTransaction.count({ where: { sepayId: BigInt(extraId) } })).toBe(0)
  })

  it('TT-08: the finance office reads list and detail, and students cannot', async () => {
    const cookie = await login('tv.lan')
    const list = await fetch(`${baseUrl}/finance/reconciliation`, { headers: { cookie } })
    expect(list.status).toBe(200)
    const body = (await list.json()) as { items: Run[]; count: number }
    expect(body.count).toBeGreaterThanOrEqual(3)
    expect(body.items.some((row) => row.id === runIds[0])).toBe(true)
    expect(body.items.find((row) => row.id === runIds[0])?.statusLabel).toBe('Khớp')

    const detail = await fetch(`${baseUrl}/finance/reconciliation/${runIds[0]}`, {
      headers: { cookie },
    })
    expect(detail.status).toBe(200)
    const founded = (await detail.json()) as Run
    expect(founded.backfilled).toHaveLength(1)
    expect(founded.backfilled[0]!.receiptNumber).toMatch(/^PT-/)
    expect(founded.backfilled[0]!.studentCode).toBe(codes[0]!)
    expect(founded.discrepancies).toHaveLength(0)

    const studentCookie = await login('24520001')
    const denied = await fetch(`${baseUrl}/finance/reconciliation`, {
      headers: { cookie: studentCookie },
    })
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as ApiError).code).toBeDefined()
  })
})
