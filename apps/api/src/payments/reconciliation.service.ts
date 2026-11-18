import { HttpException, Injectable } from '@nestjs/common'

import { ReceivingAccountService } from '../finance/receiving-account.service'
import { Prisma, ReconciliationDiscrepancyType } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { SepayApiClient } from './sepay-api'
import {
  discrepancyLabels,
  RECONCILIATION_NOTE,
  vietnamDay,
  type ReconciliationRunDetail,
  type ReconciliationRunSummary,
} from './reconciliation'
import { SepayService } from './sepay.service'

const runInclude = {
  discrepancies: { orderBy: { id: 'asc' as const } },
  backfilledTransactions: {
    orderBy: { transactionDate: 'asc' as const },
    include: { receipt: { include: { student: true, term: true } } },
  },
} as const

type RunWithDetails = Prisma.ReconciliationRunGetPayload<{ include: typeof runInclude }>

type DiscrepancyInput = {
  type: ReconciliationDiscrepancyType
  sepayId: bigint
  bankTransactionId: number
  bankAmount: bigint | null
  systemAmount: bigint
  detail: string
}

const money = (value: bigint) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`

function summary(run: RunWithDetails): ReconciliationRunSummary {
  return {
    id: run.id,
    date: run.date.toISOString().slice(0, 10),
    bankCount: run.bankCount,
    systemCount: run.systemCount,
    backfilledCount: run.backfilledCount,
    residualCount: run.residualCount,
    status: run.residualCount === 0 ? 'MATCHED' : 'HAS_DIFFERENCES',
    statusLabel: run.residualCount === 0 ? 'Khớp' : 'Có lệch',
    createdAt: run.createdAt.toISOString(),
  }
}

function detail(run: RunWithDetails): ReconciliationRunDetail {
  return {
    ...summary(run),
    note: RECONCILIATION_NOTE,
    backfilled: run.backfilledTransactions.map((transaction) => ({
      transactionId: transaction.id,
      sepayId: transaction.sepayId.toString(),
      amount: Number(transaction.amount),
      transactionDate: transaction.transactionDate.toISOString(),
      code: transaction.code,
      receiptNumber: transaction.receipt?.receiptNumber ?? null,
      studentCode: transaction.receipt?.student.studentCode ?? null,
      studentName: transaction.receipt?.student.fullName ?? null,
    })),
    discrepancies: run.discrepancies.map((row) => ({
      id: row.id,
      type: row.type,
      typeLabel: discrepancyLabels[row.type],
      sepayId: row.sepayId?.toString() ?? null,
      bankAmount: row.bankAmount === null ? null : Number(row.bankAmount),
      systemAmount: row.systemAmount === null ? null : Number(row.systemAmount),
      detail: row.detail,
    })),
  }
}

/** TT-08/QĐ21: compare SePay's list with stored transactions, backfill misses and keep the residue. */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sepay: SepayService,
    private readonly api: SepayApiClient,
    private readonly accounts: ReceivingAccountService,
  ) {}

  async reconcile(at: Date = new Date()): Promise<ReconciliationRunDetail> {
    const window = vietnamDay(at)
    const existing = await this.prisma.reconciliationRun.findUnique({
      where: { date: window.date },
      include: runInclude,
    })
    if (existing) return detail(existing)

    const providerRows = await this.api.listTransactions(window.from, window.to)
    const bank = new Map<bigint, (typeof providerRows)[number]>()
    for (const row of providerRows) {
      if (row.transferType !== 'in') continue
      if (!(await this.accounts.accepts(row.accountNumber))) continue
      bank.set(row.sepayId, row)
    }

    const stored = await this.prisma.bankTransaction.findMany({
      where: { transactionDate: { gte: window.from, lt: window.to } },
      select: { id: true, sepayId: true, amount: true },
    })
    const known = new Set(stored.map((row) => row.sepayId))

    const backfilled: number[] = []
    for (const [sepayId, row] of bank) {
      if (known.has(sepayId)) continue
      // DFD 26/B5: same store-and-enqueue path as the webhook, so the worker posts a receipt and email.
      const { created, transactionId } = await this.sepay.ingest(row)
      if (created) backfilled.push(transactionId)
    }

    const discrepancies: DiscrepancyInput[] = []
    for (const row of stored) {
      const fromBank = bank.get(row.sepayId)
      if (!fromBank) {
        discrepancies.push({
          type: ReconciliationDiscrepancyType.MISSING_AT_BANK,
          sepayId: row.sepayId,
          bankTransactionId: row.id,
          bankAmount: null,
          systemAmount: row.amount,
          detail: 'Có trong hệ thống nhưng không thấy ở ngân hàng.',
        })
      } else if (fromBank.amount !== row.amount) {
        discrepancies.push({
          type: ReconciliationDiscrepancyType.AMOUNT_MISMATCH,
          sepayId: row.sepayId,
          bankTransactionId: row.id,
          bankAmount: fromBank.amount,
          systemAmount: row.amount,
          detail: `Ngân hàng ${money(fromBank.amount)}; hệ thống ${money(row.amount)}.`,
        })
      }
    }

    const run = await this.prisma.reconciliationRun.create({
      data: {
        date: window.date,
        bankCount: bank.size,
        systemCount: stored.length,
        backfilledCount: backfilled.length,
        residualCount: discrepancies.length,
        backfilledTransactions: { connect: backfilled.map((id) => ({ id })) },
        discrepancies: { create: discrepancies },
      },
      include: runInclude,
    })
    return detail(run)
  }

  async list(): Promise<{ items: ReconciliationRunSummary[]; count: number }> {
    const runs = await this.prisma.reconciliationRun.findMany({
      orderBy: { date: 'desc' },
      include: runInclude,
    })
    return { items: runs.map(summary), count: runs.length }
  }

  async detail(id: number): Promise<ReconciliationRunDetail> {
    const run = await this.prisma.reconciliationRun.findUnique({
      where: { id },
      include: runInclude,
    })
    if (!run)
      throw new HttpException(
        { code: 'RECONCILIATION_NOT_FOUND', message: 'Không tìm thấy lần đối soát.' },
        404,
      )
    return detail(run)
  }
}
