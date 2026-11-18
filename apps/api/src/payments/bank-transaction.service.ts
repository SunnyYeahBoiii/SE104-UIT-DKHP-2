import { HttpException, Injectable } from '@nestjs/common'

import { BankTransactionStatus, PaymentChannel, Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { suggestedStudentCodes } from './bank-transaction.validation'
import { PaymentService, type PaymentResult } from './payment.service'
import { TuitionService, termName, type Bm7 } from '../tuition/tuition.service'

export type TransactionActor = { actorId: number; requestId?: string }

export type TransactionRow = {
  id: number
  sepayId: string
  gateway: string
  accountNumber: string
  transactionDate: string
  code: string | null
  content: string
  referenceCode: string | null
  amount: number
  status: BankTransactionStatus
  ignoreReason: string | null
  studentCode: string | null
  studentName: string | null
  termCode: string | null
  termName: string | null
  receiptNumber: string | null
  assignedBy: string | null
  processedAt: string | null
  suggestedStudentCodes: string[]
}

export type TransactionDetail = TransactionRow & {
  rawPayload: unknown
  history: {
    action: string
    actorName: string | null
    createdAt: string
    payload: unknown
  }[]
}

export type TransactionList = { items: TransactionRow[]; unmatchedCount: number }

export type AssignResult = PaymentResult & { transaction: TransactionRow }

const include = {
  matchedStudent: true,
  matchedTerm: { include: { academicYear: true } },
  assignedBy: { select: { fullName: true } },
  receipt: true,
} as const

type FullRow = Prisma.BankTransactionGetPayload<{ include: typeof include }>

export function transactionRow(row: FullRow): TransactionRow {
  return {
    id: row.id,
    sepayId: row.sepayId.toString(),
    gateway: row.gateway,
    accountNumber: row.accountNumber,
    transactionDate: row.transactionDate.toISOString(),
    code: row.code,
    content: row.content,
    referenceCode: row.referenceCode,
    amount: Number(row.amount),
    status: row.status,
    ignoreReason: row.ignoreReason,
    studentCode: row.matchedStudent?.studentCode ?? null,
    studentName: row.matchedStudent?.fullName ?? null,
    termCode: row.matchedTerm?.termCode ?? null,
    termName: row.matchedTerm ? termName(row.matchedTerm) : null,
    receiptNumber: row.receipt?.receiptNumber ?? null,
    assignedBy: row.assignedBy?.fullName ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    suggestedStudentCodes: suggestedStudentCodes(`${row.code ?? ''} ${row.content}`),
  }
}

@Injectable()
export class BankTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly tuition: TuitionService,
  ) {}

  async list(status: string): Promise<TransactionList> {
    const where =
      status === 'UNMATCHED' || status === 'IGNORED'
        ? { status: status as BankTransactionStatus }
        : {}
    const [rows, unmatchedCount] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        include,
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.bankTransaction.count({ where: { status: BankTransactionStatus.UNMATCHED } }),
    ])
    return { items: rows.map(transactionRow), unmatchedCount }
  }

  async count(): Promise<{ unmatchedCount: number }> {
    return {
      unmatchedCount: await this.prisma.bankTransaction.count({
        where: { status: BankTransactionStatus.UNMATCHED },
      }),
    }
  }

  async detail(id: number): Promise<TransactionDetail> {
    const row = await this.prisma.bankTransaction.findUnique({ where: { id }, include })
    if (!row) this.notFound()
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: 'BankTransaction', entityId: String(id) },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return {
      ...transactionRow(row),
      rawPayload: row.rawPayload,
      history: logs.map((log) => ({
        action: log.action,
        actorName: log.actor?.fullName ?? null,
        createdAt: log.createdAt.toISOString(),
        payload: log.payload,
      })),
    }
  }

  async terms() {
    const rows = await this.prisma.term.findMany({
      include: { academicYear: true },
      orderBy: { termCode: 'asc' },
    })
    return rows.map((row) => ({ code: row.termCode, name: termName(row) }))
  }

  async students(q: string) {
    const query = q.trim()
    if (!query) return []
    const rows = await this.prisma.student.findMany({
      where: {
        OR: [
          { studentCode: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { studentCode: true, fullName: true, email: true },
      orderBy: { studentCode: 'asc' },
      take: 8,
    })
    return rows
  }

  /** D.4.4: the debt preview is read-only; the real write happens in `assign`. */
  async preview(id: number, studentCode: string, termCode: string) {
    const row = await this.prisma.bankTransaction.findUnique({ where: { id } })
    if (!row) this.notFound()
    const student = await this.prisma.student.findUnique({ where: { studentCode } })
    const term = await this.prisma.term.findUnique({
      where: { termCode },
      include: { academicYear: true },
    })
    if (!student || !term)
      throw new HttpException(
        { code: 'STUDENT_OR_TERM_NOT_FOUND', message: 'Sinh viên hoặc học kỳ không hợp lệ.' },
        404,
      )
    const before = await this.tuition.bm7(this.prisma, student.id, term.id)
    return {
      studentCode: student.studentCode,
      studentName: student.fullName,
      termCode: term.termCode,
      termName: termName(term),
      amount: Number(row.amount),
      before,
      after: this.afterDebt(before, row.amount),
    }
  }

  private afterDebt(before: Bm7, amount: bigint): Bm7 {
    const outstandingAmount = before.outstandingAmount - Number(amount)
    return {
      ...before,
      paidAmount: before.paidAmount + Number(amount),
      outstandingAmount,
    }
  }

  /** TT-07/TT-05/TT-10: lock the row, then post the receipt, credit row and email event in one transaction. */
  async assign(
    id: number,
    input: { studentCode: string; termCode: string },
    actor: TransactionActor,
  ): Promise<AssignResult> {
    try {
      return await this.prisma.$transaction(async (db) => {
        await this.lock(db, id)
        const row = await db.bankTransaction.findUniqueOrThrow({ where: { id }, include })
        this.assertUnmatched(row)
        const [student, term] = await Promise.all([
          db.student.findUnique({ where: { studentCode: input.studentCode } }),
          db.term.findUnique({ where: { termCode: input.termCode } }),
        ])
        const result = await this.payments.pay({
          studentCode: input.studentCode,
          termCode: input.termCode,
          amount: row.amount,
          channel: PaymentChannel.BANK_TRANSFER,
          bankTransactionId: row.id,
          collectedById: actor.actorId,
          paidAt: row.transactionDate,
          note: row.content,
          db,
        })
        await db.bankTransaction.update({
          where: { id },
          data: {
            status: BankTransactionStatus.MATCHED,
            matchedStudentId: student?.id ?? null,
            matchedTermId: term?.id ?? null,
            assignedById: actor.actorId,
            processedAt: new Date(),
          },
        })
        await this.audit(db, actor, 'BANK_TRANSACTION_ASSIGNED', id, {
          before: { status: BankTransactionStatus.UNMATCHED },
          after: {
            status: BankTransactionStatus.MATCHED,
            studentCode: input.studentCode,
            termCode: input.termCode,
            receiptNumber: result.receipt.number,
          },
        })
        const updated = await db.bankTransaction.findUniqueOrThrow({ where: { id }, include })
        return { ...result, transaction: transactionRow(updated) }
      })
    } catch (error) {
      if (this.isDuplicate(error)) this.alreadyProcessed()
      throw error
    }
  }

  /** TT-07: dismissing a non-tuition transfer requires a reason and an audit entry. */
  async ignore(id: number, reason: string, actor: TransactionActor): Promise<TransactionRow> {
    return this.prisma.$transaction(async (db) => {
      await this.lock(db, id)
      const row = await db.bankTransaction.findUniqueOrThrow({ where: { id }, include })
      this.assertUnmatched(row)
      await db.bankTransaction.update({
        where: { id },
        data: {
          status: BankTransactionStatus.IGNORED,
          ignoreReason: reason,
          assignedById: actor.actorId,
          processedAt: new Date(),
        },
      })
      await this.audit(db, actor, 'BANK_TRANSACTION_IGNORED', id, {
        before: { status: BankTransactionStatus.UNMATCHED },
        after: { status: BankTransactionStatus.IGNORED, reason },
      })
      return transactionRow(await db.bankTransaction.findUniqueOrThrow({ where: { id }, include }))
    })
  }

  private async lock(db: Prisma.TransactionClient, id: number): Promise<void> {
    await db.$queryRaw`SELECT id FROM bank_transaction WHERE id = ${id} FOR UPDATE`
  }

  private assertUnmatched(row: { status: BankTransactionStatus }): void {
    if (row.status !== BankTransactionStatus.UNMATCHED) this.alreadyProcessed()
  }

  private alreadyProcessed(): never {
    throw new HttpException(
      {
        code: 'TRANSACTION_ALREADY_PROCESSED',
        message: 'Giao dịch đã được xử lý. Không thể gán hoặc bỏ qua lần hai.',
      },
      409,
    )
  }

  private isDuplicate(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  }

  private async audit(
    db: Prisma.TransactionClient,
    actor: TransactionActor,
    action: string,
    id: number,
    payload: { before: unknown; after: unknown },
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: actor.actorId,
        action,
        entityType: 'BankTransaction',
        entityId: String(id),
        payload: payload as Prisma.InputJsonValue,
        requestId: actor.requestId,
      },
    })
  }

  private notFound(): never {
    throw new HttpException(
      { code: 'TRANSACTION_NOT_FOUND', message: 'Không tìm thấy giao dịch.' },
      404,
    )
  }
}
