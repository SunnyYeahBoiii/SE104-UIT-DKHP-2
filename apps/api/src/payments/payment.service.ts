import { HttpException, Injectable } from '@nestjs/common'

import {
  LedgerDirection,
  LedgerEntryType,
  PaymentChannel,
  type AcademicYear,
  type Cohort,
  type Receipt,
  type Student,
  type Term,
  type TrainingSystem,
  type User,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TuitionService, termName, type Bm7 } from '../tuition/tuition.service'
import { TUITION_SETTLED, type SettledPayload } from './settled-email'
import { amountInWords } from './money-in-words'
import { nextReceiptNumber } from './receipt-number'

const RECEIPT_LOCK_NAMESPACE = 20261119

type ReceiptRow = Receipt & {
  student: Student & { cohort: Cohort; trainingSystem: TrainingSystem }
  term: Term & { academicYear: AcademicYear }
  collectedBy: User | null
}

export type ReceiptDetail = {
  id: number
  number: string
  studentCode: string
  studentName: string
  cohortCode: string
  trainingSystemCode: string
  termCode: string
  termName: string
  channel: PaymentChannel
  amount: number
  amountInWords: string
  paidAt: string
  collector: string | null
  note: string | null
}

export type TermDebt = {
  code: string
  name: string
  outstandingAmount: number
  netAmount: number
  paidAmount: number
  tuitionDeadline: string
  phase: string
}

export type CounterStudent = {
  studentCode: string
  fullName: string
  email: string | null
  cohortCode: string
  trainingSystemCode: string
  priority: { name: string; rate: number } | null
  debts: TermDebt[]
  defaultTermCode: string | null
}

export type PaymentResult = {
  receipt: ReceiptDetail
  before: Bm7
  after: Bm7
  settled: boolean
  creditBalance: number
}

export function shiftStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), -7))
}

function detail(row: ReceiptRow): ReceiptDetail {
  return {
    id: row.id,
    number: row.receiptNumber,
    studentCode: row.student.studentCode,
    studentName: row.student.fullName,
    cohortCode: row.student.cohort.code,
    trainingSystemCode: row.student.trainingSystem.code,
    termCode: row.term.termCode,
    termName: termName(row.term),
    channel: row.channel,
    amount: Number(row.amount),
    amountInWords: amountInWords(row.amount),
    paidAt: row.paidAt.toISOString(),
    collector: row.collectedBy?.fullName ?? null,
    note: row.note,
  }
}

/**
 * TT-01/TT-06/TT-09/TT-10: the one runtime write path that turns a payment into a receipt, a credit
 * ledger row and (when the term crosses into settled) a durable outbox event, all in one transaction.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tuition: TuitionService,
  ) {}

  private include() {
    return {
      student: { include: { cohort: true, trainingSystem: true } },
      term: { include: { academicYear: true } },
      collectedBy: true,
    } as const
  }

  async studentForCounter(studentCode: string): Promise<CounterStudent> {
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: {
        user: { select: { email: true } },
        cohort: true,
        trainingSystem: true,
      },
    })
    if (!student)
      throw new HttpException(
        { code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy sinh viên với mã này.' },
        404,
      )
    const terms = await this.prisma.term.findMany({
      include: { academicYear: true },
      orderBy: { startDate: 'asc' },
    })
    const debts: TermDebt[] = []
    for (const term of terms) {
      const bm7 = await this.tuition.bm7(this.prisma, student.id, term.id)
      if (bm7.outstandingAmount <= 0) continue
      debts.push({
        code: term.termCode,
        name: termName(term),
        outstandingAmount: bm7.outstandingAmount,
        netAmount: bm7.netAmount,
        paidAmount: bm7.paidAmount,
        tuitionDeadline: term.tuitionDeadline.toISOString(),
        phase: term.phase,
      })
    }
    return {
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.user.email,
      cohortCode: student.cohort.code,
      trainingSystemCode: student.trainingSystem.code,
      priority: await this.tuition.discountFor(this.prisma, student.id),
      debts,
      defaultTermCode: debts[0]?.code ?? null,
    }
  }

  /** Called once per idempotency key; the Redis claim lives in the controller. */
  async pay(args: {
    studentCode: string
    termCode: string
    amount: bigint
    collectedById?: number | null
    note: string | null
    paidAt?: Date
    channel?: PaymentChannel
    bankTransactionId?: number
  }): Promise<PaymentResult> {
    return this.prisma.$transaction(async (db) => {
      const student = await db.student.findUnique({
        where: { studentCode: args.studentCode },
        include: { user: { select: { email: true } }, cohort: true, trainingSystem: true },
      })
      const term = await db.term.findUnique({
        where: { termCode: args.termCode },
        include: { academicYear: true },
      })
      if (!student || !term)
        throw new HttpException(
          { code: 'STUDENT_OR_TERM_NOT_FOUND', message: 'Sinh viên hoặc học kỳ không hợp lệ.' },
          404,
        )

      // Serialize number allocation per term without a new sequence table; the unique index is the backstop.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(${RECEIPT_LOCK_NAMESPACE}, ${term.id})::text`

      const before = await this.tuition.bm7(db, student.id, term.id)
      const used = await db.receipt.findMany({
        where: { termId: term.id },
        select: { receiptNumber: true },
      })
      const number = nextReceiptNumber(
        term.termCode,
        used.map((row) => row.receiptNumber),
      )
      const paidAt = args.paidAt ?? new Date()
      const receipt = await db.receipt.create({
        data: {
          receiptNumber: number,
          studentId: student.id,
          termId: term.id,
          channel: args.channel ?? PaymentChannel.COUNTER,
          amount: args.amount,
          paidAt,
          bankTransactionId: args.bankTransactionId ?? null,
          collectedById: args.collectedById ?? null,
          note: args.note,
        },
      })
      await db.ledgerEntry.create({
        data: {
          studentId: student.id,
          termId: term.id,
          type: LedgerEntryType.PAYMENT,
          direction: LedgerDirection.CREDIT,
          amount: args.amount,
          receiptId: receipt.id,
          createdById: args.collectedById ?? null,
          createdAt: paidAt,
          description: `Phiếu thu ${number}`,
        },
      })
      const after = await this.tuition.bm7(db, student.id, term.id)
      const settled = before.outstandingAmount > 0 && after.outstandingAmount <= 0
      if (settled) {
        const payload: SettledPayload = {
          studentCode: student.studentCode,
          studentName: student.fullName,
          email: student.email ?? student.user.email,
          termCode: term.termCode,
          termName: termName(term),
          netAmount: after.netAmount,
          paidAmount: after.paidAmount,
          creditBalance: Math.max(0, -after.outstandingAmount),
          receiptNumber: number,
        }
        await db.outboxEvent.create({
          data: { type: TUITION_SETTLED, payload },
        })
      }

      const row = await db.receipt.findUniqueOrThrow({
        where: { id: receipt.id },
        include: this.include(),
      })
      return {
        receipt: detail(row),
        before,
        after,
        settled,
        creditBalance: Math.max(0, -after.outstandingAmount),
      }
    })
  }

  async shiftReceipts(collectorId: number) {
    const rows = await this.prisma.receipt.findMany({
      where: { collectedById: collectorId, paidAt: { gte: shiftStart() } },
      include: this.include(),
      orderBy: { paidAt: 'desc' },
    })
    return {
      receipts: rows.map(detail),
      totalAmount: rows.reduce((sum, row) => sum + Number(row.amount), 0),
    }
  }

  async receiptsFor(userId: number): Promise<ReceiptDetail[]> {
    const student = await this.prisma.student.findUnique({ where: { userId } })
    if (!student)
      throw new HttpException(
        { code: 'NO_STUDENT_PROFILE', message: 'Không tìm thấy hồ sơ sinh viên.' },
        403,
      )
    const rows = await this.prisma.receipt.findMany({
      where: { studentId: student.id },
      include: this.include(),
      orderBy: { paidAt: 'desc' },
    })
    return rows.map(detail)
  }

  async receiptFor(userId: number, number: string): Promise<ReceiptDetail> {
    const student = await this.prisma.student.findUnique({ where: { userId } })
    if (!student)
      throw new HttpException(
        { code: 'NO_STUDENT_PROFILE', message: 'Không tìm thấy hồ sơ sinh viên.' },
        403,
      )
    const row = await this.prisma.receipt.findFirst({
      where: { studentId: student.id, receiptNumber: number },
      include: this.include(),
    })
    if (!row)
      throw new HttpException(
        { code: 'RECEIPT_NOT_FOUND', message: 'Không tìm thấy phiếu thu.' },
        404,
      )
    return detail(row)
  }
}
