import { HttpException, Injectable } from '@nestjs/common'

import { ReceivingAccountService } from '../finance/receiving-account.service'
import {
  AttemptType,
  LedgerDirection,
  LedgerEntryType,
  Prisma,
  TermType,
  type AcademicYear,
  type Term,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type Db = Prisma.TransactionClient | PrismaService

/** HP-01: a missing pair blocks the whole phase transition, so the warning travels with the error. */
export class MissingFeeScheduleError extends Error {
  constructor(readonly pairs: string[]) {
    super(`Thiếu bảng phí cho ${pairs.join(', ')}. Học kỳ không chuyển sang Đăng ký.`)
  }
}

/** HP-06: BigInt division truncates towards zero, i.e. rounds down for amounts ≥ 0. */
export const discountOf = (amount: bigint, rate: number) => (amount * BigInt(rate)) / 100n

export function termName(term: Term & { academicYear?: AcademicYear }): string {
  const kind =
    term.type === TermType.SUMMER ? 'HK hè' : term.type === TermType.FIRST ? 'HK1' : 'HK2'
  const year = term.academicYear?.startYear ?? Number(term.termCode.slice(0, 4))
  return `${kind} ${year}–${year + 1}`
}

export type Bm7 = {
  grossAmount: number
  discountAmount: number
  netAmount: number
  paidAmount: number
  outstandingAmount: number
}

export type LedgerRow = {
  id: number
  date: string
  label: string
  detail: string | null
  /** Signed: debits are positive, credits negative. */
  amount: number
  type: LedgerEntryType
  receiptId: number | null
  receiptNumber: string | null
  group: string | null
}

export type TuitionTermOption = {
  code: string
  name: string
  type: TermType
  tuitionDeadline: string
  outstandingAmount: number
}

export type TuitionOverview = {
  student: {
    studentCode: string
    fullName: string
    email: string | null
    cohortCode: string
    trainingSystemCode: string
  }
  terms: TuitionTermOption[]
  selected: {
    code: string
    name: string
    type: TermType
    phase: string
    tuitionDeadline: string
    paymentCode: string
    bm7: Bm7
    priority: { name: string; rate: number } | null
    ledger: LedgerRow[]
    payment: { gateway: string; accountNumber: string; accountName: string }
  } | null
}

export type LedgerTotals = {
  debits: bigint
  credits: bigint
  discountCredits: bigint
  discountReversals: bigint
}

/** HP-09: the one fold used by the student portal and by the finance office's BM7 report. */
export function ledgerTotals(
  rows: readonly { type: LedgerEntryType; direction: LedgerDirection; amount: bigint }[],
): LedgerTotals {
  const totals: LedgerTotals = {
    debits: 0n,
    credits: 0n,
    discountCredits: 0n,
    discountReversals: 0n,
  }
  for (const row of rows) {
    if (row.direction === LedgerDirection.DEBIT) {
      totals.debits += row.amount
      if (row.type === LedgerEntryType.DISCOUNT_REVERSAL) totals.discountReversals += row.amount
    } else {
      totals.credits += row.amount
      if (row.type === LedgerEntryType.DISCOUNT) totals.discountCredits += row.amount
    }
  }
  return totals
}

export function bm7FromTotals(totals: LedgerTotals): Bm7 {
  const gross = totals.debits - totals.discountReversals
  const discount = totals.discountCredits - totals.discountReversals
  const paid = totals.credits - totals.discountCredits
  return {
    grossAmount: Number(gross),
    discountAmount: Number(discount),
    netAmount: Number(gross - discount),
    paidAmount: Number(paid),
    outstandingAmount: Number(gross - discount - paid),
  }
}

const ATTEMPT_LABEL: Record<AttemptType, string> = {
  FIRST: 'Lần đầu',
  RETAKE: 'Học lại',
  IMPROVEMENT: 'Cải thiện',
}

/**
 * ADR-0003/0004 + HP-02..06, HP-09, HP-11: the single place that turns registration/profile facts into
 * append-only ledger rows, and turns those rows back into the three BM7 figures. Every write takes the
 * caller's transaction so it commits (or rolls back) with the business event that caused it.
 */
@Injectable()
export class TuitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ReceivingAccountService,
  ) {}

  /** HS-02: only the highest-priority group applies; the rate is frozen on the ledger row at posting. */
  async discountFor(db: Db, studentId: number): Promise<{ rate: number; name: string } | null> {
    const links = await db.studentPriorityGroup.findMany({
      where: { studentId },
      include: { priorityGroup: true },
      orderBy: { priorityGroup: { priority: 'desc' } },
    })
    const best = links[0]?.priorityGroup
    return best && best.discountRate > 0 ? { rate: best.discountRate, name: best.name } : null
  }

  /** One debit plus its HP-06 discount credit, both pointing at each other. */
  async debit(
    db: Db,
    args: {
      studentId: number
      termId: number
      type: typeof LedgerEntryType.BASE_TUITION | typeof LedgerEntryType.SURCHARGE
      amount: bigint
      description: string
      enrollmentId?: number
      relatedEntryId?: number
      createdAt?: Date
    },
  ): Promise<{ entryId: number; net: bigint }> {
    const debit = await db.ledgerEntry.create({
      data: {
        studentId: args.studentId,
        termId: args.termId,
        type: args.type,
        direction: LedgerDirection.DEBIT,
        amount: args.amount,
        description: args.description,
        enrollmentId: args.enrollmentId ?? null,
        relatedEntryId: args.relatedEntryId ?? null,
        createdAt: args.createdAt ?? new Date(),
      },
    })
    const discount = await this.discountFor(db, args.studentId)
    const amount = discount ? discountOf(args.amount, discount.rate) : 0n
    if (discount && amount > 0n) {
      await db.ledgerEntry.create({
        data: {
          studentId: args.studentId,
          termId: args.termId,
          type: LedgerEntryType.DISCOUNT,
          direction: LedgerDirection.CREDIT,
          amount,
          discountRate: discount.rate,
          description: `Giảm ${discount.rate}% · ${discount.name} — ${args.description}`,
          enrollmentId: args.enrollmentId ?? null,
          relatedEntryId: debit.id,
          createdAt: args.createdAt ?? new Date(),
        },
      })
    }
    return { entryId: debit.id, net: args.amount - amount }
  }

  /** HP-02: fixed tuition for one main term. Returns false only when the caller chose to skip a pair. */
  async postBaseTuition(
    db: Db,
    term: Term,
    student: { id: number; cohortId: number; trainingSystemId: number },
    schedule: { baseTuition: bigint },
  ): Promise<void> {
    await this.debit(db, {
      studentId: student.id,
      termId: term.id,
      type: LedgerEntryType.BASE_TUITION,
      amount: schedule.baseTuition,
      description: `Học phí cố định ${termName(term)}`,
    })
  }

  /** HP-03/04: credits and unit price were frozen on the enrollment; only the discount is resolved now. */
  async postSurcharge(
    db: Db,
    args: {
      enrollmentId: number
      studentId: number
      termId: number
      courseCode: string
      attemptType: AttemptType
      surcharge: bigint
      registeredAt: Date
    },
  ): Promise<void> {
    if (args.surcharge <= 0n) return
    await this.debit(db, {
      studentId: args.studentId,
      termId: args.termId,
      type: LedgerEntryType.SURCHARGE,
      amount: args.surcharge,
      description: `Phụ thu ${args.courseCode} (${ATTEMPT_LABEL[args.attemptType]})`,
      enrollmentId: args.enrollmentId,
      createdAt: args.registeredAt,
    })
  }

  /** HP-05: reversals are new rows; retries never add a second pair. Safe for manual and automatic cancels. */
  async reverseSurcharge(
    db: Db,
    args: {
      enrollmentId: number
      studentId: number
      termId: number
      sectionCode: string
      at: Date
    },
  ): Promise<void> {
    const posted = await db.ledgerEntry.findFirst({
      where: {
        enrollmentId: args.enrollmentId,
        type: LedgerEntryType.SURCHARGE,
        direction: LedgerDirection.DEBIT,
      },
      orderBy: { id: 'asc' },
    })
    if (!posted) return
    const already = await db.ledgerEntry.findFirst({
      where: { enrollmentId: args.enrollmentId, type: LedgerEntryType.SURCHARGE_REVERSAL },
    })
    if (already) return

    await db.ledgerEntry.create({
      data: {
        studentId: args.studentId,
        termId: args.termId,
        type: LedgerEntryType.SURCHARGE_REVERSAL,
        direction: LedgerDirection.CREDIT,
        amount: posted.amount,
        description: `Huỷ ${args.sectionCode} · Đảo phụ thu`,
        enrollmentId: args.enrollmentId,
        relatedEntryId: posted.id,
        createdAt: args.at,
      },
    })
    const discount = await db.ledgerEntry.findFirst({
      where: {
        relatedEntryId: posted.id,
        type: LedgerEntryType.DISCOUNT,
        direction: LedgerDirection.CREDIT,
      },
    })
    if (!discount) return
    const reversed = await db.ledgerEntry.findFirst({
      where: { relatedEntryId: discount.id, type: LedgerEntryType.DISCOUNT_REVERSAL },
    })
    if (reversed) return
    await db.ledgerEntry.create({
      data: {
        studentId: args.studentId,
        termId: args.termId,
        type: LedgerEntryType.DISCOUNT_REVERSAL,
        direction: LedgerDirection.DEBIT,
        amount: discount.amount,
        discountRate: discount.discountRate,
        description: `Huỷ ${args.sectionCode} · Đảo giảm trừ`,
        enrollmentId: args.enrollmentId,
        relatedEntryId: discount.id,
        createdAt: args.at,
      },
    })
  }

  /** HP-11: a negative previous-term balance becomes a DEBIT there and a CREDIT in the new term. */
  async carryBalance(
    db: Db,
    term: Term,
    previous: Term & { academicYear?: AcademicYear },
    studentId: number,
  ): Promise<void> {
    const totals = await this.totals(db, studentId, previous.id)
    const balance = totals.credits - totals.debits
    if (balance <= 0n) return
    const out = await db.ledgerEntry.create({
      data: {
        studentId,
        termId: previous.id,
        type: LedgerEntryType.BALANCE_CARRY_OUT,
        direction: LedgerDirection.DEBIT,
        amount: balance,
        description: `Chuyển số dư có sang ${termName(term)}`,
      },
    })
    await db.ledgerEntry.create({
      data: {
        studentId,
        termId: term.id,
        type: LedgerEntryType.BALANCE_CARRY_IN,
        direction: LedgerDirection.CREDIT,
        amount: balance,
        description: `Số dư có chuyển từ ${termName(previous)}`,
        relatedEntryId: out.id,
      },
    })
  }

  private async totals(db: Db, studentId: number, termId: number): Promise<LedgerTotals> {
    const rows = await db.ledgerEntry.findMany({
      where: { studentId, termId },
      select: { type: true, direction: true, amount: true },
    })
    return ledgerTotals(rows)
  }

  /**
   * HP-09/ADR-0004: figures are derived, never stored. gross excludes discount reversals (they undo a
   * credit), discount is net of its reversal, and every other credit (payment, surcharge reversal,
   * carried balance) reduces what is left to pay. The identity gross − discount − paid = Σdebit − Σcredit
   * keeps the three columns consistent with the append-only ledger.
   */
  async bm7(db: Db, studentId: number, termId: number): Promise<Bm7> {
    return bm7FromTotals(await this.totals(db, studentId, termId))
  }

  /** B.4.4: newest first, plain-language labels, payment code and deadline for the student portal. */
  async overview(userId: number, termCode?: string): Promise<TuitionOverview> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        cohort: true,
        trainingSystem: true,
        user: { select: { email: true } },
        priorityGroups: { include: { priorityGroup: true } },
      },
    })
    if (!student)
      throw new HttpException(
        { code: 'NO_STUDENT_PROFILE', message: 'Không tìm thấy hồ sơ sinh viên.' },
        403,
      )

    const terms = await this.prisma.term.findMany({
      include: { academicYear: true },
      orderBy: { registrationStartAt: 'desc' },
    })
    const withTotals: { term: (typeof terms)[number]; bm7: Bm7 }[] = []
    for (const term of terms)
      withTotals.push({ term, bm7: await this.bm7(this.prisma, student.id, term.id) })
    const visible = withTotals.filter(
      ({ term, bm7 }) =>
        bm7.outstandingAmount !== 0 ||
        ['REGISTRATION', 'ADJUSTMENT', 'IN_PROGRESS'].includes(term.phase),
    )
    const options: TuitionTermOption[] = visible.map(({ term, bm7 }) => ({
      code: term.termCode,
      name: termName(term),
      type: term.type,
      tuitionDeadline: term.tuitionDeadline.toISOString(),
      outstandingAmount: bm7.outstandingAmount,
    }))
    const chosen = termCode
      ? (visible.find(({ term }) => term.termCode === termCode) ?? visible[0])
      : (visible.find(({ bm7 }) => bm7.outstandingAmount > 0) ?? visible[0])
    if (!chosen) {
      return {
        student: {
          studentCode: student.studentCode,
          fullName: student.fullName,
          email: student.user.email,
          cohortCode: student.cohort.code,
          trainingSystemCode: student.trainingSystem.code,
        },
        terms: options,
        selected: null,
      }
    }
    const term = chosen.term
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { studentId: student.id, termId: term.id },
      include: { enrollment: { include: { section: true, course: true } }, receipt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const priorityGroups = student.priorityGroups
      .map((link) => link.priorityGroup)
      .sort((a, b) => b.priority - a.priority)
    const best = priorityGroups[0]
    const account = await this.accounts.current()

    return {
      student: {
        studentCode: student.studentCode,
        fullName: student.fullName,
        email: student.user.email,
        cohortCode: student.cohort.code,
        trainingSystemCode: student.trainingSystem.code,
      },
      terms: options,
      selected: {
        code: term.termCode,
        name: termName(term),
        type: term.type,
        phase: term.phase,
        tuitionDeadline: term.tuitionDeadline.toISOString(),
        paymentCode: `HP${student.studentCode}${term.termCode}`,
        bm7: chosen.bm7,
        priority:
          best && best.discountRate > 0 ? { name: best.name, rate: best.discountRate } : null,
        ledger: entries.map((entry): LedgerRow => {
          const course = entry.enrollment?.course
          const section = entry.enrollment?.section
          const description = entry.description ?? ''
          const group = description.includes('Tính lại') ? 'Tính lại học phí' : null
          const detail =
            entry.type === LedgerEntryType.BASE_TUITION
              ? `Khoá ${student.cohort.code.replace(/^K/, '')} · ${student.trainingSystem.code}`
              : entry.type === LedgerEntryType.SURCHARGE && entry.enrollment
                ? `${ATTEMPT_LABEL[entry.enrollment.attemptType]} · ${entry.enrollment.credits} tín chỉ × ${Number(entry.enrollment.creditRate).toLocaleString('vi-VN')} đ`
                : course && section
                  ? `${course.code} · ${section.code}`
                  : null
          return {
            id: entry.id,
            date: entry.createdAt.toISOString(),
            label: description || this.defaultLabel(entry.type),
            detail,
            amount:
              entry.direction === LedgerDirection.DEBIT
                ? Number(entry.amount)
                : -Number(entry.amount),
            type: entry.type,
            receiptId: entry.receiptId,
            receiptNumber: entry.receipt?.receiptNumber ?? null,
            group,
          }
        }),
        payment: {
          gateway: account.gateway,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
        },
      },
    }
  }

  private defaultLabel(type: LedgerEntryType): string {
    switch (type) {
      case LedgerEntryType.BASE_TUITION:
        return 'Học phí cố định'
      case LedgerEntryType.SURCHARGE:
        return 'Phụ thu'
      case LedgerEntryType.DISCOUNT:
        return 'Giảm trừ'
      case LedgerEntryType.PAYMENT:
        return 'Thanh toán'
      case LedgerEntryType.BALANCE_CARRY_IN:
        return 'Số dư có chuyển sang học kỳ này'
      default:
        return 'Đảo khoản thu'
    }
  }
}
