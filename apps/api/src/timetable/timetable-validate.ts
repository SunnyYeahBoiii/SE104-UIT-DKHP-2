import { rawText, type ImportIssue, type RawRow } from './timetable-parse'

export type CourseRef = {
  code: string
  type: 'THEORY' | 'PRACTICE'
  credits: number
  /** Companion practice code for a THEORY course, or companion theory code for a PRACTICE course. */
  companionCode?: string
}

export type ReferenceData = {
  courses: Map<string, CourseRef>
  courseIds: Map<string, number>
  lecturers: Map<string, number>
  rooms: Set<string>
  systems: Map<string, number>
}

export type PlannedMeeting = {
  sourceRow: number
  dayOfWeek: number
  startSlot: number
  endSlot: number
  room: string | null
  weeks: number
}

export type PlannedSection = {
  sourceRow: number
  courseCode: string
  classCode: string
  systemCode: string
  lecturerCode: string | null
  capacity: number
  reservedAdmissionYear: number | null
  language: string | null
  note: string | null
  parentClassCode: string | null
  practiceMode: 'SCHEDULED' | 'SELF_SCHEDULED' | null
  meetings: PlannedMeeting[]
}

export type ValidationResult = {
  offeredCourses: { courseCode: string; credits: number }[]
  sections: PlannedSection[]
  errors: ImportIssue[]
  warnings: ImportIssue[]
  summary: {
    offeredCourses: number
    sections: number
    practiceGroups: number
    meetings: number
  }
}

const DAY_MS = 86_400_000
const issue = (row: number, column: string, code: string, message: string): ImportIssue => ({
  row,
  column,
  code,
  message,
})

function parseSlots(text: string): { start: number; end: number } | null {
  const tokens = text
    .split(/[-–—,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (tokens.length === 0) return null
  const slots: number[] = []
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) return null
    const slot = Number(token)
    const resolved = slot === 0 ? 10 : slot
    if (resolved < 1 || resolved > 10) return null
    slots.push(resolved)
  }
  return { start: Math.min(...slots), end: Math.max(...slots) }
}

function parseDay(text: string): number | null {
  const value = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (/^(CN|CHU NHAT)$/.test(value)) return 8
  const match = /^(?:THU\s*)?([2-8])$/.exec(value)
  return match ? Number(match[1]) : null
}

function parseDate(text: string, raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime()))
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()))
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel serial dates count from 1899-12-30 (the 1900 leap-year bug baked into the format).
    return new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * DAY_MS)
  }
  const match = /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})$/.exec(text)
  if (!match) return null
  const a = Number(match[1])
  const b = Number(match[2])
  const c = Number(match[3])
  const year = a > 31 ? a : c
  const month = b
  const day = a > 31 ? c : a
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

function weekIndex(date: Date, termStart: Date): number {
  const start = Date.UTC(
    termStart.getUTCFullYear(),
    termStart.getUTCMonth(),
    termStart.getUTCDate(),
  )
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.max(1, Math.floor((day - start) / (7 * DAY_MS)) + 1)
}

export type ClashItem = {
  sourceRow: number
  classCode: string
  lecturerCode: string | null
  room: string | null
  dayOfWeek: number
  startSlot: number
  endSlot: number
  weeks: number
}

/** QĐ11.10/DT-10: same day, overlapping slots and at least one shared meeting date. */
export function findClashes(items: ClashItem[]): ImportIssue[] {
  const groups = new Map<string, { kind: 'room' | 'lecturer'; items: ClashItem[] }>()
  const add = (key: string, kind: 'room' | 'lecturer', item: ClashItem) => {
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, { kind, items: [item] })
  }
  for (const item of items) {
    if (item.room) add(`room:${item.room}:${item.dayOfWeek}`, 'room', item)
    if (item.lecturerCode) add(`lecturer:${item.lecturerCode}:${item.dayOfWeek}`, 'lecturer', item)
  }
  const warnings: ImportIssue[] = []
  const warned = new Set<string>()
  for (const group of groups.values()) {
    const isRoom = group.kind === 'room'
    const column = isRoom ? 'PHÒNG HỌC' : 'MÃ GV'
    for (let i = 0; i < group.items.length; i++) {
      for (let j = i + 1; j < group.items.length; j++) {
        const later = group.items[j]!
        const earlier = group.items[i]!
        if (
          earlier.startSlot > later.endSlot ||
          later.startSlot > earlier.endSlot ||
          (earlier.weeks & later.weeks) === 0
        )
          continue
        const key = `${later.sourceRow}:${column}`
        if (warned.has(key)) continue
        warned.add(key)
        warnings.push(
          issue(
            later.sourceRow,
            column,
            isRoom ? 'ROOM_CLASH' : 'LECTURER_CLASH',
            isRoom
              ? `Trùng phòng ${later.room} với lớp ${earlier.classCode} (dòng ${earlier.sourceRow}).`
              : `Trùng giảng viên ${later.lecturerCode} với lớp ${earlier.classCode} (dòng ${earlier.sourceRow}).`,
          ),
        )
      }
    }
  }
  return warnings
}

/**
 * Pure row parser and cross-row validator (TKB-03…TKB-07, DT-08…DT-12). Every problem is collected so the
 * officer can fix the file in one pass; a non-empty `errors` means the caller must not write anything.
 */
export function validateRows(
  rows: RawRow[],
  refs: ReferenceData,
  termStart: Date,
): ValidationResult {
  const errors: ImportIssue[] = []
  const sections: PlannedSection[] = []
  const seenClasses = new Map<string, number>()
  const parentByClass = new Map<string, { row: number; courseCode: string }>()
  const creditsByFileCourse = new Map<string, { value: number; row: number }>()
  const creditsByResolved = new Map<string, { value: number; row: number }>()

  // Two passes: a practice group may appear above its theory class in the school's file.
  for (const row of rows) {
    if (rawText(row, 'practice') !== '0' && rawText(row, 'practice') !== '') continue
    const code = rawText(row, 'classCode').toUpperCase()
    if (code)
      parentByClass.set(code, {
        row: row.excelRow,
        courseCode: rawText(row, 'courseCode').toUpperCase(),
      })
  }

  for (const row of rows) {
    const n = row.excelRow
    const rawCourse = rawText(row, 'courseCode').toUpperCase()
    const rawClass = rawText(row, 'classCode').toUpperCase()
    const systemCode = rawText(row, 'systemCode').toUpperCase()
    const practiceText = rawText(row, 'practice').toUpperCase()
    const modeText = rawText(row, 'mode').toUpperCase()
    const lecturerText = rawText(row, 'lecturerCode').toUpperCase()
    const roomText = rawText(row, 'room').toUpperCase()
    const cohortText = rawText(row, 'admissionYear')
    const capacityText = rawText(row, 'capacity')
    const creditsText = rawText(row, 'credits')
    const dayText = rawText(row, 'day')
    const slotsText = rawText(row, 'slots')
    const cadenceText = rawText(row, 'cadence') || '1'

    const course = refs.courses.get(rawCourse)
    if (!rawCourse)
      errors.push(issue(n, 'MÃ MH', 'COURSE_REQUIRED', 'Mã môn học không được trống.'))
    else if (!course)
      errors.push(
        issue(n, 'MÃ MH', 'COURSE_UNKNOWN', `${rawCourse} không có trong danh mục môn học.`),
      )

    if (!rawClass) errors.push(issue(n, 'MÃ LỚP', 'CLASS_REQUIRED', 'Mã lớp không được trống.'))
    else if (seenClasses.has(rawClass))
      errors.push(
        issue(
          n,
          'MÃ LỚP',
          'CLASS_DUPLICATE',
          `Mã lớp ${rawClass} đã dùng ở dòng ${seenClasses.get(rawClass)}.`,
        ),
      )
    else seenClasses.set(rawClass, n)

    if (!systemCode)
      errors.push(issue(n, 'HỆ ĐT', 'SYSTEM_REQUIRED', 'Hệ đào tạo không được trống.'))
    else if (!refs.systems.has(systemCode))
      errors.push(
        issue(n, 'HỆ ĐT', 'SYSTEM_UNKNOWN', `${systemCode} không có trong danh mục hệ đào tạo.`),
      )

    const capacityMatch = /^(\d+)\s*(?:\(.*\))?$/.exec(capacityText)
    const capacity = capacityMatch ? Number(capacityMatch[1]) : 0
    if (!capacityMatch || capacity <= 0)
      errors.push(
        issue(
          n,
          'SĨ SỐ',
          'CAPACITY_INVALID',
          `Sĩ số "${capacityText}" không hợp lệ; phải là số nguyên dương (ví dụ 120(0) → 120).`,
        ),
      )

    let practice = 0
    if (practiceText && practiceText !== '0' && practiceText !== '1') {
      errors.push(
        issue(
          n,
          'THỰC HÀNH',
          'PRACTICE_INVALID',
          `THỰC HÀNH "${practiceText}" không hợp lệ; chỉ nhận 0 hoặc 1.`,
        ),
      )
    } else practice = practiceText === '1' ? 1 : 0

    let mode: 'SCHEDULED' | 'SELF_SCHEDULED' | null = null
    if (modeText === 'HT1') mode = 'SCHEDULED'
    else if (modeText === 'HT2') mode = 'SELF_SCHEDULED'
    else if (modeText && modeText !== 'LT')
      errors.push(
        issue(
          n,
          'HTGD',
          'MODE_INVALID',
          `HTGD "${modeText}" không hợp lệ; chỉ nhận HT1 hoặc HT2 cho nhóm thực hành.`,
        ),
      )

    const lecturerCode =
      !lecturerText || lecturerText === '*' ? null : lecturerText.replace(/\s+/g, '')
    if (lecturerCode && !refs.lecturers.has(lecturerCode))
      errors.push(
        issue(
          n,
          'MÃ GV',
          'LECTURER_UNKNOWN',
          `${lecturerCode} không có trong danh mục giảng viên.`,
        ),
      )

    const room = !roomText || roomText === '*' ? null : roomText.replace(/\s+/g, '')
    if (room && !refs.rooms.has(room))
      errors.push(
        issue(n, 'PHÒNG HỌC', 'ROOM_UNKNOWN', `${room} không có trong danh mục phòng học.`),
      )

    let reservedAdmissionYear: number | null = null
    if (cohortText && cohortText !== '0') {
      if (/^\d{4}$/.test(cohortText)) reservedAdmissionYear = Number(cohortText)
      else if (/^\d{2}$/.test(cohortText)) reservedAdmissionYear = 2005 + Number(cohortText)
      if (
        reservedAdmissionYear === null ||
        reservedAdmissionYear < 1900 ||
        reservedAdmissionYear > 2100
      )
        errors.push(
          issue(
            n,
            'KHOÁ HỌC',
            'COHORT_INVALID',
            `Khoá học "${cohortText}" không hợp lệ (0 nghĩa là mọi khoá).`,
          ),
        )
    }

    let credits = course?.credits ?? 0
    if (creditsText) {
      if (!/^\d+$/.test(creditsText))
        errors.push(
          issue(
            n,
            'TỐ TC',
            'CREDITS_INVALID',
            `TỐ TC "${creditsText}" không hợp lệ; phải là số nguyên không âm.`,
          ),
        )
      else credits = Number(creditsText)
    }
    if (course) {
      const previous = creditsByFileCourse.get(rawCourse)
      if (!previous) creditsByFileCourse.set(rawCourse, { value: credits, row: n })
      else if (previous.value !== credits) {
        errors.push(
          issue(
            n,
            'TỐ TC',
            'CREDITS_INCONSISTENT',
            `${rawCourse} có dòng ${previous.row} ghi ${previous.value} tín chỉ, dòng ${n} ghi ${credits}.`,
          ),
        )
      }
    }

    const meetings: PlannedMeeting[] = []
    const noSchedule = (!dayText || dayText === '*') && (!slotsText || slotsText === '*')
    if (!noSchedule) {
      const dayOfWeek = parseDay(dayText)
      if (dayOfWeek === null)
        errors.push(
          issue(n, 'THỨ', 'DAY_INVALID', `Thứ "${dayText}" không hợp lệ; phải từ 2 đến 8.`),
        )
      const slots = parseSlots(slotsText)
      if (!slots)
        errors.push(
          issue(
            n,
            'TIẾT',
            'SLOTS_INVALID',
            `Tiết "${slotsText}" không hợp lệ (0 nghĩa là tiết 10, vào khoảng 1–10).`,
          ),
        )
      const startDate = parseDate(rawText(row, 'startDate'), row.values.startDate)
      const endDate = parseDate(rawText(row, 'endDate'), row.values.endDate)
      if (!startDate)
        errors.push(
          issue(n, 'NBD', 'START_DATE_INVALID', `NBD "${rawText(row, 'startDate')}" không hợp lệ.`),
        )
      if (!endDate)
        errors.push(
          issue(n, 'NKT', 'END_DATE_INVALID', `NKT "${rawText(row, 'endDate')}" không hợp lệ.`),
        )
      const cadence = /^\d+$/.test(cadenceText) ? Number(cadenceText) : 0
      if (cadence !== 1 && cadence !== 2)
        errors.push(
          issue(
            n,
            'CÁCH TUẦN',
            'CADENCE_INVALID',
            `CÁCH TUẦN "${cadenceText}" không hợp lệ; chỉ nhận 1 (mỗi tuần) hoặc 2 (cách tuần).`,
          ),
        )
      if (startDate && endDate && startDate > endDate)
        errors.push(issue(n, 'NKT', 'DATE_ORDER', 'NBD phải không muộn hơn NKT.'))
      if (startDate && endDate && (cadence === 1 || cadence === 2)) {
        const from = weekIndex(startDate, termStart)
        const to = weekIndex(endDate, termStart)
        if (to - from > 52)
          errors.push(issue(n, 'NKT', 'DATE_RANGE_TOO_LONG', 'Khoảng NBD–NKT vượt quá 52 tuần.'))
        else {
          let weeks = 0
          for (let week = from; week <= to; week += cadence) weeks |= 1 << (week - 1)
          if (dayOfWeek !== null && slots && weeks > 0)
            meetings.push({
              sourceRow: n,
              dayOfWeek,
              startSlot: slots.start,
              endSlot: slots.end,
              room,
              weeks,
            })
        }
      }
    }

    let resolvedCourse = rawCourse
    let parentClassCode: string | null = null
    const companion = course?.companionCode ? refs.courses.get(course.companionCode) : undefined
    const groupMatch = /^(.*)\.(\d+)$/.exec(rawClass)
    if (practice === 1 && companion) {
      resolvedCourse = companion.code
      if (!groupMatch)
        errors.push(
          issue(
            n,
            'MÃ LỚP',
            'GROUP_CODE_INVALID',
            `Nhóm thực hành ${rawClass} phải có mã <mã lớp LT>.n (ví dụ SE104.P21.1).`,
          ),
        )
      else {
        const base = groupMatch[1]!.toUpperCase()
        if (!parentByClass.has(base))
          errors.push(
            issue(
              n,
              'MÃ LỚP',
              'GROUP_PARENT_MISSING',
              `Không tìm thấy lớp lý thuyết ${base} trong tệp cho nhóm thực hành ${rawClass}.`,
            ),
          )
        else parentClassCode = base
      }
      if (!mode)
        errors.push(
          issue(n, 'HTGD', 'MODE_REQUIRED', `Nhóm thực hành ${rawClass} phải ghi HT1 hoặc HT2.`),
        )
      if (mode === 'SELF_SCHEDULED') meetings.length = 0
    } else if (practice === 1 && course?.type === 'THEORY') {
      errors.push(
        issue(
          n,
          'THỰC HÀNH',
          'COMPANION_MISSING',
          `Môn ${rawCourse} không có môn thực hành đi kèm để tạo nhóm.`,
        ),
      )
    }

    const resolvedCredits = creditsByResolved.get(resolvedCourse)
    if (!resolvedCredits) creditsByResolved.set(resolvedCourse, { value: credits, row: n })
    else if (resolvedCredits.value !== credits)
      errors.push(
        issue(
          n,
          'TỐ TC',
          'CREDITS_INCONSISTENT',
          `${resolvedCourse} có dòng ${resolvedCredits.row} ghi ${resolvedCredits.value} tín chỉ, dòng ${n} ghi ${credits}.`,
        ),
      )

    sections.push({
      sourceRow: n,
      courseCode: resolvedCourse,
      classCode: rawClass,
      systemCode,
      lecturerCode,
      capacity,
      reservedAdmissionYear,
      language: rawText(row, 'language').toUpperCase() || null,
      note: rawText(row, 'note') || null,
      parentClassCode,
      practiceMode: parentClassCode ? mode : null,
      meetings,
    })
  }

  const modeByParent = new Map<string, { value: string; row: number }>()
  for (const section of sections) {
    if (!section.parentClassCode || !section.practiceMode) continue
    const previous = modeByParent.get(section.parentClassCode)
    if (!previous) {
      modeByParent.set(section.parentClassCode, {
        value: section.practiceMode,
        row: section.sourceRow,
      })
    } else if (previous.value !== section.practiceMode) {
      errors.push(
        issue(
          section.sourceRow,
          'HTGD',
          'MODE_INCONSISTENT',
          `Các nhóm của ${section.parentClassCode} phải cùng HTGD; dòng ${previous.row} ghi ${previous.value}.`,
        ),
      )
    }
  }
  for (const section of sections) {
    if (!section.parentClassCode) continue
    const parent = sections.find(
      (item) => item.classCode === section.parentClassCode && !item.parentClassCode,
    )
    if (parent && !parent.practiceMode) parent.practiceMode = section.practiceMode
  }

  const offeredCourses = [...creditsByResolved.entries()].map(([courseCode, info]) => ({
    courseCode,
    credits: info.value,
  }))

  const withMeetings = sections.flatMap((section) =>
    section.meetings.map((meeting) => ({ section, meeting })),
  )
  const warnings = findClashes(
    withMeetings.map(({ section, meeting }) => ({
      sourceRow: meeting.sourceRow,
      classCode: section.classCode,
      lecturerCode: section.lecturerCode,
      room: meeting.room,
      dayOfWeek: meeting.dayOfWeek,
      startSlot: meeting.startSlot,
      endSlot: meeting.endSlot,
      weeks: meeting.weeks,
    })),
  )

  const uniqueErrors = [...new Map(errors.map((e) => [`${e.row}:${e.code}`, e])).values()]

  return {
    offeredCourses,
    sections,
    errors: uniqueErrors,
    warnings,
    summary: {
      offeredCourses: offeredCourses.length,
      sections: sections.length,
      practiceGroups: sections.filter((section) => section.parentClassCode).length,
      meetings: withMeetings.length,
    },
  }
}
