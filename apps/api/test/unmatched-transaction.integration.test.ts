import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/5'

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import {
  LedgerDirection,
  LedgerEntryType,
  Role,
  TermPhase,
  TermType,
} from '../src/generated/prisma/client'
import { TUITION_SETTLED, type SettledPayload } from '../src/payments/settled-email'
import { PrismaService } from '../src/prisma/prisma.service'

const PASSWORD = 'Dkhp@2026'
const stamp = Number(String(Date.now()).slice(-8))
const serial = stamp % 10_000_000
const codes = [
  `6${String(serial).padStart(7, '0')}`,
  `6${String((serial + 1) % 10_000_000).padStart(7, '0')}`,
  `6${String((serial + 2) % 10_000_000).padStart(7, '0')}`,
]
const year = 9500 + (stamp % 400)
const termCode = `${year}2`
const bankDate = new Date('2027-01-06T02:15:00.000Z')
const sepayId = () => BigInt(88_000_000 + Math.floor(Math.random() * 1_000_000))

type ApiError = { code?: string }
type Payment = {
  receipt: { number: string; amount: number }
  before: { outstandingAmount: number }
  after: { outstandingAmount: number }
  settled: boolean
  creditBalance: number
  transaction: { status: string; studentCode: string | null }
}

describe('unmatched bank transactions (integration: Postgres dkhp_w55 + Redis DB 5)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let cookie: string
  let csrf: string
  let actorId: number
  let academicYearId: number
  let termId: number
  const studentIds: number[] = []
  const userIds: number[] = []
  const transactionIds: number[] = []
  let assignId: number
  let concurrentId: number
  let ignoreId: number

  const send = (path: string, body?: unknown, csrfToken = true) =>
    fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'content-type': 'application/json',
        cookie,
        ...(csrfToken ? { 'x-csrf-token': csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  const assign = (id: number, studentCode: string, csrfToken = true) =>
    send(`/bank-transactions/${id}/assign`, { studentCode, termCode }, csrfToken)

  const settledEvents = async () =>
    (await prisma.outboxEvent.findMany({ where: { type: TUITION_SETTLED } })).filter(
      (event) => (event.payload as unknown as SettledPayload).termCode === termCode,
    )

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)

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
    actorId = (await prisma.user.findUniqueOrThrow({ where: { username: 'tv.lan' } })).id

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
          username: `${studentCode}-w55`,
          passwordHash: 'not-used',
          fullName: `Sinh viên thử nghiệm ${index + 1}`,
          email: `w55-${studentCode}@uit.edu.vn`,
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
          email: `w55-${studentCode}@uit.edu.vn`,
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
          description: 'Học phí cố định (fixture TT-07)',
        },
      })
    }

    const transaction = async (content: string, amount: bigint) => {
      const row = await prisma.bankTransaction.create({
        data: {
          sepayId: sepayId(),
          gateway: 'MBBank',
          accountNumber: '1234567890',
          transactionDate: bankDate,
          code: null,
          content,
          amount,
          status: 'UNMATCHED',
          rawPayload: { gateway: 'MBBank', transferType: 'in', content },
        },
      })
      transactionIds.push(row.id)
      return row.id
    }
    assignId = await transaction(`HP ${codes[0]} hoc phi`, 1_000_000n)
    concurrentId = await transaction('chuyen khoan hoc phi', 5_500_000n)
    ignoreId = await transaction('ung ho quy', 200_000n)
  })

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE ledger_entry DISABLE TRIGGER ledger_entry_append_only',
    )
    await prisma.$executeRawUnsafe('ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only')
    try {
      await prisma.auditLog.deleteMany({
        where: { entityType: 'BankTransaction', entityId: { in: transactionIds.map(String) } },
      })
      await prisma.ledgerEntry.deleteMany({ where: { termId } })
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE ledger_entry ENABLE TRIGGER ledger_entry_append_only',
      )
      await prisma.$executeRawUnsafe('ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only')
    }
    await prisma.outboxEvent.deleteMany({
      where: { id: { in: (await settledEvents()).map((event) => event.id) } },
    })
    await prisma.receipt.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.bankTransaction.deleteMany({ where: { id: { in: transactionIds } } })
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.term.delete({ where: { id: termId } }).catch(() => undefined)
    await prisma.academicYear.delete({ where: { id: academicYearId } }).catch(() => undefined)
    await app.close()
  })

  it('D.4.4: list, count, tabs and detail expose the raw SePay payload and MSSV suggestions', async () => {
    const unmatched = await send('/bank-transactions?status=UNMATCHED')
    expect(unmatched.status).toBe(200)
    const body = (await unmatched.json()) as {
      items: { id: number; status: string; suggestedStudentCodes: string[] }[]
      unmatchedCount: number
    }
    expect(body.unmatchedCount).toBeGreaterThanOrEqual(3)
    expect(body.items.find((row) => row.id === assignId)?.suggestedStudentCodes).toContain(codes[0])
    expect(body.items.every((row) => row.status === 'UNMATCHED')).toBe(true)

    const count = (await (await send('/bank-transactions/count')).json()) as {
      unmatchedCount: number
    }
    expect(count.unmatchedCount).toBeGreaterThanOrEqual(3)

    const detail = (await (await send(`/bank-transactions/${assignId}`)).json()) as {
      rawPayload: { transferType: string }
      history: unknown[]
    }
    expect(detail.rawPayload.transferType).toBe('in')
    expect(detail.history).toEqual([])
  })

  it('D.4.4: the debt preview shows before → after without writing anything', async () => {
    const response = await send(
      `/bank-transactions/${assignId}/preview?studentCode=${codes[0]}&termCode=${termCode}`,
    )
    expect(response.status).toBe(200)
    const preview = (await response.json()) as {
      before: { outstandingAmount: number }
      after: { outstandingAmount: number }
    }
    expect(preview.before.outstandingAmount).toBe(5_000_000)
    expect(preview.after.outstandingAmount).toBe(4_000_000)
    expect(await prisma.receipt.count({ where: { bankTransactionId: assignId } })).toBe(0)
  })

  it('NFR-08: assignment and dismissal require a CSRF token', async () => {
    const response = await assign(assignId, codes[0]!, false)
    expect(response.status).toBe(403)
    expect(((await response.json()) as ApiError).code).toBe('CSRF_REQUIRED')
  })

  it('TT-06/TT-07: assignment creates the receipt and the credit row in one transaction', async () => {
    const response = await assign(assignId, codes[0]!)
    expect(response.status).toBe(201)
    const payment = (await response.json()) as Payment
    expect(payment.receipt.number).toBe(`PT-${termCode}-00001`)
    expect(payment.receipt.amount).toBe(1_000_000)
    expect(payment.after.outstandingAmount).toBe(4_000_000)
    expect(payment.settled).toBe(false)
    expect(payment.transaction.status).toBe('MATCHED')
    expect(payment.transaction.studentCode).toBe(codes[0]!)

    const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: assignId } })
    expect(row.status).toBe('MATCHED')
    expect(row.assignedById).toBe(actorId)
    expect(row.processedAt).not.toBeNull()

    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { bankTransactionId: assignId },
    })
    expect(receipt.paidAt.toISOString()).toBe(bankDate.toISOString())
    expect(receipt.channel).toBe('BANK_TRANSFER')
    const credits = await prisma.ledgerEntry.findMany({
      where: { studentId: studentIds[0], type: LedgerEntryType.PAYMENT },
    })
    expect(credits).toHaveLength(1)
    expect(credits[0]!.receiptId).toBe(receipt.id)
    expect(credits[0]!.amount).toBe(1_000_000n)

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'BankTransaction', entityId: String(assignId) },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0]!.action).toBe('BANK_TRANSACTION_ASSIGNED')
    expect(logs[0]!.payload).toMatchObject({
      after: { studentCode: codes[0], termCode, receiptNumber: payment.receipt.number },
    })
  })

  it('TT-05: an already assigned transaction cannot be assigned a second time', async () => {
    const response = await assign(assignId, codes[1]!)
    expect(response.status).toBe(409)
    expect(((await response.json()) as ApiError).code).toBe('TRANSACTION_ALREADY_PROCESSED')
    expect(await prisma.receipt.count({ where: { bankTransactionId: assignId } })).toBe(1)
  })

  it('TT-05: two concurrent assignments produce exactly one receipt', async () => {
    const responses = await Promise.all([
      assign(concurrentId, codes[1]!),
      assign(concurrentId, codes[2]!),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409])

    const receipts = await prisma.receipt.findMany({ where: { bankTransactionId: concurrentId } })
    expect(receipts).toHaveLength(1)
    expect(
      await prisma.ledgerEntry.count({
        where: {
          studentId: { in: [studentIds[1]!, studentIds[2]!] },
          type: LedgerEntryType.PAYMENT,
        },
      }),
    ).toBe(1)
    const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: concurrentId } })
    expect(row.status).toBe('MATCHED')
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: 'BankTransaction',
          entityId: String(concurrentId),
          action: 'BANK_TRANSACTION_ASSIGNED',
        },
      }),
    ).toBe(1)
  })

  it('HP-11/TT-10: an over-assignment becomes a credit balance and writes the settled email event', async () => {
    const events = await settledEvents()
    expect(events).toHaveLength(1)
    const payload = events[0]!.payload as unknown as SettledPayload
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { bankTransactionId: concurrentId },
    })
    expect(payload.receiptNumber).toBe(receipt.receiptNumber)
    expect(payload.paidAmount).toBe(5_500_000)
    expect(payload.creditBalance).toBe(500_000)

    const studentId = receipt.studentId
    const rows = await prisma.ledgerEntry.findMany({ where: { studentId, termId } })
    const outstanding = rows.reduce(
      (sum, row) =>
        sum + (row.direction === LedgerDirection.DEBIT ? Number(row.amount) : -Number(row.amount)),
      0,
    )
    expect(outstanding).toBe(-500_000)
  })

  it('TT-07: dismissal requires a reason and writes an audit entry', async () => {
    const missing = await send(`/bank-transactions/${ignoreId}/ignore`, {})
    expect(missing.status).toBe(400)
    expect(((await missing.json()) as ApiError).code).toBe('IGNORE_REASON_REQUIRED')

    const response = await send(`/bank-transactions/${ignoreId}/ignore`, {
      reason: 'Khong phai hoc phi',
    })
    expect(response.status).toBe(201)
    const dismissed = (await response.json()) as { status: string; ignoreReason: string }
    expect(dismissed.status).toBe('IGNORED')
    expect(dismissed.ignoreReason).toBe('Khong phai hoc phi')
    const row = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: ignoreId } })
    expect(row.status).toBe('IGNORED')
    expect(row.ignoreReason).toBe('Khong phai hoc phi')

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'BankTransaction', entityId: String(ignoreId) },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0]!.action).toBe('BANK_TRANSACTION_IGNORED')
    expect(logs[0]!.payload).toMatchObject({ after: { reason: 'Khong phai hoc phi' } })

    const again = await assign(ignoreId, codes[0]!)
    expect(again.status).toBe(409)
  })

  it('D.4.4: the ignored tab lists dismissed transactions and the detail shows their history', async () => {
    const ignored = (await (await send('/bank-transactions?status=IGNORED')).json()) as {
      items: { id: number }[]
    }
    expect(ignored.items.some((row) => row.id === ignoreId)).toBe(true)

    const all = (await (await send('/bank-transactions?status=ALL')).json()) as {
      items: { id: number }[]
    }
    expect(all.items.some((row) => row.id === assignId)).toBe(true)
    expect(all.items.some((row) => row.id === ignoreId)).toBe(true)

    const detail = (await (await send(`/bank-transactions/${ignoreId}`)).json()) as {
      history: { action: string; actorName: string | null }[]
    }
    expect(detail.history).toHaveLength(1)
    expect(detail.history[0]!.action).toBe('BANK_TRANSACTION_IGNORED')
    expect(detail.history[0]!.actorName).not.toBeNull()
  })
})
