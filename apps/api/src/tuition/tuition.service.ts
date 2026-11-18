import { HttpException, Injectable, NotFoundException } from '@nestjs/common'

import { ReceivingAccountService } from '../finance/receiving-account.service'
import {
  AttemptType,
  LedgerDirection,
  LedgerEntryType,
  Prisma,
  TermPhase,
  TermType,
  type AcademicYear,
  type Term,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  missingFeeScheduleMessage,
  projectAfter,
  recalculationGroup,
  recalculationReason,
  recalculationGroupOf,
  type ProfileFacts,
} from './recalculation'

type Db = Prisma.TransactionClient | PrismaService

/** The three profile fields HS-14 says can change tuition; all other profile fields are plain edits. */
export type ProfileDraft = {
  cohortId: number
  trainingSystemId: number
  priorityGroupIds: number[]
}

type StudentWithProfile = {
  id: number
  studentCode: string
  cohortId: number
  trainingSystemId: number
  cohort: { code: string }
  trainingSystem: { code: string }
  priorityGroups: { priorityGroupId: number }[]
}

export type BeforeAfterRow = {
  baseTuition: number
  surcharge: number
  discount: number
  netAmount: number
  outstandingAmount: number
}

export type TuitionPreviewTerm = {
  termCode: string
  termName: string
  phase: TermPhase
  reason: string
  before: BeforeAfterRow
  after: BeforeAfterRow
  /** Amount moved to the next term when the new net amount is below what was already paid. */
  creditBalance: number
  blocked: { code: string; message: string } | null
}

export type TuitionPreview = {
  student: { studentCode: string; fullName: string }
  terms: TuitionPreviewTerm[]
}

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

type Totals = {
  debits: bigint
  credits: bigint
  charges: bigint
  chargeReversals: bigint
  discountCredits: bigint
  discountReversals: bigint
  carriedOut: bigint
  paid: bigint
}

type DebitType = typeof LedgerEntryType.BASE_TUITION | typeof LedgerEntryType.SURCHARGE

type OldDebit = {
  id: number
  type: DebitType
  amount: bigint
  enrollmentId: number | null
  courseCode: string | null
  attemptType: AttemptType | null
  discount: { id: number; amount: bigint; discountRate: number | null } | null
}

type NewDebit = {
  type: DebitType
  amount: bigint
  enrollmentId: number | null
  description: string
}

/** HP-12: everything the confirm step needs, computed once so preview and write cannot disagree. */
export type RecalculationPlan = {
  term: Term
  reason: string
  old: OldDebit[]
  next: NewDebit[]
  discount: { rate: number; name: string } | null
  before: BeforeAfterRow
  after: BeforeAfterRow
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
      /** HP-12: shared heading so every row of one recalculation groups in the ledger. */
      group?: string
      discount?: { rate: number; name: string } | null
    },
  ): Promise<{ entryId: number; net: bigint }> {
    const label = (text: string) => (args.group ? `${args.group} — ${text}` : text)
    const debit = await db.ledgerEntry.create({
      data: {
        studentId: args.studentId,
        termId: args.termId,
        type: args.type,
        direction: LedgerDirection.DEBIT,
        amount: args.amount,
        description: label(args.description),
        enrollmentId: args.enrollmentId ?? null,
        relatedEntryId: args.relatedEntryId ?? null,
        createdAt: args.createdAt ?? new Date(),
      },
    })
    const discount =
      args.discount === undefined ? await this.discountFor(db, args.studentId) : args.discount
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
          description: label(`Giảm ${discount.rate}% · ${discount.name} — ${args.description}`),
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

  private async totals(db: Db, studentId: number, termId: number): Promise<Totals> {
    const rows = await db.ledgerEntry.findMany({
      where: { studentId, termId },
      select: { type: true, direction: true, amount: true },
    })
    const totals: Totals = {
      debits: 0n,
      credits: 0n,
      charges: 0n,
      chargeReversals: 0n,
      discountCredits: 0n,
      discountReversals: 0n,
      carriedOut: 0n,
      paid: 0n,
    }
    for (const row of rows) {
      if (row.direction === LedgerDirection.DEBIT) {
        totals.debits += row.amount
        if (row.type === LedgerEntryType.BASE_TUITION || row.type === LedgerEntryType.SURCHARGE)
          totals.charges += row.amount
        if (row.type === LedgerEntryType.DISCOUNT_REVERSAL) totals.discountReversals += row.amount
        if (row.type === LedgerEntryType.BALANCE_CARRY_OUT) totals.carriedOut += row.amount
      } else {
        totals.credits += row.amount
        if (row.type === LedgerEntryType.DISCOUNT) totals.discountCredits += row.amount
        if (
          row.type === LedgerEntryType.BASE_TUITION_REVERSAL ||
          row.type === LedgerEntryType.SURCHARGE_REVERSAL
        )
          totals.chargeReversals += row.amount
        if (row.type === LedgerEntryType.PAYMENT || row.type === LedgerEntryType.BALANCE_CARRY_IN)
          totals.paid += row.amount
      }
    }
    return totals
  }

  /**
   * HP-09/ADR-0004: figures are derived, never stored. Append-only reversals cancel their originals,
   * so gross counts charges net of reversals plus any credit balance carried out; discount is net of
   * its reversal; paid is receipts plus carried-in balance. Gross − discount − paid always equals
   * Σdebit − Σcredit, which is what carries and overpayments actually move.
   */
  async bm7(db: Db, studentId: number, termId: number): Promise<Bm7> {
    const { charges, chargeReversals, discountCredits, discountReversals, carriedOut, paid } =
      await this.totals(db, studentId, termId)
    const gross = charges - chargeReversals + carriedOut
    const discount = discountCredits - discountReversals
    return {
      grossAmount: Number(gross),
      discountAmount: Number(discount),
      netAmount: Number(gross - discount),
      paidAmount: Number(paid),
      outstandingAmount: Number(gross - discount - paid),
    }
  }

  // ── HP-12 / HS-14: recalculation on a profile edit during an open registration window ──

  /** C.4.3: read-only BeforeAfter. Nothing here writes, so the officer can preview and cancel safely. */
  async preview(studentCode: string, draft: ProfileDraft): Promise<TuitionPreview> {
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: {
        cohort: true,
        trainingSystem: true,
        priorityGroups: { include: { priorityGroup: true } },
      },
    })
    if (!student)
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' })
    const base = {
      student: { studentCode: student.studentCode, fullName: student.fullName },
      terms: [] as TuitionPreviewTerm[],
    }
    const facts = await this.profileFacts(this.prisma, draft)
    const reason = recalculationReason(this.currentFacts(student), facts)
    if (!reason) return base

    for (const term of await this.openTerms(this.prisma)) {
      const planned = await this.planTerm(this.prisma, student, facts, term, reason)
      if (!planned) continue
      if ('blocked' in planned) {
        const before = await this.beforeRow(this.prisma, student.id, term.id, 0n, 0n)
        base.terms.push({
          termCode: term.termCode,
          termName: termName(term),
          phase: term.phase,
          reason,
          before,
          after: before,
          creditBalance: 0,
          blocked: planned.blocked,
        })
        continue
      }
      base.terms.push({
        termCode: term.termCode,
        termName: termName(term),
        phase: term.phase,
        reason,
        before: planned.before,
        after: planned.after,
        creditBalance: Math.max(0, -planned.after.outstandingAmount),
        blocked: null,
      })
    }
    return base
  }

  /**
   * Called inside the profile-edit transaction. A missing fee table blocks the whole PATCH; the
   * exception travels back to the officer with the exact "Liên hệ Phòng Tài vụ" wording.
   */
  async plansForUpdate(
    db: Prisma.TransactionClient,
    student: StudentWithProfile,
    draft: ProfileDraft,
    reason: string,
  ): Promise<RecalculationPlan[]> {
    const facts = await this.profileFacts(db, draft)
    const plans: RecalculationPlan[] = []
    for (const term of await this.openTerms(db)) {
      const planned = await this.planTerm(db, student, facts, term, reason)
      if (!planned) continue
      if ('blocked' in planned) {
        throw new HttpException(
          { code: planned.blocked.code, message: planned.blocked.message, termCode: term.termCode },
          409,
        )
      }
      plans.push(planned)
    }
    return plans
  }

  /** All rows of one run share a heading; the profile edit and these rows commit together. */
  async applyPlan(
    db: Prisma.TransactionClient,
    student: StudentWithProfile,
    plan: RecalculationPlan,
    audit: { actorId?: number; requestId?: string; ip?: string },
  ): Promise<void> {
    const actorId = audit.actorId ?? null
    const at = new Date()
    const group = recalculationGroup(plan.reason, at)
    for (const old of plan.old) {
      const reversalType =
        old.type === LedgerEntryType.BASE_TUITION
          ? LedgerEntryType.BASE_TUITION_REVERSAL
          : LedgerEntryType.SURCHARGE_REVERSAL
      await db.ledgerEntry.create({
        data: {
          studentId: student.id,
          termId: plan.term.id,
          type: reversalType,
          direction: LedgerDirection.CREDIT,
          amount: old.amount,
          description: `${group} — Đảo ${old.type === LedgerEntryType.BASE_TUITION ? 'học phí cố định' : 'phụ thu'}`,
          enrollmentId: old.enrollmentId,
          relatedEntryId: old.id,
          createdById: actorId,
          createdAt: at,
        },
      })
      if (!old.discount) continue
      await db.ledgerEntry.create({
        data: {
          studentId: student.id,
          termId: plan.term.id,
          type: LedgerEntryType.DISCOUNT_REVERSAL,
          direction: LedgerDirection.DEBIT,
          amount: old.discount.amount,
          discountRate: old.discount.discountRate,
          description: `${group} — Đảo giảm trừ`,
          enrollmentId: old.enrollmentId,
          relatedEntryId: old.discount.id,
          createdById: actorId,
          createdAt: at,
        },
      })
    }
    for (const next of plan.next) {
      await this.debit(db, {
        studentId: student.id,
        termId: plan.term.id,
        type: next.type,
        amount: next.amount,
        description: next.description,
        enrollmentId: next.enrollmentId ?? undefined,
        createdAt: at,
        group,
        discount: plan.discount,
      })
    }
    // HP-11: a negative outstanding amount is a credit balance. Payments are never reversed, and the
    // existing term-transition hook carries that surplus to the next term.
    await db.auditLog.create({
      data: {
        actorId,
        action: 'TUITION_RECALCULATED',
        entityType: 'Student',
        entityId: student.studentCode,
        payload: JSON.parse(
          JSON.stringify({
            termCode: plan.term.termCode,
            reason: plan.reason,
            group,
            before: plan.before,
            after: plan.after,
          }),
        ) as Prisma.InputJsonValue,
        requestId: audit.requestId ?? null,
        ip: audit.ip ?? null,
        createdAt: at,
      },
    })
  }

  private currentFacts(student: StudentWithProfile): ProfileFacts {
    return {
      cohortId: student.cohortId,
      trainingSystemId: student.trainingSystemId,
      cohortCode: student.cohort.code,
      trainingSystemCode: student.trainingSystem.code,
      priorityGroupIds: student.priorityGroups.map((link) => link.priorityGroupId),
    }
  }

  private async profileFacts(db: Db, draft: ProfileDraft): Promise<ProfileFacts> {
    const cohort = await db.cohort.findUniqueOrThrow({ where: { id: draft.cohortId } })
    const system = await db.trainingSystem.findUniqueOrThrow({
      where: { id: draft.trainingSystemId },
    })
    return {
      cohortId: cohort.id,
      trainingSystemId: system.id,
      cohortCode: cohort.code,
      trainingSystemCode: system.code,
      priorityGroupIds: [...draft.priorityGroupIds].sort((a, b) => a - b),
    }
  }

  private async openTerms(db: Db): Promise<Term[]> {
    return db.term.findMany({
      where: { phase: { in: [TermPhase.REGISTRATION, TermPhase.ADJUSTMENT] } },
      orderBy: { registrationStartAt: 'asc' },
    })
  }

  private async discountForDraft(db: Db, ids: number[]) {
    const groups = await db.priorityGroup.findMany({
      where: { id: { in: ids } },
      orderBy: { priority: 'desc' },
    })
    const best = groups[0]
    return best && best.discountRate > 0 ? { rate: best.discountRate, name: best.name } : null
  }

  private async activeDebits(db: Db, studentId: number, termId: number): Promise<OldDebit[]> {
    const debits = await db.ledgerEntry.findMany({
      where: {
        studentId,
        termId,
        type: { in: [LedgerEntryType.BASE_TUITION, LedgerEntryType.SURCHARGE] },
        direction: LedgerDirection.DEBIT,
      },
      include: { enrollment: { include: { course: true } } },
      orderBy: { id: 'asc' },
    })
    const reversals = await db.ledgerEntry.findMany({
      where: {
        studentId,
        termId,
        type: { in: [LedgerEntryType.BASE_TUITION_REVERSAL, LedgerEntryType.SURCHARGE_REVERSAL] },
        direction: LedgerDirection.CREDIT,
      },
      select: { relatedEntryId: true },
    })
    const discounts = await db.ledgerEntry.findMany({
      where: {
        studentId,
        termId,
        type: LedgerEntryType.DISCOUNT,
        direction: LedgerDirection.CREDIT,
      },
      include: {
        relatedFrom: { where: { type: LedgerEntryType.DISCOUNT_REVERSAL }, select: { id: true } },
      },
    })
    const reversed = new Set(reversals.map((row) => row.relatedEntryId))
    return debits
      .filter((debit) => !reversed.has(debit.id))
      .map((debit) => {
        const discount = discounts.find(
          (row) => row.relatedEntryId === debit.id && row.relatedFrom.length === 0,
        )
        return {
          id: debit.id,
          type: debit.type as DebitType,
          amount: debit.amount,
          enrollmentId: debit.enrollmentId,
          courseCode: debit.enrollment?.course.code ?? null,
          attemptType: debit.enrollment?.attemptType ?? null,
          discount: discount
            ? { id: discount.id, amount: discount.amount, discountRate: discount.discountRate }
            : null,
        }
      })
  }

  private async beforeRow(
    db: Db,
    studentId: number,
    termId: number,
    base: bigint,
    surcharge: bigint,
  ) {
    const bm7 = await this.bm7(db, studentId, termId)
    return {
      baseTuition: Number(base),
      surcharge: Number(surcharge),
      discount: bm7.discountAmount,
      netAmount: bm7.netAmount,
      outstandingAmount: bm7.outstandingAmount,
    }
  }

  private async planTerm(
    db: Db,
    student: StudentWithProfile,
    facts: ProfileFacts,
    term: Term,
    reason: string,
  ): Promise<RecalculationPlan | { blocked: { code: string; message: string } } | null> {
    const old = await this.activeDebits(db, student.id, term.id)
    // A profile created after the window opened has no charges in it; there is nothing to reverse or
    // re-post, so the edit is a plain save (and a missing fee table cannot block it).
    if (old.length === 0) return null
    const schedule =
      term.type === TermType.SUMMER
        ? null
        : await db.feeSchedule.findUnique({
            where: {
              cohortId_trainingSystemId: {
                cohortId: facts.cohortId,
                trainingSystemId: facts.trainingSystemId,
              },
            },
          })
    if (term.type !== TermType.SUMMER && !schedule)
      return {
        blocked: {
          code: 'MISSING_FEE_SCHEDULE',
          message: missingFeeScheduleMessage(facts.cohortCode, facts.trainingSystemCode),
        },
      }

    const oldBase = old.reduce(
      (sum, row) => sum + (row.type === LedgerEntryType.BASE_TUITION ? row.amount : 0n),
      0n,
    )
    const oldSurcharge = old.reduce(
      (sum, row) => sum + (row.type === LedgerEntryType.SURCHARGE ? row.amount : 0n),
      0n,
    )
    const oldDiscount = old.reduce((sum, row) => sum + (row.discount?.amount ?? 0n), 0n)
    const before = await this.beforeRow(db, student.id, term.id, oldBase, oldSurcharge)

    const discount = await this.discountForDraft(db, facts.priorityGroupIds)
    const next: NewDebit[] = []
    let newBase = 0n
    let newSurcharge = 0n
    if (schedule) {
      newBase = schedule.baseTuition
      next.push({
        type: LedgerEntryType.BASE_TUITION,
        amount: newBase,
        enrollmentId: null,
        description: `Học phí cố định ${termName(term)} (hồ sơ mới)`,
      })
    }
    for (const row of old) {
      if (row.type !== LedgerEntryType.SURCHARGE) continue
      const attempt = row.attemptType ? ATTEMPT_LABEL[row.attemptType] : 'Học lại'
      next.push({
        type: LedgerEntryType.SURCHARGE,
        amount: row.amount,
        enrollmentId: row.enrollmentId,
        description: `Phụ thu ${row.courseCode ?? ''} (${attempt})`,
      })
      newSurcharge += row.amount
    }
    const newDiscount = next.reduce(
      (sum, row) => sum + (discount ? discountOf(row.amount, discount.rate) : 0n),
      0n,
    )

    const bm7 = await this.bm7(db, student.id, term.id)
    const afterBm7 = projectAfter(
      bm7,
      oldBase + oldSurcharge,
      oldDiscount,
      newBase + newSurcharge,
      newDiscount,
    )
    return {
      term,
      reason,
      old,
      next,
      discount,
      before,
      after: {
        baseTuition: Number(newBase),
        surcharge: Number(newSurcharge),
        discount: Number(newDiscount),
        netAmount: afterBm7.netAmount,
        outstandingAmount: afterBm7.outstandingAmount,
      },
    }
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
          const group = recalculationGroupOf(description)
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
