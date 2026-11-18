import { HttpException, Injectable, NotFoundException } from '@nestjs/common'

import type { Actor } from '../academics/academics.service'
import { TermPhase } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import type { ImportIssue } from './timetable-parse'
import { findClashes, type ClashItem } from './timetable-validate'
import {
  assertCreditsPreparation,
  assertPreparation,
  datesFromWeeks,
  parseSectionInput,
  phaseFieldErrors,
  type FieldErrors,
  type NormalizedMeeting,
  type SectionInput,
  type SectionSnapshot,
} from './section-policy'

type TermRow = { id: number; termCode: string; phase: TermPhase; startDate: Date }

type ReferenceRows = {
  offerings: { id: number; courseId: number; courseCode: string; credits: number }[]
  courseById: Map<
    number,
    { code: string; name: string; type: string; companionTheoryCourseId: number | null }
  >
  companionByCourseId: Map<number, number>
  systems: Map<string, number>
  lecturers: Map<string, { id: number; fullName: string }>
  rooms: Set<string>
  cohorts: number[]
  sections: {
    id: number
    code: string
    parentSectionId: number | null
    practiceMode: string | null
    offeredCourseId: number
  }[]
}

export type ClashWarning = ImportIssue & { sectionId: number; meetingId: number | null }

export type EditorMeeting = {
  id: number
  dayOfWeek: number
  startSlot: number
  endSlot: number
  room: string
  weeks: number
  startDate: string
  endDate: string
  cadence: 1 | 2
  warnings: ClashWarning[]
}

export type EditorSection = {
  id: number
  code: string
  courseCode: string
  courseName: string
  systemCode: string
  lecturerCode: string | null
  lecturerName: string | null
  capacity: number
  enrolledCount: number
  reservedAdmissionYear: number | null
  language: string | null
  note: string | null
  practiceMode: 'SCHEDULED' | 'SELF_SCHEDULED' | null
  parentCode: string | null
  offeringId: number
  meetings: EditorMeeting[]
  practiceGroupCount: number
  hasWarning: boolean
  canEdit: boolean
}

function fail(code: string, message: string, status = 400, fieldErrors: FieldErrors = {}): never {
  throw new HttpException({ code, message, fieldErrors }, status)
}

/** QĐ11.6–11.10 / LHP-01–02: edits to sections, groups, meetings and offering credits. */
@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async term(code: string): Promise<TermRow> {
    const term = await this.prisma.term.findUnique({
      where: { termCode: code },
      select: { id: true, termCode: true, phase: true, startDate: true },
    })
    if (!term)
      throw new NotFoundException({ code: 'TERM_NOT_FOUND', message: 'Không tìm thấy học kỳ.' })
    return term
  }

  private async references(termId: number): Promise<ReferenceRows> {
    const [offerings, courses, systems, lecturers, rooms, cohorts, sections] = await Promise.all([
      this.prisma.offeredCourse.findMany({
        where: { termId },
        select: { id: true, courseId: true, credits: true, course: { select: { code: true } } },
      }),
      this.prisma.course.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          companionTheoryCourseId: true,
        },
      }),
      this.prisma.trainingSystem.findMany({ select: { id: true, code: true } }),
      this.prisma.lecturer.findMany({ select: { id: true, lecturerCode: true, fullName: true } }),
      this.prisma.room.findMany({ select: { code: true } }),
      this.prisma.cohort.findMany({
        select: { admissionYear: true },
        orderBy: { admissionYear: 'asc' },
      }),
      this.prisma.courseSection.findMany({
        where: { offeredCourse: { termId } },
        select: {
          id: true,
          code: true,
          parentSectionId: true,
          practiceMode: true,
          offeredCourseId: true,
        },
      }),
    ])
    const courseById = new Map(courses.map((course) => [course.id, course]))
    const companionByCourseId = new Map<number, number>()
    for (const course of courses) {
      if (course.companionTheoryCourseId)
        companionByCourseId.set(course.companionTheoryCourseId, course.id)
    }
    return {
      offerings: offerings.map((offering) => ({
        id: offering.id,
        courseId: offering.courseId,
        courseCode: offering.course.code,
        credits: offering.credits,
      })),
      courseById,
      companionByCourseId,
      systems: new Map(systems.map((system) => [system.code, system.id])),
      lecturers: new Map(
        lecturers.map((lecturer) => [
          lecturer.lecturerCode,
          { id: lecturer.id, fullName: lecturer.fullName },
        ]),
      ),
      rooms: new Set(rooms.map((room) => room.code)),
      cohorts: cohorts.map((cohort) => cohort.admissionYear),
      sections,
    }
  }

  /** Clashes are derived from all meetings in the term and stay non-blocking (QĐ11.10/QĐ12.4). */
  private async clashWarnings(termId: number): Promise<ClashWarning[]> {
    const meetings = await this.prisma.meeting.findMany({
      where: { section: { offeredCourse: { termId } } },
      select: {
        id: true,
        dayOfWeek: true,
        startSlot: true,
        endSlot: true,
        room: true,
        weeks: true,
        section: {
          select: {
            id: true,
            code: true,
            lecturer: { select: { lecturerCode: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    })
    const items: ClashItem[] = meetings.map((meeting) => ({
      sourceRow: meeting.id,
      classCode: meeting.section.code,
      lecturerCode: meeting.section.lecturer?.lecturerCode ?? null,
      room: meeting.room || null,
      dayOfWeek: meeting.dayOfWeek,
      startSlot: meeting.startSlot,
      endSlot: meeting.endSlot,
      weeks: meeting.weeks,
    }))
    const sectionByMeeting = new Map(meetings.map((meeting) => [meeting.id, meeting.section.id]))
    return findClashes(items).map((issue) => ({
      ...issue,
      sectionId: sectionByMeeting.get(issue.row)!,
      meetingId: issue.row,
    }))
  }

  /** The single read model behind the edit UI: form options, meetings, groups and inline warnings. */
  async editor(code: string) {
    const term = await this.term(code)
    const [refs, allWarnings] = await Promise.all([
      this.references(term.id),
      this.clashWarnings(term.id),
    ])
    const [sections, offerings] = await Promise.all([
      this.prisma.courseSection.findMany({
        where: { offeredCourse: { termId: term.id } },
        include: {
          offeredCourse: { include: { course: true } },
          trainingSystem: true,
          lecturer: true,
          parentSection: { select: { code: true, practiceMode: true } },
          meetings: { orderBy: { id: 'asc' } },
          _count: { select: { practiceSections: true } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.offeredCourse.findMany({
        where: { termId: term.id },
        include: { course: true, sections: { select: { id: true, capacity: true } } },
        orderBy: { course: { code: 'asc' } },
      }),
    ])
    const systemCodes = new Map([...refs.systems].map(([code, id]) => [id, code]))
    const views: EditorSection[] = sections.map((section) => {
      const meetings: EditorMeeting[] = section.meetings.map((meeting) => {
        const dates = datesFromWeeks(term.startDate, meeting.dayOfWeek, meeting.weeks)
        return {
          id: meeting.id,
          dayOfWeek: meeting.dayOfWeek,
          startSlot: meeting.startSlot,
          endSlot: meeting.endSlot,
          room: meeting.room,
          weeks: meeting.weeks,
          ...dates,
          warnings: allWarnings.filter((warning) => warning.meetingId === meeting.id),
        }
      })
      return {
        id: section.id,
        code: section.code,
        courseCode: section.offeredCourse.course.code,
        courseName: section.offeredCourse.course.name,
        systemCode: systemCodes.get(section.trainingSystemId) ?? '',
        lecturerCode: section.lecturer?.lecturerCode ?? null,
        lecturerName: section.lecturer?.fullName ?? null,
        capacity: section.capacity,
        enrolledCount: section.enrolledCount,
        reservedAdmissionYear: section.reservedAdmissionYear,
        language: section.language,
        note: section.note,
        practiceMode: section.parentSection?.practiceMode ?? section.practiceMode,
        parentCode: section.parentSection?.code ?? null,
        offeringId: section.offeredCourseId,
        meetings,
        practiceGroupCount: section._count.practiceSections,
        hasWarning: meetings.some((meeting) => meeting.warnings.length > 0),
        canEdit: term.phase === TermPhase.PREPARATION,
      }
    })
    return {
      term: {
        code: term.termCode,
        phase: term.phase,
        startDate: term.startDate.toISOString().slice(0, 10),
        canEdit: term.phase === TermPhase.PREPARATION,
        reason:
          term.phase === TermPhase.PREPARATION
            ? null
            : 'Từ giai đoạn Đăng ký chỉ sửa được sĩ số và điền giảng viên, phòng còn trống.',
      },
      options: {
        offerings: offerings.map((offering) => ({
          id: offering.id,
          code: offering.course.code,
          name: offering.course.name,
          type: offering.course.type,
          credits: offering.credits,
          defaultCredits: offering.course.credits,
          sectionCount: offering.sections.length,
        })),
        lecturers: [...refs.lecturers].map(([code, lecturer]) => ({
          code,
          fullName: lecturer.fullName,
        })),
        rooms: [...refs.rooms].sort(),
        systems: [...refs.systems.keys()].sort(),
        cohorts: refs.cohorts,
      },
      sections: views,
      warnings: allWarnings,
      counts: {
        offeredCourses: offerings.length,
        sections: sections.length,
        practiceGroups: sections.filter((section) => section.parentSectionId !== null).length,
        meetings: sections.reduce((sum, section) => sum + section.meetings.length, 0),
      },
    }
  }

  private resolve(
    refs: ReferenceRows,
    input: SectionInput,
    parent?: { id: number; code: string; practiceMode: string | null; offeredCourseId: number },
  ) {
    const errors: FieldErrors = {}
    const offering = refs.offerings.find((item) => item.courseCode === input.courseCode)
    if (!offering) errors.courseCode = 'Môn mở không tồn tại trong học kỳ này.'
    const systemId = refs.systems.get(input.systemCode)
    if (!systemId) errors.systemCode = 'Hệ đào tạo không có trong danh mục.'
    const lecturerCode = input.lecturerCode?.toUpperCase() ?? null
    const lecturer = lecturerCode ? refs.lecturers.get(lecturerCode) : undefined
    if (lecturerCode && !lecturer) errors.lecturerCode = 'Giảng viên không có trong danh mục.'
    let parentSectionId: number | null = null
    if (input.parentCode) {
      if (!parent) errors.parentCode = 'Lớp lý thuyết cha không tồn tại trong học kỳ này.'
      else parentSectionId = parent.id
    }
    if (Object.keys(errors).length > 0)
      fail('REFERENCE_INVALID', 'Thông tin tham chiếu không hợp lệ.', 400, errors)
    return {
      offeringId: offering!.id,
      systemId: systemId!,
      lecturerId: lecturer?.id ?? null,
      parentSectionId,
    }
  }

  private snapshot(
    section: {
      code: string
      capacity: number
      reservedAdmissionYear: number | null
      language: string | null
      note: string | null
      practiceMode: string | null
      enrolledCount: number
      offeredCourse: { course: { code: string } }
      trainingSystem: { code: string }
      lecturer: { lecturerCode: string } | null
      parentSection: { code: string; practiceMode: string | null } | null
      meetings: {
        dayOfWeek: number
        startSlot: number
        endSlot: number
        room: string
        weeks: number
      }[]
    },
    termStart: Date,
  ): SectionSnapshot & { enrolledCount: number } {
    return {
      code: section.code,
      courseCode: section.offeredCourse.course.code,
      systemCode: section.trainingSystem.code,
      lecturerCode: section.lecturer?.lecturerCode ?? null,
      capacity: section.capacity,
      reservedAdmissionYear: section.reservedAdmissionYear,
      language: section.language,
      note: section.note,
      practiceMode: (section.parentSection?.practiceMode ??
        section.practiceMode) as SectionSnapshot['practiceMode'],
      parentCode: section.parentSection?.code ?? null,
      enrolledCount: section.enrolledCount,
      meetings: section.meetings.map((meeting) => ({
        ...meeting,
        ...datesFromWeeks(termStart, meeting.dayOfWeek, meeting.weeks),
      })),
    }
  }

  private meetingData(meeting: NormalizedMeeting) {
    return {
      dayOfWeek: meeting.dayOfWeek,
      startSlot: meeting.startSlot,
      endSlot: meeting.endSlot,
      room: meeting.room,
      weeks: meeting.weeks,
    }
  }

  private async section(sectionId: number, termId: number) {
    const row = await this.prisma.courseSection.findFirst({
      where: { id: sectionId, offeredCourse: { termId } },
      include: {
        offeredCourse: { include: { course: true } },
        trainingSystem: true,
        lecturer: true,
        parentSection: true,
        practiceSections: { select: { id: true } },
        meetings: { orderBy: { id: 'asc' } },
      },
    })
    if (!row) fail('SECTION_NOT_FOUND', 'Không tìm thấy lớp học phần.', 404)
    return row
  }

  async create(code: string, body: unknown, actor: Actor) {
    return this.prisma.$transaction(
      async (tx) => {
        const term = await this.term(code)
        assertPreparation(term.phase, 'thêm lớp học phần')
        const rooms = new Set(
          (await tx.room.findMany({ select: { code: true } })).map((r) => r.code),
        )
        const input = parseSectionInput(body, term.startDate, (room) => rooms.has(room))
        const refs = await this.references(term.id)
        const parent = input.parentCode
          ? refs.sections.find(
              (section) => section.code === input.parentCode && section.parentSectionId === null,
            )
          : undefined
        if (input.parentCode && !parent)
          fail('PARENT_NOT_FOUND', 'Lớp lý thuyết cha không tồn tại.', 400, {
            parentCode: 'Không tìm thấy lớp cha.',
          })
        if (parent) {
          const practiceId = refs.companionByCourseId.get(
            refs.offerings.find((o) => o.id === parent.offeredCourseId)!.courseId,
          )
          const offering = refs.offerings.find((item) => item.courseCode === input.courseCode)
          if (!practiceId || offering?.courseId !== practiceId)
            fail(
              'GROUP_COURSE_INVALID',
              'Nhóm thực hành phải thuộc môn thực hành đi kèm với lớp lý thuyết cha.',
              400,
              {
                courseCode: 'Môn thực hành không khớp.',
              },
            )
          const mode = input.practiceMode ?? (parent.practiceMode as SectionInput['practiceMode'])
          if (mode === 'SELF_SCHEDULED' && input.meetings.length > 0)
            fail('HT2_HAS_MEETINGS', 'HT2 – tự xếp lịch không được có buổi học.', 400, {
              meetings: 'HT2 không có buổi học.',
            })
          if (!mode)
            fail('MODE_REQUIRED', 'Chọn hình thức thực hành HT1 hoặc HT2.', 400, {
              practiceMode: 'Bắt buộc.',
            })
          if (parent.practiceMode && parent.practiceMode !== mode)
            fail('MODE_INCONSISTENT', 'Các nhóm của một lớp phải cùng hình thức thực hành.', 400, {
              practiceMode: 'Khác hình thức của lớp cha.',
            })
        }
        const duplicate = await tx.courseSection.findFirst({
          where: { code: input.code, offeredCourse: { termId: term.id } },
          select: { id: true },
        })
        if (duplicate)
          fail('CLASS_DUPLICATE', `Mã lớp ${input.code} đã tồn tại trong học kỳ.`, 400, {
            code: 'Mã lớp đã dùng.',
          })
        const resolved = this.resolve(refs, input, parent)
        const created = await tx.courseSection.create({
          data: {
            offeredCourseId: resolved.offeringId,
            trainingSystemId: resolved.systemId,
            code: input.code,
            lecturerId: resolved.lecturerId,
            language: input.language,
            reservedAdmissionYear: input.reservedAdmissionYear,
            note: input.note,
            capacity: input.capacity,
            parentSectionId: resolved.parentSectionId,
            practiceMode: parent ? null : input.practiceMode,
            meetings: { create: input.meetings.map((meeting) => this.meetingData(meeting)) },
          },
        })
        if (parent && !parent.practiceMode && input.practiceMode)
          await tx.courseSection.update({
            where: { id: parent.id },
            data: { practiceMode: input.practiceMode },
          })
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'section.create',
            entityType: 'CourseSection',
            entityId: String(created.id),
            payload: {
              ...input,
              meetings: input.meetings.map((meeting) => this.meetingData(meeting)),
            },
            requestId: actor.requestId,
            ip: actor.ip,
          },
        })
        return { id: created.id, code: created.code }
      },
      { timeout: 30_000, maxWait: 15_000 },
    )
  }

  async update(code: string, sectionId: number, body: unknown, actor: Actor) {
    return this.prisma.$transaction(
      async (tx) => {
        const term = await this.term(code)
        const current = await this.section(sectionId, term.id)
        const rooms = new Set(
          (await tx.room.findMany({ select: { code: true } })).map((r) => r.code),
        )
        const input = parseSectionInput(body, term.startDate, (room) => rooms.has(room))
        const snapshot = this.snapshot(current, term.startDate)
        phaseFieldErrors(term.phase, snapshot, input, current.enrolledCount)
        const refs = await this.references(term.id)
        const parent = input.parentCode
          ? refs.sections.find(
              (section) => section.code === input.parentCode && section.parentSectionId === null,
            )
          : undefined
        if (term.phase === TermPhase.PREPARATION) {
          if (input.parentCode && !parent)
            fail('PARENT_NOT_FOUND', 'Lớp lý thuyết cha không tồn tại.', 400, {
              parentCode: 'Không tìm thấy lớp cha.',
            })
          if (parent) {
            const parentOffering = refs.offerings.find((o) => o.id === parent.offeredCourseId)!
            const practiceId = refs.companionByCourseId.get(parentOffering.courseId)
            const offering = refs.offerings.find((item) => item.courseCode === input.courseCode)
            if (!practiceId || offering?.courseId !== practiceId)
              fail('GROUP_COURSE_INVALID', 'Nhóm thực hành phải thuộc môn thực hành đi kèm.', 400, {
                courseCode: 'Môn thực hành không khớp.',
              })
            if (input.practiceMode === 'SELF_SCHEDULED' && input.meetings.length > 0)
              fail('HT2_HAS_MEETINGS', 'HT2 – tự xếp lịch không được có buổi học.', 400, {
                meetings: 'HT2 không có buổi học.',
              })
            const mode = input.practiceMode ?? (parent.practiceMode as SectionInput['practiceMode'])
            if (!mode)
              fail('MODE_REQUIRED', 'Chọn hình thức thực hành HT1 hoặc HT2.', 400, {
                practiceMode: 'Bắt buộc.',
              })
          }
          const duplicate = await tx.courseSection.findFirst({
            where: {
              code: input.code,
              offeredCourse: { termId: term.id },
              id: { not: current.id },
            },
            select: { id: true },
          })
          if (duplicate)
            fail('CLASS_DUPLICATE', `Mã lớp ${input.code} đã tồn tại trong học kỳ.`, 400, {
              code: 'Mã lớp đã dùng.',
            })
        }
        const resolved = this.resolve(refs, input, parent)
        const editable = {
          offeredCourseId: resolved.offeringId,
          trainingSystemId: resolved.systemId,
          code: input.code,
          lecturerId: resolved.lecturerId,
          language: input.language,
          reservedAdmissionYear: input.reservedAdmissionYear,
          note: input.note,
          capacity: input.capacity,
          parentSectionId: resolved.parentSectionId,
          practiceMode: parent ? null : input.practiceMode,
        }
        await tx.courseSection.update({ where: { id: current.id }, data: editable })
        if (parent && input.practiceMode && parent.practiceMode !== input.practiceMode)
          await tx.courseSection.update({
            where: { id: parent.id },
            data: { practiceMode: input.practiceMode },
          })
        if (term.phase === TermPhase.PREPARATION) {
          await tx.meeting.deleteMany({ where: { sectionId: current.id } })
          await tx.meeting.createMany({
            data: input.meetings.map((meeting) => ({
              sectionId: current.id,
              ...this.meetingData(meeting),
            })),
          })
        } else {
          for (let index = 0; index < current.meetings.length; index++)
            await tx.meeting.update({
              where: { id: current.meetings[index]!.id },
              data: { room: input.meetings[index]!.room },
            })
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'section.update',
            entityType: 'CourseSection',
            entityId: String(current.id),
            payload: { before: snapshot, after: input, phase: term.phase },
            requestId: actor.requestId,
            ip: actor.ip,
          },
        })
        return { id: current.id, code: input.code }
      },
      { timeout: 30_000, maxWait: 15_000 },
    )
  }

  /** ADR-0002: deleting a parent removes its groups; deleting a group removes its parent and siblings. */
  async remove(code: string, sectionId: number, actor: Actor) {
    return this.prisma.$transaction(
      async (tx) => {
        const term = await this.term(code)
        assertPreparation(term.phase, 'xoá lớp học phần')
        const current = await this.section(sectionId, term.id)
        const ids = new Set<number>([current.id, ...current.practiceSections.map((row) => row.id)])
        if (current.parentSectionId) {
          const siblings = await tx.courseSection.findMany({
            where: { parentSectionId: current.parentSectionId },
            select: { id: true },
          })
          ids.add(current.parentSectionId)
          for (const sibling of siblings) ids.add(sibling.id)
        }
        const withEnrollments = await tx.courseSection.findMany({
          where: { id: { in: [...ids] }, enrolledCount: { gt: 0 } },
          select: { code: true },
        })
        if (withEnrollments.length > 0)
          fail(
            'SECTION_HAS_ENROLLMENTS',
            `Không xoá lớp đã có sinh viên đăng ký: ${withEnrollments.map((row) => row.code).join(', ')}.`,
            409,
          )
        await tx.courseSection.updateMany({
          where: { id: { in: [...ids] } },
          data: { parentSectionId: null },
        })
        await tx.meeting.deleteMany({ where: { sectionId: { in: [...ids] } } })
        await tx.courseSection.deleteMany({ where: { id: { in: [...ids] } } })
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'section.delete',
            entityType: 'CourseSection',
            entityId: String(current.id),
            payload: { codes: [...ids], deleted: [...ids].length },
            requestId: actor.requestId,
            ip: actor.ip,
          },
        })
        return { deleted: [...ids].length }
      },
      { timeout: 30_000, maxWait: 15_000 },
    )
  }

  /** ADR-0017/TKB-05: offering credits are editable only in PREPARATION and may be zero. */
  async updateCredits(code: string, offeringId: number, body: unknown, actor: Actor) {
    return this.prisma.$transaction(
      async (tx) => {
        const term = await this.term(code)
        assertCreditsPreparation(term.phase)
        const value = (body as { credits?: unknown } | null)?.credits
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
          fail('CREDITS_INVALID', 'Tín chỉ phải là số nguyên không âm.', 400, {
            credits: 'Tín chỉ không hợp lệ.',
          })
        const offering = await tx.offeredCourse.findFirst({
          where: { id: offeringId, termId: term.id },
          select: { id: true, credits: true },
        })
        if (!offering) fail('OFFERING_NOT_FOUND', 'Không tìm thấy môn mở.', 404)
        await tx.offeredCourse.update({ where: { id: offeringId }, data: { credits: value } })
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'offered_course.update_credits',
            entityType: 'OfferedCourse',
            entityId: String(offeringId),
            payload: { before: offering.credits, after: value },
            requestId: actor.requestId,
            ip: actor.ip,
          },
        })
        return { id: offeringId, credits: value }
      },
      { timeout: 30_000, maxWait: 15_000 },
    )
  }
}
