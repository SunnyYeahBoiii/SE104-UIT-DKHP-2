import { HttpException, Injectable } from '@nestjs/common'

import { Clock } from '../academics/clock'
import {
  formatVnDateTime,
  termPhase,
  type MilestoneValues,
  type TermPhase,
} from '../academics/term-policy'
import {
  AttemptType,
  CourseType,
  EnrollmentStatus,
  LedgerDirection,
  LedgerEntryType,
  Prisma,
  type AcademicYear,
  type Course,
  type CourseSection,
  type Enrollment,
  type RegistrationForm,
  type RegistrationSlot,
  type RegistrationSlotCohort,
  type Term,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RegistrationIdempotency } from './idempotency'
import { prerequisiteCheck, studentAttempts } from './prerequisites'
import {
  attemptTypeOf,
  effectiveResult,
  ruleExit,
  ruleMessage,
  type RegistrationRule,
} from './policy'
import type { RegisterInput, SectionFilters } from './validation'

/** Test seam: E2E freezes the demo day instead of depending on the real clock (A.7 "now"). */
@Injectable()
export class RegistrationClock extends Clock {
  override now(): Date {
    const demo = process.env.DKHP_REGISTRATION_NOW
    return demo && process.env.NODE_ENV !== 'production' ? new Date(demo) : super.now()
  }
}

type TermRecord = Term & {
  academicYear: AcademicYear
  registrationSlots: (RegistrationSlot & { cohorts: RegistrationSlotCohort[] })[]
}

type StudentRecord = {
  id: number
  userId: number
  studentCode: string
  fullName: string
  cohort: { id: number; code: string; admissionYear: number }
  trainingSystem: { id: number; code: string; name: string }
}

export type PermissionState = 'OPEN' | 'BEFORE_SLOT' | 'OUTSIDE_SLOT' | 'NO_TERM' | 'FINALIZED'
export type Permission = {
  state: PermissionState
  phase: TermPhase
  message: string
  countdownTo: string | null
}

export type SectionView = {
  id: number
  code: string
  courseCode: string
  courseName: string
  courseType: CourseType
  credits: number
  attemptType: AttemptType
  capacity: number
  enrolledCount: number
  remaining: number
  lecturer: string | null
  language: string | null
  reservedAdmissionYear: number | null
  note: string | null
  practiceMode: string | null
  parentSectionId: number | null
  days: number[]
  registered: boolean
  prerequisite: { state: 'OK' | 'MISSING' | 'CONDITIONAL'; message: string | null }
}

export type FormRowView = {
  id: number
  sectionId: number
  sectionCode: string
  courseCode: string
  courseName: string
  credits: number
  attemptType: AttemptType
  status: string
  registeredAt: string
  cancelledAt: string | null
  pendingPrerequisite: boolean
  cancellationReason: string | null
}

export type FormView = {
  id: number | null
  totalCredits: number
  maxCredits: number
  finalizedAt: string | null
  rows: FormRowView[]
  cancelled: FormRowView[]
}

export type RegistrationResult = {
  sectionId: number
  sectionCode: string
  ok: boolean
  enrollmentId?: number
  attemptType?: AttemptType
  code?: RegistrationRule
  message?: string
  exit?: string
}

type Context = {
  student: StudentRecord
  term: TermRecord
  permission: Permission
  form: FormView
  formId: number | null
}

const milestonesOf = (term: Term): MilestoneValues => ({
  registrationStartAt: term.registrationStartAt,
  registrationEndAt: term.registrationEndAt,
  adjustmentStartAt: term.adjustmentStartAt,
  adjustmentEndAt: term.adjustmentEndAt,
  tuitionDeadline: term.tuitionDeadline,
})

const termName = (term: TermRecord): string => {
  const kind = term.type === 'SUMMER' ? 'HK hè' : term.type === 'FIRST' ? 'HK1' : 'HK2'
  return `${kind} ${term.academicYear.startYear}–${term.academicYear.startYear + 1}`
}

/** DK-02: one gating decision shared by the read model and both write paths. */
export function permissionFor(
  term: TermRecord | null,
  student: StudentRecord,
  now: Date,
): Permission {
  if (!term)
    return {
      state: 'NO_TERM',
      phase: 'CLOSED',
      message: 'Hiện không có đợt đăng ký nào.',
      countdownTo: null,
    }
  const phase = termPhase(milestonesOf(term), now)
  if (phase === 'ADJUSTMENT')
    return {
      state: 'OPEN',
      phase,
      message: `Giai đoạn Điều chỉnh, mở cho mọi khoá đến ${formatVnDateTime(term.adjustmentEndAt)}.`,
      countdownTo: term.adjustmentEndAt.toISOString(),
    }
  if (phase === 'REGISTRATION') {
    const slots = term.registrationSlots
      .filter((slot) => slot.cohorts.some((cohort) => cohort.cohortId === student.cohort.id))
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
    const active = slots.find((slot) => now >= slot.startAt && now < slot.endAt)
    if (active)
      return {
        state: 'OPEN',
        phase,
        message: `Bạn đang trong khung giờ đăng ký đến ${formatVnDateTime(active.endAt)}.`,
        countdownTo: active.endAt.toISOString(),
      }
    const next = slots.find((slot) => slot.startAt > now)
    return {
      state: next ? 'BEFORE_SLOT' : 'OUTSIDE_SLOT',
      phase,
      message: next
        ? `Chưa tới khung giờ của Khoá ${student.cohort.code.replace(/^K/, '')}. Mở lúc ${formatVnDateTime(next.startAt)}.`
        : `Khoá ${student.cohort.code.replace(/^K/, '')} chưa có khung giờ trong giai đoạn Đăng ký.`,
      countdownTo: next?.startAt.toISOString() ?? null,
    }
  }
  if (phase === 'PREPARATION')
    return {
      state: 'BEFORE_SLOT',
      phase,
      message: `Chưa tới khung giờ của Khoá ${student.cohort.code.replace(/^K/, '')}.`,
      countdownTo: term.registrationStartAt.toISOString(),
    }
  return {
    state: 'NO_TERM',
    phase,
    message: 'Đợt đăng ký đã kết thúc.',
    countdownTo: null,
  }
}

class RuleFailure extends Error {
  constructor(
    readonly rule: RegistrationRule,
    readonly detail: Record<string, string> = {},
  ) {
    super(ruleMessage(rule, detail))
  }

  result(sectionId: number): RegistrationResult {
    return {
      sectionId,
      sectionCode: this.detail.code ?? String(sectionId),
      ok: false,
      code: this.rule,
      message: this.message,
      exit: ruleExit(this.rule, this.detail),
    }
  }
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: RegistrationClock,
    private readonly idempotency: RegistrationIdempotency,
  ) {}

  async overview(userId: number, filters: SectionFilters) {
    const { student, term, permission, form } = await this.context(userId)
    const sections = term ? await this.sections(term, student, form, filters) : []
    return {
      now: this.clock.now().toISOString(),
      term: term
        ? {
            code: term.termCode,
            name: termName(term),
            phase: termPhase(milestonesOf(term), this.clock.now()),
            registrationStartAt: term.registrationStartAt.toISOString(),
            adjustmentEndAt: term.adjustmentEndAt.toISOString(),
          }
        : null,
      permission,
      student: {
        studentCode: student.studentCode,
        fullName: student.fullName,
        cohortCode: student.cohort.code,
        trainingSystemCode: student.trainingSystem.code,
        trainingSystemName: student.trainingSystem.name,
        admissionYear: student.cohort.admissionYear,
      },
      sections,
      form,
    }
  }

  /** DK-18: every section is judged in its own transaction; one failure never rolls back its siblings. */
  async register(userId: number, idempotencyKey: string, input: RegisterInput) {
    return this.idempotency.run('register', userId, idempotencyKey, async () => {
      await this.idempotency.checkRate(userId)
      const context = await this.context(userId)
      const accepted: number[][] = []
      const results: RegistrationResult[] = []
      for (const sectionId of input.sectionIds) {
        try {
          const winner = await this.registerOne(context, sectionId, accepted)
          results.push(winner)
          if (winner.ok) {
            const section = await this.prisma.courseSection.findUniqueOrThrow({
              where: { id: sectionId },
              include: { offeredCourse: { include: { course: true } } },
            })
            accepted.push(await this.equivalenceIds(section.offeredCourse.course))
          }
        } catch (error) {
          if (error instanceof RuleFailure) {
            results.push(error.result(sectionId))
            continue
          }
          throw error
        }
      }
      const fresh = await this.context(userId)
      return { results, form: fresh.form, permission: fresh.permission }
    })
  }

  async cancel(userId: number, idempotencyKey: string, enrollmentId: number) {
    return this.idempotency.run('cancel', userId, idempotencyKey, async () => {
      await this.idempotency.checkRate(userId)
      return this.prisma.$transaction(async (tx) => {
        const student = await this.loadStudent(userId, tx)
        const termRecord = await this.openTerm(tx)
        const permission = permissionFor(termRecord, student, this.clock.now())
        if (permission.state !== 'OPEN')
          this.fail('OUTSIDE_REGISTRATION_WINDOW', permission.message, 409)
        if (!termRecord) this.fail('OUTSIDE_REGISTRATION_WINDOW', permission.message, 409)

        const enrollment = await tx.enrollment.findUnique({
          where: { id: enrollmentId },
          include: { form: true, section: true },
        })
        if (
          !enrollment ||
          enrollment.form.studentId !== student.id ||
          enrollment.form.termId !== termRecord.id ||
          enrollment.status !== EnrollmentStatus.REGISTERED
        )
          this.fail(
            'ENROLLMENT_NOT_ACTIVE',
            'Dòng đăng ký này không còn hiệu lực trong đợt đăng ký.',
            409,
          )
        if (enrollment.form.finalizedAt)
          this.fail('FORM_FINALIZED', 'Phiếu đã chốt. Không còn huỷ lớp được.', 409)

        return this.cancelActive(tx, enrollment, this.clock.now())
      })
    })
  }

  /**
   * DK-06/DK-11/HP-05: the one cancellation path for the student route and the daily job. Locks the
   * student then the sections in id order (ADR-0005), cancels the companion row both ways, returns
   * seats and reverses any posted surcharge/discount. The status guard makes a retry a no-op.
   */
  async cancelActive(
    tx: Prisma.TransactionClient,
    enrollment: Enrollment & { form: RegistrationForm; section: CourseSection },
    at: Date,
    reason: string | null = null,
  ) {
    await tx.$queryRaw`SELECT id FROM student WHERE id = ${enrollment.form.studentId} FOR UPDATE`
    const companions = enrollment.section.parentSectionId
      ? await tx.enrollment.findMany({
          where: {
            formId: enrollment.formId,
            status: 'REGISTERED',
            id: { not: enrollment.id },
            section: {
              OR: [
                { id: enrollment.section.parentSectionId },
                { parentSectionId: enrollment.sectionId },
              ],
            },
          },
          include: { section: true },
        })
      : await tx.enrollment.findMany({
          where: {
            formId: enrollment.formId,
            status: 'REGISTERED',
            id: { not: enrollment.id },
            section: { parentSectionId: enrollment.sectionId },
          },
          include: { section: true },
        })
    const rows = [enrollment, ...companions]
    const sectionIds = [...new Set(rows.map((row) => row.sectionId))].sort((a, b) => a - b)
    for (const id of sectionIds)
      await tx.$queryRaw`SELECT id FROM course_section WHERE id = ${id} FOR UPDATE`

    const cancelled: number[] = []
    for (const row of rows) {
      const changed = await tx.enrollment.updateMany({
        where: { id: row.id, status: 'REGISTERED' },
        data: { status: 'CANCELLED', cancelledAt: at, cancellationReason: reason },
      })
      if (changed.count !== 1) continue
      cancelled.push(row.id)
      const released = await tx.$executeRaw`
        UPDATE course_section SET enrolled_count = enrolled_count - 1, updated_at = now()
        WHERE id = ${row.sectionId} AND enrolled_count > 0`
      if (released !== 1)
        this.fail('SEAT_RELEASE_FAILED', 'Không trả được chỗ. Vui lòng thử lại.', 409)
      await this.reverseFees(tx, row, at)
    }
    const section = await tx.courseSection.findUniqueOrThrow({
      where: { id: enrollment.sectionId },
    })
    return {
      enrollmentId: enrollment.id,
      sectionId: enrollment.sectionId,
      sectionCode: enrollment.section.code,
      cancelledIds: cancelled,
      status: 'CANCELLED',
      remaining: section.capacity - section.enrolledCount,
    }
  }

  /** ADR-0004: append reversal rows only, and only once per posted surcharge/discount. */
  private async reverseFees(
    tx: Prisma.TransactionClient,
    row: Enrollment & { section: CourseSection },
    at: Date,
  ): Promise<void> {
    const label = row.section.code
    const debits = await tx.ledgerEntry.findMany({
      where: { enrollmentId: row.id, type: LedgerEntryType.SURCHARGE },
      select: { id: true, amount: true, studentId: true, termId: true },
    })
    for (const debit of debits) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { relatedEntryId: debit.id, type: LedgerEntryType.SURCHARGE_REVERSAL },
        select: { id: true },
      })
      if (existing) continue
      await tx.ledgerEntry.create({
        data: {
          studentId: debit.studentId,
          termId: debit.termId,
          type: LedgerEntryType.SURCHARGE_REVERSAL,
          direction: LedgerDirection.CREDIT,
          amount: debit.amount,
          enrollmentId: row.id,
          relatedEntryId: debit.id,
          description: `Huỷ ${label}: đảo phụ thu`,
          createdAt: at,
        },
      })
      const discounts = await tx.ledgerEntry.findMany({
        where: { relatedEntryId: debit.id, type: LedgerEntryType.DISCOUNT },
        select: { id: true, amount: true, studentId: true, termId: true, discountRate: true },
      })
      for (const discount of discounts) {
        const reversed = await tx.ledgerEntry.findFirst({
          where: { relatedEntryId: discount.id, type: LedgerEntryType.DISCOUNT_REVERSAL },
          select: { id: true },
        })
        if (reversed) continue
        await tx.ledgerEntry.create({
          data: {
            studentId: discount.studentId,
            termId: discount.termId,
            type: LedgerEntryType.DISCOUNT_REVERSAL,
            direction: LedgerDirection.DEBIT,
            amount: discount.amount,
            discountRate: discount.discountRate,
            enrollmentId: row.id,
            relatedEntryId: discount.id,
            description: `Huỷ ${label}: đảo giảm trừ`,
            createdAt: at,
          },
        })
      }
    }
  }

  private fail(code: string, message: string, status: number): never {
    throw new HttpException({ code, message }, status)
  }

  private async context(userId: number): Promise<Context> {
    const student = await this.loadStudent(userId)
    const term = await this.openTerm()
    if (!term) {
      const upcoming = await this.prisma.term.findFirst({
        where: { phase: 'PREPARATION', registrationStartAt: { gt: this.clock.now() } },
        orderBy: { registrationStartAt: 'asc' },
        include: {
          academicYear: true,
          registrationSlots: { include: { cohorts: true } },
        },
      })
      const fallback =
        upcoming ??
        (await this.prisma.term.findFirst({
          orderBy: { registrationStartAt: 'desc' },
          include: { academicYear: true, registrationSlots: { include: { cohorts: true } } },
        }))
      if (!fallback) this.fail('NO_TERM', 'Chưa có học kỳ nào trong hệ thống.', 404)
      return {
        student,
        term: fallback,
        permission: permissionFor(fallback, student, this.clock.now()),
        form: emptyForm(),
        formId: null,
      }
    }
    const permission = permissionFor(term, student, this.clock.now())
    const row = await this.prisma.registrationForm.findUnique({
      where: { studentId_termId: { studentId: student.id, termId: term.id } },
      include: {
        enrollments: {
          include: { section: true, course: true },
          orderBy: { registeredAt: 'asc' },
        },
      },
    })
    const form = row ? this.formView(row, term.maxCredits) : emptyForm(term.maxCredits)
    if (row?.finalizedAt)
      return {
        student,
        term,
        permission: {
          state: 'FINALIZED',
          phase: permission.phase,
          message: `Phiếu đã chốt ngày ${formatVnDateTime(row.finalizedAt)}. Không còn huỷ lớp được.`,
          countdownTo: null,
        },
        form,
        formId: row.id,
      }
    return { student, term, permission, form, formId: row?.id ?? null }
  }

  private async openTerm(db: Prisma.TransactionClient | PrismaService = this.prisma) {
    return db.term.findFirst({
      where: { phase: { in: ['REGISTRATION', 'ADJUSTMENT'] } },
      orderBy: { registrationStartAt: 'asc' },
      include: { academicYear: true, registrationSlots: { include: { cohorts: true } } },
    }) as Promise<TermRecord | null>
  }

  private async loadStudent(
    userId: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<StudentRecord> {
    const student = await db.student.findUnique({
      where: { userId },
      include: { cohort: true, trainingSystem: true },
    })
    if (!student) this.fail('NO_STUDENT_PROFILE', 'Không tìm thấy hồ sơ sinh viên.', 403)
    return student
  }

  private async equivalenceIds(
    course: Course,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (course.equivalenceId === null) return [course.id]
    const rows = await db.course.findMany({
      where: { equivalenceId: course.equivalenceId },
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }

  private async attemptFor(
    studentId: number,
    course: Course,
    groupIds: number[],
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AttemptType> {
    const attempts = await studentAttempts(db, studentId)
    return attemptTypeOf(effectiveResult(attempts, groupIds))
  }

  private async rates(db: Prisma.TransactionClient, student: StudentRecord) {
    const schedule = await db.feeSchedule.findUnique({
      where: {
        cohortId_trainingSystemId: {
          cohortId: student.cohort.id,
          trainingSystemId: student.trainingSystem.id,
        },
      },
    })
    if (schedule)
      return {
        theory: schedule.theoryCreditRate,
        practice: schedule.practiceCreditRate,
      }
    const parameters = await db.systemParameter.findMany({
      where: {
        key: { in: ['tuition.theoryCreditRate', 'tuition.practiceCreditRate'] },
      },
    })
    const read = (key: string) => {
      const value = parameters.find((parameter) => parameter.key === key)?.value
      return typeof value === 'number' ? BigInt(value) : 0n
    }
    return {
      theory: read('tuition.theoryCreditRate'),
      practice: read('tuition.practiceCreditRate'),
    }
  }

  private async registerOne(
    context: Context,
    sectionId: number,
    accepted: number[][],
  ): Promise<RegistrationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // ADR-0005: serialise this student's writes before touching any hot section row.
        await tx.$queryRaw`SELECT id FROM student WHERE id = ${context.student.id} FOR UPDATE`
        const term = await this.openTerm(tx)
        const permission = permissionFor(term, context.student, this.clock.now())
        if (permission.state !== 'OPEN') throw new RuleFailure('DK-02')
        if (!term || term.id !== context.term.id) throw new RuleFailure('DK-02')

        const section = await tx.courseSection.findUnique({
          where: { id: sectionId },
          include: {
            offeredCourse: { include: { course: true } },
            trainingSystem: true,
          },
        })
        const detail = { code: section?.code ?? String(sectionId) }
        if (!section || section.offeredCourse.termId !== term.id)
          throw new RuleFailure('DK-03', detail)
        if (section.trainingSystemId !== context.student.trainingSystem.id)
          throw new RuleFailure('DK-19', {
            ...detail,
            system: section.trainingSystem.code,
            studentSystem: context.student.trainingSystem.code,
          })

        const course = section.offeredCourse.course
        const groupIds = await this.equivalenceIds(course, tx)
        let form = await tx.registrationForm.findUnique({
          where: {
            studentId_termId: { studentId: context.student.id, termId: term.id },
          },
        })
        if (!form)
          form = await tx.registrationForm.create({
            data: { studentId: context.student.id, termId: term.id },
          })
        if (form.finalizedAt) throw new RuleFailure('DK-02')
        const duplicate = await tx.enrollment.findFirst({
          where: { formId: form.id, status: { not: 'CANCELLED' }, courseId: { in: groupIds } },
        })
        if (duplicate || accepted.some((group) => group.some((id) => groupIds.includes(id))))
          throw new RuleFailure('DK-04', { ...detail, courseCode: course.code })

        const attemptType = await this.attemptFor(context.student.id, course, groupIds, tx)
        // DK-05 after DK-04, before seat allocation: a missing grade allows a conditional line.
        const prerequisite = await prerequisiteCheck(tx, context.student.id, course)
        if (prerequisite.state === 'MISSING')
          throw new RuleFailure('DK-05', {
            ...detail,
            courseCode: course.code,
            reason: prerequisite.message,
          })
        // DK-09 last: the conditional UPDATE is the only seat allocator (ADR-0005).
        const won = await tx.$executeRaw`
          UPDATE course_section SET enrolled_count = enrolled_count + 1, updated_at = now()
          WHERE id = ${section.id} AND enrolled_count < capacity`
        if (won !== 1) throw new RuleFailure('DK-09', detail)

        const rates = await this.rates(tx, context.student)
        const rate = course.type === CourseType.THEORY ? rates.theory : rates.practice
        const surcharge =
          attemptType === AttemptType.FIRST ? 0n : BigInt(section.offeredCourse.credits) * rate
        const enrollment = await tx.enrollment.create({
          data: {
            formId: form.id,
            sectionId: section.id,
            courseId: course.id,
            status: EnrollmentStatus.REGISTERED,
            attemptType,
            pendingPrerequisite: prerequisite.state === 'CONDITIONAL',
            credits: section.offeredCourse.credits,
            creditRate: rate,
            surcharge,
          },
        })
        return {
          sectionId,
          sectionCode: section.code,
          ok: true,
          enrollmentId: enrollment.id,
          attemptType,
        }
      })
    } catch (error) {
      if (error instanceof RuleFailure) return error.result(sectionId)
      throw error
    }
  }

  private async sections(
    term: TermRecord,
    student: StudentRecord,
    form: FormView,
    filters: SectionFilters,
  ): Promise<SectionView[]> {
    const rows = await this.prisma.courseSection.findMany({
      where: {
        trainingSystemId: student.trainingSystem.id,
        offeredCourse: { termId: term.id },
      },
      include: {
        lecturer: { select: { fullName: true } },
        meetings: true,
        offeredCourse: { include: { course: true } },
      },
      orderBy: { code: 'asc' },
    })
    const registeredCourses = new Set(form.rows.map((row) => row.courseCode))
    const views: SectionView[] = []
    for (const row of rows) {
      const course = row.offeredCourse.course
      const view: SectionView = {
        id: row.id,
        code: row.code,
        courseCode: course.code,
        courseName: course.name,
        courseType: course.type,
        credits: row.offeredCourse.credits,
        attemptType: AttemptType.FIRST,
        capacity: row.capacity,
        enrolledCount: row.enrolledCount,
        remaining: Math.max(0, row.capacity - row.enrolledCount),
        lecturer: row.lecturer?.fullName ?? null,
        language: row.language,
        reservedAdmissionYear: row.reservedAdmissionYear,
        note: row.note,
        practiceMode: row.practiceMode,
        parentSectionId: row.parentSectionId,
        days: [...new Set(row.meetings.map((meeting) => meeting.dayOfWeek))].sort(),
        registered: registeredCourses.has(course.code),
        prerequisite: { state: 'OK', message: null },
      }
      if (filters.q) {
        const needle = filters.q.toLocaleLowerCase('vi')
        const haystack = `${view.courseCode} ${view.courseName} ${view.code}`.toLocaleLowerCase(
          'vi',
        )
        if (!haystack.includes(needle)) continue
      }
      if (filters.available && view.remaining === 0) continue
      if (filters.day && !view.days.includes(filters.day)) continue
      if (filters.courseType && view.courseType !== filters.courseType) continue
      if (filters.reserved && view.reservedAdmissionYear !== student.cohort.admissionYear) continue
      view.attemptType = await this.attemptFor(
        student.id,
        course,
        await this.equivalenceIds(course),
      )
      const prerequisite = await prerequisiteCheck(this.prisma, student.id, course)
      view.prerequisite = {
        state: prerequisite.state,
        message: prerequisite.state === 'OK' ? null : prerequisite.message,
      }
      views.push(view)
    }
    return views
  }

  private formView(
    row: {
      id: number
      finalizedAt: Date | null
      enrollments: (Enrollment & { section: CourseSection; course: Course })[]
    },
    maxCredits = 24,
  ): FormView {
    const map = (enrollment: (typeof row.enrollments)[number]): FormRowView => ({
      id: enrollment.id,
      sectionId: enrollment.sectionId,
      sectionCode: enrollment.section.code,
      courseCode: enrollment.course.code,
      courseName: enrollment.course.name,
      credits: enrollment.credits,
      attemptType: enrollment.attemptType,
      status: enrollment.status,
      registeredAt: enrollment.registeredAt.toISOString(),
      cancelledAt: enrollment.cancelledAt?.toISOString() ?? null,
      pendingPrerequisite: enrollment.pendingPrerequisite,
      cancellationReason: enrollment.cancellationReason,
    })
    const rows = row.enrollments.filter((item) => item.status !== 'CANCELLED').map(map)
    const cancelled = row.enrollments.filter((item) => item.status === 'CANCELLED').map(map)
    return {
      id: row.id,
      totalCredits: rows.reduce((sum, item) => sum + item.credits, 0),
      maxCredits,
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      rows,
      cancelled,
    }
  }
}

function emptyForm(maxCredits = 24): FormView {
  return {
    id: null,
    totalCredits: 0,
    maxCredits,
    finalizedAt: null,
    rows: [],
    cancelled: [],
  }
}
