import { HttpException, Injectable, NotFoundException } from '@nestjs/common'

import type { Actor } from '../academics/academics.service'
import { Clock } from '../academics/clock'
import { AttemptType, EnrollmentStatus, TermPhase } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { findClashes, type ClashItem } from '../timetable/timetable-validate'
import { rosterExcel, underCreditExcel } from './excel'
import { buildTodos, fillPercent } from './monitoring.policy'

const ATTEMPT_LABELS: Record<AttemptType, string> = {
  FIRST: 'Lần đầu',
  RETAKE: 'Học lại',
  IMPROVEMENT: 'Cải thiện',
}

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  REGISTERED: 'Đang đăng ký',
  CANCELLED: 'Đã huỷ',
  FINALIZED: 'Đã chốt',
}

function fail(
  code: string,
  message: string,
  status = 400,
  fieldErrors: Record<string, string> = {},
): never {
  throw new HttpException({ code, message, fieldErrors }, status)
}

/** C.4.1/C.4.7/C.4.8: read models for the academic office's registration desk. */
@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  private async term(code: string) {
    const term = await this.prisma.term.findUnique({
      where: { termCode: code },
      select: { id: true, termCode: true, phase: true, minCredits: true },
    })
    if (!term)
      throw new NotFoundException({ code: 'TERM_NOT_FOUND', message: 'Không tìm thấy học kỳ.' })
    return term
  }

  /** C.4.8: one read per poll, with the server clock so the UI can say "updated n seconds ago". */
  async sections(code: string) {
    const term = await this.term(code)
    const [parameter, rows] = await Promise.all([
      this.prisma.systemParameter.findUnique({
        where: { key: 'registration.pollingIntervalSeconds' },
        select: { value: true },
      }),
      this.prisma.courseSection.findMany({
        where: { offeredCourse: { termId: term.id } },
        include: {
          offeredCourse: { include: { course: { select: { code: true, name: true } } } },
          trainingSystem: { select: { code: true } },
          lecturer: { select: { fullName: true } },
        },
        orderBy: { code: 'asc' },
      }),
    ])
    const poll = parameter?.value
    return {
      now: this.clock.now().toISOString(),
      pollIntervalSeconds: typeof poll === 'number' ? poll : 5,
      term: { code: term.termCode, phase: term.phase },
      sections: rows.map((section) => ({
        id: section.id,
        code: section.code,
        courseCode: section.offeredCourse.course.code,
        courseName: section.offeredCourse.course.name,
        systemCode: section.trainingSystem.code,
        lecturerName: section.lecturer?.fullName ?? null,
        capacity: section.capacity,
        enrolledCount: section.enrolledCount,
        fillPercent: fillPercent(section.enrolledCount, section.capacity),
      })),
    }
  }

  /** LHP-02: capacity may shrink, but never below the seats already taken. */
  async setCapacity(code: string, sectionId: number, body: unknown, actor: Actor) {
    const value = (body as { capacity?: unknown } | null)?.capacity
    if (typeof value !== 'number' || !Number.isInteger(value))
      fail('CAPACITY_INVALID', 'Sĩ số phải là số nguyên.', 400, {
        capacity: 'Sĩ số không hợp lệ.',
      })
    const capacity = value
    return this.prisma.$transaction(async (tx) => {
      const term = await tx.term.findUnique({
        where: { termCode: code },
        select: { id: true },
      })
      if (!term)
        throw new NotFoundException({ code: 'TERM_NOT_FOUND', message: 'Không tìm thấy học kỳ.' })
      const section = await tx.courseSection.findFirst({
        where: { id: sectionId, offeredCourse: { termId: term.id } },
        select: { id: true, code: true, capacity: true, enrolledCount: true },
      })
      if (!section)
        throw new NotFoundException({
          code: 'SECTION_NOT_FOUND',
          message: 'Không tìm thấy lớp học phần.',
        })
      if (capacity < section.enrolledCount)
        fail(
          'CAPACITY_BELOW_ENROLLED',
          `Sĩ số không được nhỏ hơn ${section.enrolledCount} sinh viên đã đăng ký.`,
          400,
          { capacity: `Không được nhỏ hơn ${section.enrolledCount}.` },
        )
      if (capacity <= 0)
        fail('CAPACITY_INVALID', 'Sĩ số phải là số nguyên dương.', 400, {
          capacity: 'Sĩ số không hợp lệ.',
        })
      await tx.courseSection.update({ where: { id: section.id }, data: { capacity } })
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'section.update_capacity',
          entityType: 'CourseSection',
          entityId: String(section.id),
          payload: { before: section.capacity, after: capacity },
          requestId: actor.requestId,
          ip: actor.ip,
        },
      })
      return {
        id: section.id,
        code: section.code,
        capacity,
        enrolledCount: section.enrolledCount,
      }
    })
  }

  /** C.4.7 / BB01: cancelled rows are opt-in; the first column is a stable display index. */
  async roster(code: string, sectionCode: string, includeCancelled = false) {
    const term = await this.term(code)
    const section = await this.prisma.courseSection.findFirst({
      where: { code: sectionCode, offeredCourse: { termId: term.id } },
      include: {
        offeredCourse: { include: { course: { select: { code: true, name: true } } } },
      },
    })
    if (!section)
      throw new NotFoundException({
        code: 'SECTION_NOT_FOUND',
        message: 'Không tìm thấy lớp học phần.',
      })
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId: section.id,
        ...(includeCancelled ? {} : { status: { not: EnrollmentStatus.CANCELLED } }),
      },
      include: {
        form: {
          include: {
            student: {
              include: {
                cohort: { select: { code: true } },
                trainingSystem: { select: { code: true } },
              },
            },
          },
        },
      },
      orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    })
    const rows = enrollments.map((enrollment, index) => ({
      stt: index + 1,
      studentCode: enrollment.form.student.studentCode,
      fullName: enrollment.form.student.fullName,
      cohortCode: enrollment.form.student.cohort.code,
      systemCode: enrollment.form.student.trainingSystem.code,
      attemptType: enrollment.attemptType,
      attemptTypeLabel: ATTEMPT_LABELS[enrollment.attemptType],
      status: enrollment.status,
      statusLabel: STATUS_LABELS[enrollment.status],
    }))
    return {
      section: {
        code: section.code,
        courseCode: section.offeredCourse.course.code,
        courseName: section.offeredCourse.course.name,
        capacity: section.capacity,
        enrolledCount: section.enrolledCount,
        termCode: term.termCode,
      },
      includeCancelled,
      rows,
    }
  }

  async rosterExcel(code: string, sectionCode: string, includeCancelled = false): Promise<Buffer> {
    const { rows } = await this.roster(code, sectionCode, includeCancelled)
    return rosterExcel(
      rows.map((row) => ({
        ...row,
        attemptType: row.attemptTypeLabel,
        status: row.statusLabel,
      })),
    )
  }

  /** DK-08: warnings are warning-only; derive them from chốt forms so the report works even before the job ran. */
  private async underCreditRows(termId?: number) {
    const forms = await this.prisma.registrationForm.findMany({
      where: {
        finalizedAt: { not: null },
        ...(termId === undefined ? {} : { termId }),
      },
      include: {
        term: { select: { minCredits: true } },
        student: { include: { cohort: { select: { code: true } } } },
        enrollments: {
          where: { status: { not: EnrollmentStatus.CANCELLED } },
          select: { credits: true },
        },
      },
      orderBy: { student: { studentCode: 'asc' } },
    })
    return forms
      .map((form) => ({
        stt: 0,
        studentCode: form.student.studentCode,
        fullName: form.student.fullName,
        cohortCode: form.student.cohort.code,
        credits: form.enrollments.reduce((sum, enrollment) => sum + enrollment.credits, 0),
        minCredits: form.term.minCredits,
      }))
      .filter((row) => row.credits < row.minCredits)
      .map((row, index) => ({ ...row, stt: index + 1 }))
  }

  async underCredits(code: string) {
    const term = await this.term(code)
    const rows = await this.underCreditRows(term.id)
    return {
      term: { code: term.termCode, phase: term.phase, minCredits: term.minCredits },
      rows,
    }
  }

  async underCreditsExcel(code: string): Promise<Buffer> {
    const { rows } = await this.underCredits(code)
    return underCreditExcel(rows)
  }

  /** C.4.1: phase-dependent stats plus the "việc cần xử lý" list, all from the current read models. */
  async overview() {
    const now = this.clock.now()
    const terms = await this.prisma.term.findMany({
      where: {
        phase: {
          in: [
            TermPhase.PREPARATION,
            TermPhase.REGISTRATION,
            TermPhase.ADJUSTMENT,
            TermPhase.IN_PROGRESS,
          ],
        },
      },
      orderBy: { registrationStartAt: 'asc' },
    })
    const focus =
      terms.find(
        (term) => term.phase === TermPhase.REGISTRATION || term.phase === TermPhase.ADJUSTMENT,
      ) ??
      terms.find((term) => term.phase === TermPhase.IN_PROGRESS) ??
      terms.find((term) => term.phase === TermPhase.PREPARATION)

    const [withTimetable, students, feeSchedules, underCredits] = await Promise.all([
      this.prisma.offeredCourse.findMany({ select: { termId: true } }),
      this.prisma.student.findMany({
        select: {
          cohortId: true,
          trainingSystemId: true,
          cohort: { select: { code: true } },
          trainingSystem: { select: { code: true } },
        },
      }),
      this.prisma.feeSchedule.findMany({ select: { cohortId: true, trainingSystemId: true } }),
      this.underCreditRows(),
    ])

    const timetableTermIds = new Set(withTimetable.map((row) => row.termId))
    const feeKeys = new Set(feeSchedules.map((fee) => `${fee.cohortId}:${fee.trainingSystemId}`))
    const missingFees = new Map<string, { cohortCode: string; systemCode: string; count: number }>()
    for (const student of students) {
      const key = `${student.cohortId}:${student.trainingSystemId}`
      if (feeKeys.has(key)) continue
      const label = `${student.cohort.code}:${student.trainingSystem.code}`
      const entry = missingFees.get(label)
      if (entry) entry.count += 1
      else
        missingFees.set(label, {
          cohortCode: student.cohort.code,
          systemCode: student.trainingSystem.code,
          count: 1,
        })
    }

    let clashCount = 0
    let sections: { capacity: number; enrolledCount: number }[] = []
    let offeringCount = 0
    let formCount = 0
    if (focus) {
      const [meetings, rows, offerings, forms] = await Promise.all([
        this.prisma.meeting.findMany({
          where: { section: { offeredCourse: { termId: focus.id } } },
          select: {
            id: true,
            dayOfWeek: true,
            startSlot: true,
            endSlot: true,
            room: true,
            weeks: true,
            section: { select: { code: true, lecturer: { select: { lecturerCode: true } } } },
          },
          orderBy: { id: 'asc' },
        }),
        this.prisma.courseSection.findMany({
          where: { offeredCourse: { termId: focus.id } },
          select: { capacity: true, enrolledCount: true },
        }),
        this.prisma.offeredCourse.count({ where: { termId: focus.id } }),
        this.prisma.registrationForm.count({ where: { termId: focus.id } }),
      ])
      const clashItems: ClashItem[] = meetings.map((meeting, index) => ({
        sourceRow: index + 1,
        classCode: meeting.section.code,
        lecturerCode: meeting.section.lecturer?.lecturerCode ?? null,
        room: meeting.room || null,
        dayOfWeek: meeting.dayOfWeek,
        startSlot: meeting.startSlot,
        endSlot: meeting.endSlot,
        weeks: meeting.weeks,
      }))
      clashCount = findClashes(clashItems).length
      sections = rows
      offeringCount = offerings
      formCount = forms
    }

    const fullSections = sections.filter(
      (section) => section.capacity > 0 && section.enrolledCount >= section.capacity,
    ).length
    const smallSections = sections.filter((section) => section.enrolledCount < 10).length
    const registrationOpen =
      focus?.phase === TermPhase.REGISTRATION || focus?.phase === TermPhase.ADJUSTMENT
    const todos = buildTodos({
      termCode: focus?.termCode ?? '',
      missingTimetable: terms
        .filter((term) => term.phase === TermPhase.PREPARATION && !timetableTermIds.has(term.id))
        .map((term) => ({ code: term.termCode })),
      missingFeeSchedules: [...missingFees.values()],
      fullSectionCount: registrationOpen ? fullSections : 0,
      clashCount,
      underCreditCount: underCredits.length,
    })
    return {
      now: now.toISOString(),
      focusTerm: focus ? { code: focus.termCode, phase: focus.phase } : null,
      stats: {
        phase: focus?.phase ?? null,
        timetableImported: sections.length > 0,
        offeredCourses: offeringCount,
        sections: sections.length,
        clashes: clashCount,
        studentsWithForm: formCount,
        totalStudents: students.length,
        fullSections,
        smallSections,
        underCredits: underCredits.length,
      },
      todos,
    }
  }
}
