import { HttpException, Injectable } from '@nestjs/common'

import { Clock } from '../academics/clock'
import {
  AttemptType,
  BankTransactionStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentChannel,
  Prisma,
  Role,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { recalculationGroupOf } from '../tuition/recalculation'
import { bm7FromTotals, ledgerTotals, termName, type Bm7 } from '../tuition/tuition.service'

const ATTEMPT_LABEL: Record<AttemptType, string> = {
  FIRST: 'Lần đầu',
  RETAKE: 'Học lại',
  IMPROVEMENT: 'Cải thiện',
}

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  COUNTER: 'Tại quầy',
  BANK_TRANSFER: 'Chuyển khoản',
}

export const LEDGER_TYPE_LABEL: Record<LedgerEntryType, string> = {
  BASE_TUITION: 'Học phí cố định',
  BASE_TUITION_REVERSAL: 'Đảo học phí cố định',
  SURCHARGE: 'Phụ thu',
  SURCHARGE_REVERSAL: 'Đảo phụ thu',
  DISCOUNT: 'Giảm trừ',
  DISCOUNT_REVERSAL: 'Đảo giảm trừ',
  PAYMENT: 'Thanh toán',
  BALANCE_CARRY_OUT: 'Chuyển số dư ra',
  BALANCE_CARRY_IN: 'Chuyển số dư vào',
}

export const LEDGER_NOTE =
  'Sổ cái chỉ ghi thêm. Mọi dòng do hệ thống sinh theo quy tắc, trừ phiếu thu tại quầy. Sai sót được xử lý ngoài hệ thống.'
export const BM7_NOTE =
  'Ba con số luôn tính lại từ sổ cái. Danh sách sau hạn đóng được gửi bộ phận khảo thí.'

const vietnamDay = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const dayStart = (day: string) => new Date(`${day}T00:00:00+07:00`)
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999+07:00`)

function optionalId(value: string | undefined, field: string): number | undefined {
  if (value === undefined || value === '' || value === 'all') return undefined
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new HttpException({ code: 'INVALID_FILTER', message: `${field} không hợp lệ.` }, 400)
  return id
}

function optionalDay(value: string | undefined, field: string): string | undefined {
  if (!value) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(dayStart(value).getTime()))
    throw new HttpException({ code: 'INVALID_FILTER', message: `${field} không hợp lệ.` }, 400)
  return value
}

function optionalEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (!value || value === 'all') return undefined
  if (!allowed.includes(value as T))
    throw new HttpException({ code: 'INVALID_FILTER', message: `${field} không hợp lệ.` }, 400)
  return value as T
}

type GroupRow = {
  studentId: number
  type: LedgerEntryType
  direction: LedgerDirection
  amount: bigint
}

type TermWithYear = Prisma.TermGetPayload<{ include: { academicYear: true } }>

export type FinanceTerm = {
  code: string
  name: string
  type: string
  phase: string
  tuitionDeadline: string
}

export type FinanceFilters = {
  terms: FinanceTerm[]
  cohorts: { id: number; code: string; admissionYear: number }[]
  trainingSystems: { id: number; code: string; name: string }[]
  priorityGroups: { id: number; code: string; name: string; discountRate: number }[]
  collectors: { id: number; fullName: string }[]
}

export type LedgerViewRow = {
  id: number
  at: string
  type: LedgerEntryType
  typeLabel: string
  description: string
  detail: string | null
  debit: number
  credit: number
  balance: number
  actor: string
  relatedEntryId: number | null
  receipt: {
    id: number
    number: string
    bankTransactionId: number | null
    bankTransactionCode: string | null
  } | null
  group: string | null
}

export type DebtOverview = {
  student: {
    studentCode: string
    fullName: string
    cohortCode: string
    trainingSystemCode: string
    priority: { name: string; rate: number } | null
  }
  terms: { code: string; name: string; outstandingAmount: number }[]
  totalOutstanding: number
  creditBalance: number
  selected: {
    code: string
    name: string
    phase: string
    tuitionDeadline: string
    bm7: Bm7
    ledger: LedgerViewRow[]
  } | null
  note: string
  ledgerTypes: { type: LedgerEntryType; label: string }[]
}

export type ReceiptRow = {
  id: number
  receiptNumber: string
  paidAt: string
  studentCode: string
  fullName: string
  termCode: string
  amount: number
  channel: PaymentChannel
  channelLabel: string
  collector: string | null
  note: string | null
  bankTransactionId: number | null
  bankTransactionCode: string | null
}

export type ReceiptList = {
  items: ReceiptRow[]
  totalAmount: number
  count: number
}

export type Bm7Row = {
  stt: number
  studentCode: string
  fullName: string
  cohortCode: string
  systemCode: string
  priorityName: string | null
  grossAmount: number
  discountAmount: number
  netAmount: number
  paidAmount: number
  outstandingAmount: number
}

export type Bm7Report = {
  term: FinanceTerm
  generatedAt: string
  maker: string
  rows: Bm7Row[]
  totals: {
    grossAmount: number
    discountAmount: number
    netAmount: number
    paidAmount: number
    outstandingAmount: number
  }
  note: string
}

export type FinanceOverview = {
  term: FinanceTerm
  now: string
  stats: {
    mustPay: number
    collected: number
    collectedByChannel: { counter: number; bankTransfer: number }
    remaining: number
    settledCount: number
    studentCount: number
    settledRatio: number
    overdueCount: number
  }
  daily: {
    date: string
    counter: number
    bankTransfer: number
    total: number
    cumulative: number
  }[]
  todos: { key: string; title: string; count: number; detail: string; href: string }[]
}

/**
 * D.4.1/D.4.3/D.4.6/D.4.8: read-only finance views. BM7 figures come from the same ledger fold as the
 * student portal (HP-09), never from a stored summary, so the report always matches the ledger.
 */
@Injectable()
export class FinanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async filters(): Promise<FinanceFilters> {
    const [terms, cohorts, trainingSystems, priorityGroups, collectors] = await Promise.all([
      this.prisma.term.findMany({ include: { academicYear: true }, orderBy: { termCode: 'desc' } }),
      this.prisma.cohort.findMany({ orderBy: { admissionYear: 'desc' } }),
      this.prisma.trainingSystem.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.priorityGroup.findMany({ orderBy: [{ priority: 'desc' }, { code: 'asc' }] }),
      this.prisma.user.findMany({
        where: { roles: { has: Role.FINANCE_OFFICE } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
    ])
    return {
      terms: terms.map((term) => this.termView(term)),
      cohorts: cohorts.map(({ id, code, admissionYear }) => ({ id, code, admissionYear })),
      trainingSystems: trainingSystems.map(({ id, code, name }) => ({ id, code, name })),
      priorityGroups: priorityGroups.map(({ id, code, name, discountRate }) => ({
        id,
        code,
        name,
        discountRate,
      })),
      collectors,
    }
  }

  async debt(studentCode: string, termCode?: string): Promise<DebtOverview> {
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: {
        cohort: true,
        trainingSystem: true,
        priorityGroups: {
          include: { priorityGroup: true },
          orderBy: { priorityGroup: { priority: 'desc' } },
        },
      },
    })
    if (!student) throw this.notFound('sinh viên')

    const terms = await this.prisma.term.findMany({
      include: { academicYear: true },
      orderBy: { registrationStartAt: 'desc' },
    })
    const bm7s = await Promise.all(
      terms.map(async (term) => ({ term, bm7: await this.bm7For(student.id, term.id) })),
    )
    const withLedger = bm7s.filter(({ bm7 }) => bm7.grossAmount !== 0 || bm7.paidAmount !== 0)
    const visible = withLedger.length ? withLedger : bm7s
    const options = visible.map(({ term, bm7 }) => ({
      code: term.termCode,
      name: this.termView(term).name,
      outstandingAmount: bm7.outstandingAmount,
    }))
    const chosen =
      (termCode ? bm7s.find(({ term }) => term.termCode === termCode) : undefined) ??
      visible.find(({ bm7 }) => bm7.outstandingAmount > 0) ??
      visible[0]
    const best = student.priorityGroups[0]?.priorityGroup

    return {
      student: {
        studentCode,
        fullName: student.fullName,
        cohortCode: student.cohort.code,
        trainingSystemCode: student.trainingSystem.code,
        priority:
          best && best.discountRate > 0 ? { name: best.name, rate: best.discountRate } : null,
      },
      terms: options,
      totalOutstanding: options.reduce((sum, item) => sum + item.outstandingAmount, 0),
      creditBalance: -options.reduce((sum, item) => sum + Math.min(0, item.outstandingAmount), 0),
      selected: chosen
        ? {
            code: chosen.term.termCode,
            name: this.termView(chosen.term).name,
            phase: chosen.term.phase,
            tuitionDeadline: chosen.term.tuitionDeadline.toISOString(),
            bm7: chosen.bm7,
            ledger: await this.ledger(student.id, chosen.term.id),
          }
        : null,
      note: LEDGER_NOTE,
      ledgerTypes: Object.entries(LEDGER_TYPE_LABEL).map(([type, label]) => ({
        type: type as LedgerEntryType,
        label,
      })),
    }
  }

  async receipts(query: {
    termCode?: string
    channel?: string
    collectorId?: string
    from?: string
    to?: string
  }): Promise<ReceiptList> {
    const termCode = query.termCode && query.termCode !== 'all' ? query.termCode : undefined
    const channel = optionalEnum(query.channel, Object.values(PaymentChannel), 'Kênh thu')
    const collectorId = optionalId(query.collectorId, 'Người thu')
    const from = optionalDay(query.from, 'Từ ngày')
    const to = optionalDay(query.to, 'Đến ngày')
    const where: Prisma.ReceiptWhereInput = {
      ...(termCode ? { term: { termCode } } : {}),
      ...(channel ? { channel } : {}),
      ...(collectorId ? { collectedById: collectorId } : {}),
      ...(from || to
        ? {
            paidAt: {
              ...(from ? { gte: dayStart(from) } : {}),
              ...(to ? { lte: dayEnd(to) } : {}),
            },
          }
        : {}),
    }
    const rows = await this.prisma.receipt.findMany({
      where,
      include: {
        student: { select: { studentCode: true, fullName: true } },
        term: { select: { termCode: true } },
        collectedBy: { select: { fullName: true } },
        bankTransaction: { select: { id: true, code: true } },
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
    })
    return {
      items: rows.map((row) => ({
        id: row.id,
        receiptNumber: row.receiptNumber,
        paidAt: row.paidAt.toISOString(),
        studentCode: row.student.studentCode,
        fullName: row.student.fullName,
        termCode: row.term.termCode,
        amount: Number(row.amount),
        channel: row.channel,
        channelLabel: CHANNEL_LABEL[row.channel],
        collector: row.collectedBy?.fullName ?? null,
        note: row.note,
        bankTransactionId: row.bankTransaction?.id ?? null,
        bankTransactionCode: row.bankTransaction?.code ?? null,
      })),
      totalAmount: rows.reduce((sum, row) => sum + Number(row.amount), 0),
      count: rows.length,
    }
  }

  async bm7(
    query: {
      termCode?: string
      cohortId?: string
      trainingSystemId?: string
      priorityGroupId?: string
    },
    maker: string,
  ): Promise<Bm7Report> {
    const term = await this.termByCode(query.termCode)
    const cohortId = optionalId(query.cohortId, 'Khoá')
    const trainingSystemId = optionalId(query.trainingSystemId, 'Hệ đào tạo')
    const priorityGroupId = optionalId(query.priorityGroupId, 'Đối tượng ưu tiên')
    const students = await this.prisma.student.findMany({
      where: {
        ...(cohortId ? { cohortId } : {}),
        ...(trainingSystemId ? { trainingSystemId } : {}),
        ...(priorityGroupId ? { priorityGroups: { some: { priorityGroupId } } } : {}),
      },
      include: {
        cohort: true,
        trainingSystem: true,
        priorityGroups: {
          include: { priorityGroup: true },
          orderBy: { priorityGroup: { priority: 'desc' } },
        },
      },
      orderBy: { studentCode: 'asc' },
    })
    const figures = await this.bm7ForTerm(term.id)
    const rows: Bm7Row[] = []
    for (const student of students) {
      const bm7 = figures.get(student.id)
      if (!bm7 || bm7.outstandingAmount <= 0) continue
      const priority = student.priorityGroups[0]?.priorityGroup
      rows.push({
        stt: rows.length + 1,
        studentCode: student.studentCode,
        fullName: student.fullName,
        cohortCode: student.cohort.code,
        systemCode: student.trainingSystem.code,
        priorityName: priority && priority.discountRate > 0 ? priority.name : null,
        ...bm7,
      })
    }
    const totals = {
      grossAmount: rows.reduce((sum, row) => sum + row.grossAmount, 0),
      discountAmount: rows.reduce((sum, row) => sum + row.discountAmount, 0),
      netAmount: rows.reduce((sum, row) => sum + row.netAmount, 0),
      paidAmount: rows.reduce((sum, row) => sum + row.paidAmount, 0),
      outstandingAmount: rows.reduce((sum, row) => sum + row.outstandingAmount, 0),
    }
    return {
      term: this.termView(term),
      generatedAt: this.clock.now().toISOString(),
      maker,
      rows,
      totals,
      note: BM7_NOTE,
    }
  }

  async overview(termCode?: string): Promise<FinanceOverview> {
    const term = await this.termByCode(termCode)
    const figures = await this.bm7ForTerm(term.id)
    const values = [...figures.values()]
    const receipts = await this.prisma.receipt.findMany({
      where: { termId: term.id },
      select: { amount: true, channel: true, paidAt: true },
    })
    const collectedByChannel = { counter: 0, bankTransfer: 0 }
    const byDay = new Map<string, { counter: number; bankTransfer: number; total: number }>()
    for (const receipt of receipts) {
      const amount = Number(receipt.amount)
      if (receipt.channel === PaymentChannel.COUNTER) collectedByChannel.counter += amount
      else collectedByChannel.bankTransfer += amount
      const day = vietnamDay(receipt.paidAt)
      const bucket = byDay.get(day) ?? { counter: 0, bankTransfer: 0, total: 0 }
      if (receipt.channel === PaymentChannel.COUNTER) bucket.counter += amount
      else bucket.bankTransfer += amount
      bucket.total += amount
      byDay.set(day, bucket)
    }
    let cumulative = 0
    const daily = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => {
        cumulative += value.total
        return { date, ...value, cumulative }
      })
    const mustPay = values.reduce((sum, bm7) => sum + bm7.netAmount, 0)
    const now = this.clock.now()
    const settledCount = values.filter((bm7) => bm7.outstandingAmount <= 0).length
    const [unmatched, pairs, schedules] = await Promise.all([
      this.prisma.bankTransaction.count({ where: { status: BankTransactionStatus.UNMATCHED } }),
      this.prisma.student.groupBy({ by: ['cohortId', 'trainingSystemId'] }),
      this.prisma.feeSchedule.findMany({ select: { cohortId: true, trainingSystemId: true } }),
    ])
    const covered = new Set(schedules.map((item) => `${item.cohortId}:${item.trainingSystemId}`))
    const missing = pairs.filter(
      (pair) => !covered.has(`${pair.cohortId}:${pair.trainingSystemId}`),
    )
    const overdueCount = values.filter(
      (bm7) => bm7.outstandingAmount > 0 && now > term.tuitionDeadline,
    ).length

    return {
      term: this.termView(term),
      now: now.toISOString(),
      stats: {
        mustPay,
        collected: collectedByChannel.counter + collectedByChannel.bankTransfer,
        collectedByChannel,
        remaining: values.reduce((sum, bm7) => sum + bm7.outstandingAmount, 0),
        settledCount,
        studentCount: values.length,
        settledRatio: values.length ? Math.round((settledCount / values.length) * 100) : 0,
        overdueCount,
      },
      daily,
      todos: [
        {
          key: 'unmatched',
          title: 'Giao dịch chưa khớp',
          count: unmatched,
          detail: 'Cần Phòng Tài vụ gán thủ công.',
          href: '/staff/bank',
        },
        {
          key: 'overdue',
          title: 'Sinh viên còn nợ sau hạn đóng',
          count: overdueCount,
          detail: 'Danh sách BM7 gửi bộ phận khảo thí.',
          href: `/staff/bm7?termCode=${term.termCode}`,
        },
        {
          key: 'fees',
          title: '(Khoá, hệ) thiếu bảng phí',
          count: missing.length,
          detail: 'Học kỳ chính kế tiếp sẽ không chuyển sang Đăng ký được.',
          href: '/staff/fees',
        },
      ],
    }
  }

  private async ledger(studentId: number, termId: number): Promise<LedgerViewRow[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { studentId, termId },
      include: {
        enrollment: { include: { course: true, section: true } },
        receipt: {
          include: { bankTransaction: { select: { id: true, code: true } } },
        },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    let balance = 0
    return entries.map((entry) => {
      const signed =
        entry.direction === LedgerDirection.DEBIT ? Number(entry.amount) : -Number(entry.amount)
      balance += signed
      const course = entry.enrollment?.course
      const section = entry.enrollment?.section
      const detail =
        entry.type === LedgerEntryType.SURCHARGE && entry.enrollment
          ? `${ATTEMPT_LABEL[entry.enrollment.attemptType]} · ${entry.enrollment.credits} tín chỉ × ${Number(entry.enrollment.creditRate).toLocaleString('vi-VN')} đ`
          : entry.type === LedgerEntryType.BASE_TUITION
            ? entry.description
            : entry.discountRate
              ? `Giảm ${entry.discountRate}%`
              : course && section
                ? `${course.code} · ${section.code}`
                : null
      return {
        id: entry.id,
        at: entry.createdAt.toISOString(),
        type: entry.type,
        typeLabel: LEDGER_TYPE_LABEL[entry.type],
        description: entry.description ?? LEDGER_TYPE_LABEL[entry.type],
        detail,
        debit: entry.direction === LedgerDirection.DEBIT ? Number(entry.amount) : 0,
        credit: entry.direction === LedgerDirection.CREDIT ? Number(entry.amount) : 0,
        balance,
        actor: entry.createdBy?.fullName ?? 'Hệ thống',
        relatedEntryId: entry.relatedEntryId,
        receipt: entry.receipt
          ? {
              id: entry.receipt.id,
              number: entry.receipt.receiptNumber,
              bankTransactionId: entry.receipt.bankTransaction?.id ?? null,
              bankTransactionCode: entry.receipt.bankTransaction?.code ?? null,
            }
          : null,
        group: recalculationGroupOf(entry.description),
      }
    })
  }

  private async bm7For(studentId: number, termId: number): Promise<Bm7> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { studentId, termId },
      select: { type: true, direction: true, amount: true },
    })
    return bm7FromTotals(ledgerTotals(rows))
  }

  /** One grouped query for a whole term: BM7 for every student, still derived from ledger rows. */
  private async bm7ForTerm(termId: number): Promise<Map<number, Bm7>> {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['studentId', 'type', 'direction'],
      where: { termId },
      _sum: { amount: true },
    })
    const byStudent = new Map<number, GroupRow[]>()
    for (const row of grouped) {
      const rows = byStudent.get(row.studentId) ?? []
      rows.push({
        studentId: row.studentId,
        type: row.type,
        direction: row.direction,
        amount: row._sum.amount ?? 0n,
      })
      byStudent.set(row.studentId, rows)
    }
    return new Map(
      [...byStudent.entries()].map(([studentId, rows]) => [
        studentId,
        bm7FromTotals(ledgerTotals(rows)),
      ]),
    )
  }

  private async termByCode(termCode?: string): Promise<TermWithYear> {
    const term = await this.prisma.term.findUnique({
      where: { termCode: termCode ?? '20262' },
      include: { academicYear: true },
    })
    if (!term) throw this.notFound('học kỳ')
    return term
  }

  private termView(term: TermWithYear): FinanceTerm {
    return {
      code: term.termCode,
      name: termName(term),
      type: term.type,
      phase: term.phase,
      tuitionDeadline: term.tuitionDeadline.toISOString(),
    }
  }

  private notFound(entity: string): HttpException {
    return new HttpException({ code: 'NOT_FOUND', message: `Không tìm thấy ${entity}.` }, 404)
  }
}
