import { HttpException, Injectable, NotFoundException } from '@nestjs/common'

import type { Actor } from '../academics/academics.service'
import { TermPhase } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { parseWorkbook, type ImportIssue } from './timetable-parse'
import {
  findClashes,
  validateRows,
  type CourseRef,
  type ReferenceData,
  type ValidationResult,
} from './timetable-validate'

const MAX_FILE_BYTES = 10 * 1024 * 1024

type TermRow = {
  id: number
  termCode: string
  phase: TermPhase
  startDate: Date
}

type PreviewRequest = { fileBase64?: unknown; fileName?: unknown }

export type PreviewView = {
  termCode: string
  phase: TermPhase
  canImport: boolean
  reason: string | null
  fileName: string | null
  rowCount: number
  errors: ImportIssue[]
  warnings: ImportIssue[]
  summary: ValidationResult['summary'] | null
  existing: { offeredCourses: number; sections: number }
}

function badRequest(code: string, message: string, extra: Record<string, unknown> = {}): never {
  throw new HttpException({ code, message, ...extra }, 400)
}

function fileBytes(body: unknown): { bytes: Buffer; fileName: string | null } {
  const request = (body ?? {}) as PreviewRequest
  if (typeof request.fileBase64 !== 'string' || request.fileBase64.length === 0)
    badRequest('FILE_REQUIRED', 'Vui lòng chọn tệp Excel thời khoá biểu.')
  const base64 = request.fileBase64.replace(/^data:[^,]*,/, '')
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length === 0) badRequest('FILE_INVALID', 'Tệp Excel không đọc được.')
  if (bytes.length > MAX_FILE_BYTES) badRequest('FILE_TOO_LARGE', 'Tệp vượt quá 10 MB.')
  return {
    bytes,
    fileName: typeof request.fileName === 'string' ? request.fileName : null,
  }
}

/**
 * TKB-01…TKB-07: one file describes the whole term. Re-import replaces everything in a single transaction,
 * and reference data is read-only here (ADR-0019). The parser and validator stay pure; this service owns DB
 * access, the phase guard and the audit row (ADR-0007/NFR-10).
 */
@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTerm(code: string): Promise<TermRow> {
    const term = await this.prisma.term.findUnique({
      where: { termCode: code },
      select: { id: true, termCode: true, phase: true, startDate: true },
    })
    if (!term)
      throw new NotFoundException({ code: 'TERM_NOT_FOUND', message: 'Không tìm thấy học kỳ.' })
    return term
  }

  private importPermission(term: TermRow): { canImport: boolean; reason: string | null } {
    if (term.phase === TermPhase.PREPARATION) return { canImport: true, reason: null }
    const labels: Record<TermPhase, string> = {
      PREPARATION: 'Chuẩn bị',
      REGISTRATION: 'Đăng ký',
      ADJUSTMENT: 'Điều chỉnh',
      IN_PROGRESS: 'Đang học',
      CLOSED: 'Đã kết thúc',
    }
    return {
      canImport: false,
      reason: `Học kỳ đang ở giai đoạn ${labels[term.phase]}; chỉ nhập thời khoá biểu khi ở giai đoạn Chuẩn bị.`,
    }
  }

  private async references(): Promise<ReferenceData> {
    const [courses, lecturers, rooms, systems] = await Promise.all([
      this.prisma.course.findMany({
        select: { id: true, code: true, type: true, credits: true, companionTheoryCourseId: true },
      }),
      this.prisma.lecturer.findMany({ select: { id: true, lecturerCode: true } }),
      this.prisma.room.findMany({ select: { code: true } }),
      this.prisma.trainingSystem.findMany({ select: { id: true, code: true } }),
    ])
    const byId = new Map(courses.map((course) => [course.id, course.code]))
    const courseRefs = new Map<string, CourseRef>(
      courses.map((course) => [
        course.code,
        {
          code: course.code,
          type: course.type,
          credits: course.credits,
          companionCode: course.companionTheoryCourseId
            ? byId.get(course.companionTheoryCourseId)
            : undefined,
        },
      ]),
    )
    // A THEORY course points at no companion directly; find it from its practice course (ADR-0002).
    for (const course of courses) {
      if (!course.companionTheoryCourseId) continue
      const theory = byId.get(course.companionTheoryCourseId)
      if (theory) courseRefs.get(theory)!.companionCode = course.code
    }
    return {
      courses: courseRefs,
      courseIds: new Map(courses.map((course) => [course.code, course.id])),
      lecturers: new Map(lecturers.map((item) => [item.lecturerCode, item.id])),
      rooms: new Set(rooms.map((item) => item.code)),
      systems: new Map(systems.map((item) => [item.code, item.id])),
    }
  }

  private async existingCounts(termId: number) {
    const [offeredCourses, sections] = await Promise.all([
      this.prisma.offeredCourse.count({ where: { termId } }),
      this.prisma.courseSection.count({ where: { offeredCourse: { termId } } }),
    ])
    return { offeredCourses, sections }
  }

  /** Preview and import run the exact same validator, so a clean report always imports. */
  private async analyze(code: string, body: unknown) {
    const [term, refs] = await Promise.all([this.getTerm(code), this.references()])
    const { bytes, fileName } = fileBytes(body)
    let workbook: Awaited<ReturnType<typeof parseWorkbook>>
    try {
      workbook = await parseWorkbook(bytes)
    } catch {
      badRequest('FILE_INVALID', 'Tệp Excel không hợp lệ hoặc bị hỏng.')
    }
    const fileIssues: ImportIssue[] = [...workbook.issues]
    if (fileIssues.length === 0 && workbook.rows.length === 0)
      fileIssues.push({
        row: 1,
        column: 'FILE',
        code: 'EMPTY_FILE',
        message: 'Tệp không có dòng dữ liệu thời khoá biểu.',
      })
    const result: ValidationResult =
      fileIssues.length > 0
        ? {
            offeredCourses: [],
            sections: [],
            errors: fileIssues,
            warnings: [],
            summary: { offeredCourses: 0, sections: 0, practiceGroups: 0, meetings: 0 },
          }
        : validateRows(workbook.rows, refs, term.startDate)
    return { term, refs, fileName, rowCount: workbook.rows.length, result }
  }

  async preview(code: string, body: unknown): Promise<PreviewView> {
    const { term, fileName, rowCount, result } = await this.analyze(code, body)
    return {
      termCode: term.termCode,
      phase: term.phase,
      ...this.importPermission(term),
      fileName,
      rowCount,
      errors: result.errors,
      warnings: result.warnings,
      summary: result.summary,
      existing: await this.existingCounts(term.id),
    }
  }

  async import(code: string, body: unknown, actor: Actor) {
    const { term, refs, result } = await this.analyze(code, body)
    const permission = this.importPermission(term)
    if (!permission.canImport)
      throw new HttpException({ code: 'TERM_NOT_IMPORTABLE', message: permission.reason! }, 409)
    if (result.errors.length > 0)
      badRequest('IMPORT_VALIDATION_FAILED', 'Tệp còn lỗi; chưa ghi dữ liệu nào.', {
        errors: result.errors,
        warnings: result.warnings,
      })

    const existing = await this.existingCounts(term.id)
    if ((body as { confirmReplace?: unknown })?.confirmReplace !== true && existing.sections > 0)
      throw new HttpException(
        {
          code: 'REPLACE_CONFIRMATION_REQUIRED',
          message: `Học kỳ đã có ${existing.offeredCourses} môn mở và ${existing.sections} lớp. Xác nhận thay toàn bộ thời khoá biểu?`,
          existing,
        },
        409,
      )

    const enrolled = await this.prisma.enrollment.count({
      where: { section: { offeredCourse: { termId: term.id } } },
    })
    if (enrolled > 0)
      throw new HttpException(
        {
          code: 'TERM_HAS_REGISTRATIONS',
          message: 'Học kỳ đã có đăng ký; không thay toàn bộ thời khoá biểu.',
        },
        409,
      )

    const counts = await this.prisma.$transaction(async (tx) => {
      const oldSections = await tx.courseSection.findMany({
        where: { offeredCourse: { termId: term.id } },
        select: { id: true },
      })
      if (oldSections.length > 0) {
        await tx.courseSection.updateMany({
          where: { id: { in: oldSections.map((item) => item.id) } },
          data: { parentSectionId: null },
        })
        await tx.courseSection.deleteMany({
          where: { id: { in: oldSections.map((item) => item.id) } },
        })
      }
      await tx.offeredCourse.deleteMany({ where: { termId: term.id } })

      const offeredIds = new Map<string, number>()
      for (const offering of result.offeredCourses) {
        const created = await tx.offeredCourse.create({
          data: {
            termId: term.id,
            courseId: refs.courseIds.get(offering.courseCode)!,
            credits: offering.credits,
          },
        })
        offeredIds.set(offering.courseCode, created.id)
      }

      const sectionIds = new Map<string, number>()
      const parents = result.sections.filter((section) => !section.parentClassCode)
      const groups = result.sections.filter((section) => section.parentClassCode)
      for (const section of [...parents, ...groups]) {
        const created = await tx.courseSection.create({
          data: {
            offeredCourseId: offeredIds.get(section.courseCode)!,
            trainingSystemId: refs.systems.get(section.systemCode)!,
            code: section.classCode,
            lecturerId: section.lecturerCode
              ? (refs.lecturers.get(section.lecturerCode) ?? null)
              : null,
            language: section.language,
            reservedAdmissionYear: section.reservedAdmissionYear,
            note: section.note,
            capacity: section.capacity,
            parentSectionId: section.parentClassCode
              ? (sectionIds.get(section.parentClassCode) ?? null)
              : null,
            practiceMode: section.parentClassCode ? null : section.practiceMode,
            meetings: {
              create: section.meetings.map((meeting) => ({
                dayOfWeek: meeting.dayOfWeek,
                startSlot: meeting.startSlot,
                endSlot: meeting.endSlot,
                room: meeting.room ?? '',
                weeks: meeting.weeks,
              })),
            },
          },
        })
        sectionIds.set(section.classCode, created.id)
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'TIMETABLE_IMPORTED',
          entityType: 'term',
          entityId: String(term.id),
          payload: {
            termCode: term.termCode,
            rowCount: result.sections.length,
            ...result.summary,
          },
          requestId: actor.requestId,
          ip: actor.ip,
        },
      })
      return result.summary
    })

    return {
      termCode: term.termCode,
      counts: counts,
      warnings: result.warnings,
    }
  }

  /** Read model behind the post-import tables; clashes are derived from the stored meetings. */
  async overview(code: string) {
    const term = await this.getTerm(code)
    const [offered, sections, lecturers] = await Promise.all([
      this.prisma.offeredCourse.findMany({
        where: { termId: term.id },
        include: { course: true, sections: true },
        orderBy: { course: { code: 'asc' } },
      }),
      this.prisma.courseSection.findMany({
        where: { offeredCourse: { termId: term.id } },
        include: {
          offeredCourse: { include: { course: true } },
          trainingSystem: true,
          lecturer: true,
          parentSection: { select: { code: true } },
          meetings: true,
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.lecturer.findMany({ select: { id: true, lecturerCode: true } }),
    ])
    const lecturerById = new Map(lecturers.map((item) => [item.id, item.lecturerCode]))

    const clashItems = sections.flatMap((section) =>
      section.meetings.map((meeting) => ({
        sourceRow: section.id,
        classCode: section.code,
        lecturerCode: section.lecturerId ? (lecturerById.get(section.lecturerId) ?? null) : null,
        room: meeting.room || null,
        dayOfWeek: meeting.dayOfWeek,
        startSlot: meeting.startSlot,
        endSlot: meeting.endSlot,
        weeks: meeting.weeks,
      })),
    )
    const warnings = findClashes(clashItems)
    const warnedSections = new Set(warnings.map((warning) => warning.row))

    return {
      term: {
        code: term.termCode,
        phase: term.phase,
        ...this.importPermission(term),
      },
      counts: {
        offeredCourses: offered.length,
        sections: sections.length,
        practiceGroups: sections.filter((section) => section.parentSectionId !== null).length,
        meetings: clashItems.length,
      },
      warnings,
      offeredCourses: offered.map((item) => ({
        id: item.id,
        code: item.course.code,
        name: item.course.name,
        type: item.course.type,
        credits: item.credits,
        defaultCredits: item.course.credits,
        sectionCount: item.sections.length,
        totalCapacity: item.sections.reduce((sum, section) => sum + section.capacity, 0),
      })),
      sections: sections.map((section) => ({
        id: section.id,
        code: section.code,
        courseCode: section.offeredCourse.course.code,
        courseName: section.offeredCourse.course.name,
        systemCode: section.trainingSystem.code,
        lecturerCode: section.lecturerId ? (lecturerById.get(section.lecturerId) ?? null) : null,
        capacity: section.capacity,
        enrolledCount: section.enrolledCount,
        reservedAdmissionYear: section.reservedAdmissionYear,
        language: section.language,
        note: section.note,
        meetingCount: section.meetings.length,
        practiceMode: section.practiceMode,
        parentCode: section.parentSection?.code ?? null,
        hasWarning: warnedSections.has(section.id),
      })),
    }
  }
}
