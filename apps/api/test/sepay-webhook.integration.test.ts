import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/5'

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { BANK_ACCOUNT_KEY } from '../src/finance/receiving-account.service'
import {
  LedgerDirection,
  LedgerEntryType,
  Role,
  TermPhase,
  TermType,
} from '../src/generated/prisma/client'
import { SepayService } from '../src/payments/sepay.service'
import { SepayProcessor } from '../src/payments/sepay.worker'
import { SEPAY_API_KEY } from '../src/payments/sepay.validation'
import { PrismaService } from '../src/prisma/prisma.service'

const stamp = Number(String(Date.now()).slice(-8))
const year = 9000 + (stamp % 1000)
const termCode = `${year}2`
const serial = stamp % 1_000_000
const codes = [
  `8${String(serial).padStart(7, '0')}`,
  `8${String((serial + 1) % 10_000_000).padStart(7, '0')}`,
  `8${String((serial + 2) % 10_000_000).padStart(7, '0')}`,
]
const sepayId = () => 77_000_000 + Math.floor(Math.random() * 1_000_000)
const bankTime = '2027-01-06 09:15:00'
const bankDate = new Date('2027-01-06T02:15:00.000Z')

type ApiError = { code?: string }
type PaymentResult = 'matched' | 'unmatched' | 'skipped'

describe('SePay webhook (integration: Postgres dkhp_w54 + Redis DB 5)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let sepay: SepayService
  let baseUrl: string
  let accountNumber: string
  let termId: number
  let academicYearId: number
  const studentIds: number[] = []
  const userIds: number[] = []
  const transactionIds: number[] = []

  const paymentCode = (studentCode: string) => `HP${studentCode}${termCode}`
  const webhook = (
    id: number,
    code: string | null,
    amount: number,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    gateway: 'MBBank',
    transactionDate: bankTime,
    accountNumber,
    code,
    content: `${code ?? 'chuyen tien'} nop hoc phi`,
    referenceCode: `FT${id}`,
    transferType: 'in',
    transferAmount: amount,
    ...overrides,
  })

  const send = (body: unknown, key: string = SEPAY_API_KEY) =>
    fetch(`${baseUrl}/webhooks/sepay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Apikey ${key}` },
      body: JSON.stringify(body),
    })

  const settledEvents = async () =>
    (await prisma.outboxEvent.findMany({ where: { type: 'TUITION_SETTLED' } })).filter(
      (event) => (event.payload as { termCode?: string }).termCode === termCode,
    )

  const outstanding = async (studentId: number) => {
    const rows = await prisma.ledgerEntry.findMany({ where: { studentId, termId } })
    return rows.reduce(
      (sum, row) =>
        sum + (row.direction === LedgerDirection.DEBIT ? Number(row.amount) : -Number(row.amount)),
      0,
    )
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SepayProcessor)
      .useValue({})
      .compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)
    sepay = app.get(SepayService)

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
          username: `${studentCode}-w54`,
          passwordHash: 'not-used',
          fullName: `Sinh viên thử nghiệm ${index + 1}`,
          email: `w54-${studentCode}@uit.edu.vn`,
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
          email: `w54-${studentCode}@uit.edu.vn`,
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
          description: 'Học phí cố định (fixture TT-06)',
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
    await prisma.bankTransaction.deleteMany({
      where: { id: { in: transactionIds.filter((id): id is number => typeof id === 'number') } },
    })
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.term.delete({ where: { id: termId } }).catch(() => undefined)
    await prisma.academicYear.delete({ where: { id: academicYearId } }).catch(() => undefined)
    await app.close()
  })

  it('TT-04: a webhook with the wrong API key is rejected and stores nothing', async () => {
    const id = sepayId()
    const response = await send(webhook(id, paymentCode(codes[0]!), 1_000_000), 'wrong-key')
    expect(response.status).toBe(401)
    expect(((await response.json()) as ApiError).code).toBe('INVALID_API_KEY')
    expect(await prisma.bankTransaction.count({ where: { sepayId: BigInt(id) } })).toBe(0)
  })

  it('TT-04: outgoing transfers and transfers to another account are rejected', async () => {
    const outgoing = await send(
      webhook(sepayId(), paymentCode(codes[0]!), 1_000_000, { transferType: 'out' }),
    )
    expect(outgoing.status).toBe(400)
    expect(((await outgoing.json()) as ApiError).code).toBe('INVALID_TRANSFER_TYPE')
    const otherAccount = await send(
      webhook(sepayId(), paymentCode(codes[0]!), 1_000_000, { accountNumber: '9999999999' }),
    )
    expect(otherAccount.status).toBe(400)
    expect(((await otherAccount.json()) as ApiError).code).toBe('INVALID_ACCOUNT')
  })

  it('TT-19/TT-20: a valid transfer is stored, matched and credited at the bank time', async () => {
    const id = sepayId()
    const response = await send(webhook(id, paymentCode(codes[0]!), 2_000_000))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { transactionId: number; duplicate: boolean }
    expect(body.duplicate).toBe(false)
    transactionIds.push(body.transactionId)

    const stored = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: body.transactionId },
    })
    expect(stored.sepayId).toBe(BigInt(id))
    expect(stored.accountNumber).toBe(accountNumber)
    expect(stored.transactionDate.toISOString()).toBe(bankDate.toISOString())
    expect(stored.rawPayload).toMatchObject({ transferType: 'in', transferAmount: 2_000_000 })

    expect(await sepay.process(body.transactionId)).toBe<PaymentResult>('matched')
    const updated = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: body.transactionId },
    })
    expect(updated.status).toBe('MATCHED')
    expect(updated.matchedStudentId).toBe(studentIds[0]!)
    expect(updated.matchedTermId).toBe(termId)

    const receipts = await prisma.receipt.findMany({ where: { studentId: studentIds[0] } })
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.channel).toBe('BANK_TRANSFER')
    expect(receipts[0]!.amount).toBe(2_000_000n)
    expect(receipts[0]!.paidAt.toISOString()).toBe(bankDate.toISOString())
    expect(receipts[0]!.bankTransactionId).toBe(body.transactionId)
    const credits = await prisma.ledgerEntry.findMany({
      where: { studentId: studentIds[0], type: LedgerEntryType.PAYMENT },
    })
    expect(credits).toHaveLength(1)
    expect(credits[0]!.amount).toBe(2_000_000n)
    expect(await outstanding(studentIds[0]!)).toBe(3_000_000)
    expect(await settledEvents()).toHaveLength(0)
  })

  it('TT-05: the same SePay id stored and processed twice yields one receipt', async () => {
    const id = sepayId()
    const first = await send(webhook(id, paymentCode(codes[1]!), 1_000_000))
    const original = (await first.json()) as { transactionId: number }
    transactionIds.push(original.transactionId)
    const replay = await send(webhook(id, paymentCode(codes[1]!), 1_000_000))
    expect(replay.status).toBe(200)
    const repeated = (await replay.json()) as { transactionId: number; duplicate: boolean }
    expect(repeated.transactionId).toBe(original.transactionId)
    expect(repeated.duplicate).toBe(true)
    expect(await prisma.bankTransaction.count({ where: { sepayId: BigInt(id) } })).toBe(1)

    expect(await sepay.process(original.transactionId)).toBe<PaymentResult>('matched')
    expect(await sepay.process(original.transactionId)).toBe<PaymentResult>('skipped')
    expect(
      await prisma.receipt.count({ where: { bankTransactionId: original.transactionId } }),
    ).toBe(1)
    expect(
      await prisma.ledgerEntry.count({
        where: { studentId: studentIds[1], type: LedgerEntryType.PAYMENT },
      }),
    ).toBe(1)
  })

  it('TT-20: a transfer whose code does not match goes to the unmatched queue', async () => {
    const response = await send(webhook(sepayId(), 'HP9999999920262', 500_000))
    expect(response.status).toBe(200)
    const { transactionId } = (await response.json()) as { transactionId: number }
    transactionIds.push(transactionId)
    expect(await sepay.process(transactionId)).toBe<PaymentResult>('unmatched')
    const stored = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: transactionId } })
    expect(stored.status).toBe('UNMATCHED')
    expect(stored.processedAt).not.toBeNull()
    expect(await prisma.receipt.count({ where: { bankTransactionId: transactionId } })).toBe(0)
  })

  it('TT-06: an underpayment leaves the remainder open with no settled event', async () => {
    const response = await send(webhook(sepayId(), paymentCode(codes[1]!), 1_000_000))
    const { transactionId } = (await response.json()) as { transactionId: number }
    transactionIds.push(transactionId)
    await sepay.process(transactionId)
    expect(await outstanding(studentIds[1]!)).toBe(3_000_000)
    expect(await settledEvents()).toHaveLength(0)
  })

  it('TT-06/TT-10: an overpayment settles the term, keeps the surplus and writes the email event', async () => {
    const response = await send(webhook(sepayId(), paymentCode(codes[2]!), 5_500_000))
    const { transactionId } = (await response.json()) as { transactionId: number }
    transactionIds.push(transactionId)
    await sepay.process(transactionId)
    expect(await outstanding(studentIds[2]!)).toBe(-500_000)
    const events = await settledEvents()
    expect(events).toHaveLength(1)
    const payload = events[0]!.payload as {
      studentCode: string
      paidAmount: number
      creditBalance: number
    }
    expect(payload.studentCode).toBe(codes[2]!)
    expect(payload.paidAmount).toBe(5_500_000)
    expect(payload.creditBalance).toBe(500_000)
  })
})
