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
  Prisma,
  type AcademicYear,
  type Course,
  type CourseSection,
  type Enrollment,
  type RegistrationForm,
  type RegistrationSlot,
  type RegistrationSlotCohort,
  type Term,
  TermType,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { findScheduleClash, type ScheduleClash } from './clash'
import { TuitionService } from '../tuition/tuition.service'
import { RegistrationIdempotency } from './idempotency'
import { prerequisiteCheck, studentAttempts } from './prerequisites'
import { meetingDates } from './schedule'
import {
  attemptTypeOf,
  effectiveResult,
  remainingCredits,
  ruleExit,
  ruleMessage,
  type RegistrationRule,
} from './policy'
import type { RegisterInput, SectionFilters, TimetableScope } from './validation'

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

export type SectionMeetingView = {
  dayOfWeek: number
  startSlot: number
  endSlot: number
  weeks: number
  room: string | null
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
  meetings: SectionMeetingView[]
  clash: ScheduleClash | null
  registered: boolean
  prerequisite: { state: 'OK' | 'MISSING' | 'CONDITIONAL'; message: string | null }
}

/** BB02: meetings of the active rows, with concrete dates derived from the weeks bitmask. */
export type StudentMeetingView = SectionMeetingView & {
  id: number
  sectionId: number
  sectionCode: string
  courseCode: string
  courseName: string
  courseType: CourseType
  lecturer: string | null
  dates: string[]
}

export type UnscheduledSectionView = {
  sectionId: number
  sectionCode: string
  courseCode: string
  courseName: string
  courseType: CourseType
  practiceMode: string | null
  lecturer: string | null
}

export type StudentTimetableView = {
  term: {
    code: string
    name: string
    phase: TermPhase
    startDate: string
    weekCount: number
  } | null
  today: string
  meetings: StudentMeetingView[]
  unscheduled: UnscheduledSectionView[]
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

/** HP-03: retake/improvement in a main term and every summer line are charged per credit. */
export function surchargeFor(
  termType: TermType,
  attempt: AttemptType,
  credits: number,
  rate: bigint,
): bigint {
  return termType === TermType.SUMMER || attempt !== AttemptType.FIRST ? BigInt(credits) * rate : 0n
}

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
    private readonly tuition: TuitionService,
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

  /** B.4.3: the weekly grid (registering term preview or the term being studied). */
  async timetable(userId: number, scope: TimetableScope): Promise<StudentTimetableView> {
    const student = await this.loadStudent(userId)
    const today = this.clock.now().toISOString().slice(0, 10)
    const term =
      scope === 'registering'
        ? await this.openTerm()
        : await this.prisma.term.findFirst({
            where: { phase: 'IN_PROGRESS' },
            orderBy: { startDate: 'desc' },
            include: {
              academicYear: true,
              registrationSlots: { include: { cohorts: true } },
            },
          })
    if (!term) return { term: null, today, meetings: [], unscheduled: [] }

    const form = await this.prisma.registrationForm.findUnique({
      where: { studentId_termId: { studentId: student.id, termId: term.id } },
      include: {
        enrollments: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            course: true,
            section: { include: { meetings: true, lecturer: { select: { fullName: true } } } },
          },
        },
      },
    })
    const rows = form?.enrollments ?? []
    const allMeetings = rows.flatMap((row) => row.section.meetings)
    let weekCount = 1
    for (const meeting of allMeetings)
      for (let bit = 0; bit < 31; bit++)
        if ((meeting.weeks & (1 << bit)) !== 0) weekCount = Math.max(weekCount, bit + 1)

    return {
      term: {
        code: term.termCode,
        name: termName(term),
        phase: term.phase,
        startDate: term.startDate.toISOString().slice(0, 10),
        weekCount,
      },
      today,
      meetings: rows.flatMap((row) =>
        row.section.meetings.map((meeting) => ({
          id: meeting.id,
          sectionId: row.section.id,
          sectionCode: row.section.code,
          courseCode: row.course.code,
          courseName: row.course.name,
          courseType: row.course.type,
          dayOfWeek: meeting.dayOfWeek,
          startSlot: meeting.startSlot,
          endSlot: meeting.endSlot,
          weeks: meeting.weeks,
          room: meeting.room,
          lecturer: row.section.lecturer?.fullName ?? null,
          dates: meetingDates(term.startDate, meeting.dayOfWeek, meeting.weeks),
        })),
      ),
      unscheduled: rows
        .filter((row) => row.section.meetings.length === 0)
        .map((row) => ({
          sectionId: row.section.id,
          sectionCode: row.section.code,
          courseCode: row.course.code,
          courseName: row.course.name,
          courseType: row.course.type,
          practiceMode: row.section.practiceMode,
          lecturer: row.section.lecturer?.fullName ?? null,
        })),
    }
  }

  /** DK-18: every section is judged in its own transaction; one failure never rolls back its siblings. */
  async register(userId: number, idempotencyKey: string, input: RegisterInput) {
    return this.idempotency.run('register', userId, idempotencyKey, async () => {
      await this.idempotency.checkRate(userId)
      const context = await this.context(userId)
      const groups = await this.prisma.courseSection.findMany({
        where: { id: { in: input.sectionIds }, parentSectionId: { not: null } },
        select: { id: true },
      })
      const groupIds = new Set(groups.map((group) => group.id))
      const ordered = [
        ...input.sectionIds.filter((id) => !groupIds.has(id)),
        ...input.sectionIds.filter((id) => groupIds.has(id)),
      ]
      const accepted: number[][] = []
      const results: RegistrationResult[] = []
      const outcomes = new Map<number, RegistrationResult>()
      for (const sectionId of ordered) {
        try {
          const winner = await this.registerOne(context, sectionId, accepted, outcomes)
          results.push(winner)
          outcomes.set(sectionId, winner)
          if (winner.ok) {
            const section = await this.prisma.courseSection.findUniqueOrThrow({
              where: { id: sectionId },
              include: { offeredCourse: { include: { course: true } } },
            })
            accepted.push(await this.equivalenceIds(section.offeredCourse.course))
          }
        } catch (error) {
          if (error instanceof RuleFailure) {
            const failure = error.result(sectionId)
            results.push(failure)
            outcomes.set(sectionId, failure)
            continue
          }
          throw error
        }
      }
      const byId = new Map(results.map((result) => [result.sectionId, result]))
      const fresh = await this.context(userId)
      return {
        results: input.sectionIds.map((id) => byId.get(id)!),
        form: fresh.form,
        permission: fresh.permission,
      }
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
        // Same lock order as registration: form row first, then the section being released.
        const locked = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM registration_form
          WHERE student_id = ${student.id} AND term_id = ${termRecord.id} FOR UPDATE`
        if (locked.length === 0)
          this.fail('ENROLLMENT_NOT_ACTIVE', 'Dòng đăng ký này không còn hiệu lực.', 409)

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
      // ADR-0007: the tuition module owns the ledger; one reversal path for route and daily job.
      await this.tuition.reverseSurcharge(tx, {
        enrollmentId: row.id,
        studentId: enrollment.form.studentId,
        termId: enrollment.form.termId,
        sectionCode: row.section.code,
        at,
      })
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
      cancelledEnrollments: rows
        .filter((row) => cancelled.includes(row.id))
        .map((row) => ({
          enrollmentId: row.id,
          sectionId: row.sectionId,
          sectionCode: row.section.code,
          status: 'CANCELLED',
        })),
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
    outcomes: Map<number, RegistrationResult>,
  ): Promise<RegistrationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const term = await this.openTerm(tx)
        const permission = permissionFor(term, context.student, this.clock.now())
        if (permission.state !== 'OPEN') throw new RuleFailure('DK-02')
        if (!term || term.id !== context.term.id) throw new RuleFailure('DK-02')

        // ADR-0005: the form row is the per-student lock. It must exist first; ON CONFLICT DO
        // NOTHING lets two parallel first registrations share the same row instead of one failing.
        await tx.registrationForm.createMany({
          data: [{ studentId: context.student.id, termId: term.id }],
          skipDuplicates: true,
        })
        const locked = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM registration_form
          WHERE student_id = ${context.student.id} AND term_id = ${term.id} FOR UPDATE`
        const formId = locked[0]!.id

        const section = await tx.courseSection.findUnique({
          where: { id: sectionId },
          include: {
            offeredCourse: { include: { course: true } },
            trainingSystem: true,
            meetings: true,
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
        const form = await tx.registrationForm.findUniqueOrThrow({ where: { id: formId } })
        if (form.finalizedAt) throw new RuleFailure('DK-02')
        const duplicate = await tx.enrollment.findFirst({
          where: { formId: form.id, status: { not: 'CANCELLED' }, courseId: { in: groupIds } },
        })
        if (duplicate || accepted.some((group) => group.some((id) => groupIds.includes(id))))
          throw new RuleFailure('DK-04', { ...detail, courseCode: course.code })

        if (section.parentSectionId !== null) {
          const parent = await tx.courseSection.findUnique({
            where: { id: section.parentSectionId },
            include: { offeredCourse: { include: { course: true } } },
          })
          if (!parent || parent.offeredCourse.termId !== term.id)
            throw new RuleFailure('DK-11', detail)
          const parentCourse = parent.offeredCourse.course
          const theoryPassed =
            (await this.attemptFor(
              context.student.id,
              parentCourse,
              await this.equivalenceIds(parentCourse, tx),
              tx,
            )) === AttemptType.IMPROVEMENT
          if (!theoryPassed) {
            const parentEnrollment = await tx.enrollment.findFirst({
              where: {
                formId: form.id,
                sectionId: parent.id,
                status: { not: 'CANCELLED' },
              },
            })
            if (!parentEnrollment) {
              const batchParent = outcomes.get(parent.id)
              throw new RuleFailure(
                'DK-11',
                batchParent && !batchParent.ok
                  ? { ...detail, parentCode: parent.code, parentFailed: 'true' }
                  : detail,
              )
            }
          }
        }

        const attemptType = await this.attemptFor(context.student.id, course, groupIds, tx)
        // DK-05 after DK-04, before seat allocation: a missing grade allows a conditional line.
        const prerequisite = await prerequisiteCheck(tx, context.student.id, course)
        if (prerequisite.state === 'MISSING')
          throw new RuleFailure('DK-05', {
            ...detail,
            courseCode: course.code,
            reason: prerequisite.message,
          })

        const active = await tx.enrollment.findMany({
          where: { formId: form.id, status: { not: 'CANCELLED' } },
          include: { section: { include: { meetings: true } } },
        })
        const clash = findScheduleClash(
          { code: section.code, meetings: section.meetings },
          active.map((row) => ({ code: row.section.code, meetings: row.section.meetings })),
        )
        if (clash)
          throw new RuleFailure('DK-07', {
            ...detail,
            clashWith: clash.withCode,
            day: String(clash.dayOfWeek),
            slots: `${clash.startSlot}–${clash.endSlot}`,
          })
        // DK-08: the summer cap lives on the term (12 credits) and is read under the form lock.
        const left = remainingCredits(
          term.maxCredits,
          active.reduce((sum, row) => sum + row.credits, 0),
          section.offeredCourse.credits,
        )
        if (left < 0)
          throw new RuleFailure('DK-08', {
            ...detail,
            remaining: String(Math.max(0, left + section.offeredCourse.credits)),
          })

        // DK-09 last: the conditional UPDATE is the only seat allocator (ADR-0005).
        const won = await tx.$executeRaw`
          UPDATE course_section SET enrolled_count = enrolled_count + 1, updated_at = now()
          WHERE id = ${section.id} AND enrolled_count < capacity`
        if (won !== 1) throw new RuleFailure('DK-09', detail)

        const rates = await this.rates(tx, context.student)
        const rate = course.type === CourseType.THEORY ? rates.theory : rates.practice
        const surcharge = surchargeFor(term.type, attemptType, section.offeredCourse.credits, rate)
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
        await this.tuition.postSurcharge(tx, {
          enrollmentId: enrollment.id,
          studentId: context.student.id,
          termId: term.id,
          courseCode: course.code,
          attemptType,
          surcharge,
          registeredAt: enrollment.registeredAt,
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
    const enrolled = form.rows.length
      ? await this.prisma.courseSection.findMany({
          where: { id: { in: form.rows.map((row) => row.sectionId) } },
          select: { code: true, meetings: true },
        })
      : []
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
        meetings: row.meetings.map((meeting) => ({
          dayOfWeek: meeting.dayOfWeek,
          startSlot: meeting.startSlot,
          endSlot: meeting.endSlot,
          weeks: meeting.weeks,
          room: meeting.room,
        })),
        clash:
          row.meetings.length === 0
            ? null
            : findScheduleClash(
                { code: row.code, meetings: row.meetings },
                enrolled.filter((item) => item.code !== row.code),
              ),
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
      if (filters.noClash && view.clash !== null) continue
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
