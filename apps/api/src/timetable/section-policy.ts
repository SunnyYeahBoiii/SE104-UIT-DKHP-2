import { HttpException } from '@nestjs/common'

import type { TermPhase } from '../generated/prisma/enums'

const DAY_MS = 86_400_000

export type MeetingInput = {
  dayOfWeek: number
  startSlot: number
  endSlot: number
  room: string
  startDate: string
  endDate: string
  cadence: 1 | 2
}

export type NormalizedMeeting = MeetingInput & { weeks: number }

export type SectionInput = {
  code: string
  courseCode: string
  systemCode: string
  lecturerCode: string | null
  capacity: number
  reservedAdmissionYear: number | null
  language: string | null
  note: string | null
  practiceMode: 'SCHEDULED' | 'SELF_SCHEDULED' | null
  parentCode: string | null
  meetings: MeetingInput[]
}

export type SectionSnapshot = Omit<SectionInput, 'meetings'> & {
  meetings: NormalizedMeeting[]
}

export type FieldErrors = Record<string, string>

function invalid(code: string, message: string, fieldErrors: FieldErrors = {}): never {
  throw new HttpException({ code, message, fieldErrors }, 400)
}

const locked = (fieldErrors: FieldErrors, field: string, message: string) => {
  fieldErrors[field] ??= message
}

const same = (left: unknown, right: unknown) =>
  (left ?? null) === (right ?? null) ||
  (typeof left === 'string' && left.trim() === '' && (right === null || right === undefined))

function day(value: string, field: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match)
    invalid('DATE_INVALID', `${field} phải có dạng YYYY-MM-DD.`, { [field]: 'Ngày không hợp lệ.' })
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  )
    invalid('DATE_INVALID', `${field} không phải là ngày hợp lệ.`, {
      [field]: 'Ngày không hợp lệ.',
    })
  return date
}

const utcDay = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

/** Week 1 is the Monday of the term, which is how Meeting.weeks is indexed (TKB-06). */
export function weekIndex(value: Date, termStart: Date): number {
  return Math.max(1, Math.floor((utcDay(value) - utcDay(termStart)) / (7 * DAY_MS)) + 1)
}

export function weeksFromDates(
  termStart: Date,
  startDate: string,
  endDate: string,
  cadence: 1 | 2,
): number {
  const from = weekIndex(day(startDate, 'startDate'), termStart)
  const to = weekIndex(day(endDate, 'endDate'), termStart)
  if (to - from > 52)
    invalid('DATE_RANGE_TOO_LONG', 'Khoảng ngày học vượt quá 52 tuần.', {
      endDate: 'Khoảng ngày học quá dài.',
    })
  let weeks = 0
  for (let week = from; week <= to; week += cadence) weeks |= 1 << (week - 1)
  return weeks
}

/** Stored meetings keep only a bitmask; the form reconstructs its dates from that bitmask. */
export function datesFromWeeks(termStart: Date, dayOfWeek: number, weeks: number) {
  const bits: number[] = []
  for (let bit = 0; bit < 31; bit++) if ((weeks & (1 << bit)) !== 0) bits.push(bit)
  if (bits.length === 0) return { startDate: '', endDate: '', cadence: 1 as const }
  const steps = new Set(bits.slice(1).map((bit, index) => bit - bits[index]!))
  const step = [...steps][0]
  const cadence: 1 | 2 = steps.size === 1 && (step === 1 || step === 2) ? step : 1
  const firstDay = utcDay(termStart) + (dayOfWeek - 2) * DAY_MS
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10)
  return {
    startDate: iso(firstDay + bits[0]! * 7 * DAY_MS),
    endDate: iso(firstDay + bits[bits.length - 1]! * 7 * DAY_MS),
    cadence,
  }
}

/** "Sao chép lịch nhóm trước, lùi một tuần": same pattern, first date one week later. */
export function shiftMeetingWeek(meeting: MeetingInput): MeetingInput {
  const plusWeek = (value: string) =>
    new Date(day(value, 'date').getTime() + 7 * DAY_MS).toISOString().slice(0, 10)
  return { ...meeting, startDate: plusWeek(meeting.startDate), endDate: plusWeek(meeting.endDate) }
}

const optionalText = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string')
    invalid('INVALID_REQUEST', `${field} phải là chuỗi.`, { [field]: 'Không hợp lệ.' })
  const text = value.trim()
  return text === '' ? null : text
}

function meetingInput(
  value: unknown,
  index: number,
  termStart: Date,
  allowRoom: (r: string) => boolean,
): NormalizedMeeting {
  const field = (name: string) => `meetings.${index}.${name}`
  const item = (value ?? {}) as Record<string, unknown>
  const integer = (name: string) => {
    const number = item[name]
    if (typeof number !== 'number' || !Number.isInteger(number))
      invalid('INVALID_REQUEST', `${field(name)} phải là số nguyên.`, {
        [field(name)]: 'Không hợp lệ.',
      })
    return number
  }
  const dayOfWeek = integer('dayOfWeek')
  const startSlot = integer('startSlot')
  const endSlot = integer('endSlot')
  if (dayOfWeek < 2 || dayOfWeek > 8)
    invalid('DAY_INVALID', 'Thứ phải từ 2 đến 8.', { [field('dayOfWeek')]: 'Thứ không hợp lệ.' })
  if (startSlot < 1 || startSlot > 10 || endSlot < 1 || endSlot > 10 || startSlot > endSlot)
    invalid(
      'SLOTS_INVALID',
      'Tiết phải nằm trong 1–10 và tiết bắt đầu không lớn hơn tiết kết thúc.',
      {
        [field('startSlot')]: 'Tiết không hợp lệ.',
        [field('endSlot')]: 'Tiết không hợp lệ.',
      },
    )
  if (typeof item.room !== 'string')
    invalid('INVALID_REQUEST', `${field('room')} phải là chuỗi.`, {
      [field('room')]: 'Không hợp lệ.',
    })
  const room = item.room.trim().toUpperCase()
  if (room && !allowRoom(room))
    invalid('ROOM_UNKNOWN', `Phòng ${room} không có trong danh mục phòng học.`, {
      [field('room')]: 'Phòng không hợp lệ.',
    })
  if (typeof item.startDate !== 'string' || typeof item.endDate !== 'string')
    invalid('DATE_INVALID', 'Buổi học cần ngày bắt đầu và ngày kết thúc.', {
      [field('startDate')]: 'Thiếu ngày.',
    })
  const startDate = day(item.startDate, field('startDate')).toISOString().slice(0, 10)
  const endDate = day(item.endDate, field('endDate')).toISOString().slice(0, 10)
  if (startDate > endDate)
    invalid('DATE_ORDER', 'Ngày bắt đầu phải không muộn hơn ngày kết thúc.', {
      [field('endDate')]: 'Ngày kết thúc trước ngày bắt đầu.',
    })
  const cadence = item.cadence === 2 ? 2 : item.cadence === 1 ? 1 : 0
  if (cadence === 0)
    invalid('CADENCE_INVALID', 'Nhịp chỉ nhận 1 (mỗi tuần) hoặc 2 (cách tuần).', {
      [field('cadence')]: 'Nhịp không hợp lệ.',
    })
  return {
    dayOfWeek,
    startSlot,
    endSlot,
    room,
    startDate,
    endDate,
    cadence,
    weeks: weeksFromDates(termStart, startDate, endDate, cadence),
  }
}

export function parseSectionInput(
  body: unknown,
  termStart: Date,
  allowRoom: (room: string) => boolean,
): Omit<SectionInput, 'meetings'> & { meetings: NormalizedMeeting[] } {
  const item = (body ?? {}) as Record<string, unknown>
  const text = (name: string, label: string) => {
    const value = item[name]
    if (typeof value !== 'string' || value.trim() === '')
      invalid('INVALID_REQUEST', `${label} không được trống.`, { [name]: 'Bắt buộc.' })
    return value.trim().toUpperCase()
  }
  const capacity = item.capacity
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0)
    invalid('CAPACITY_INVALID', 'Sĩ số phải là số nguyên lớn hơn 0.', {
      capacity: 'Sĩ số phải lớn hơn 0.',
    })
  const year = item.reservedAdmissionYear
  if (
    year !== null &&
    year !== undefined &&
    (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 2100)
  )
    invalid('COHORT_INVALID', 'Khoá dành cho không hợp lệ.', {
      reservedAdmissionYear: 'Khoá không hợp lệ.',
    })
  const mode = item.practiceMode
  if (mode !== null && mode !== undefined && mode !== 'SCHEDULED' && mode !== 'SELF_SCHEDULED')
    invalid('MODE_INVALID', 'Hình thức thực hành chỉ nhận HT1 hoặc HT2.', {
      practiceMode: 'Hình thức không hợp lệ.',
    })
  const meetings = item.meetings
  if (!Array.isArray(meetings))
    invalid('INVALID_REQUEST', 'Buổi học phải là danh sách.', { meetings: 'Không hợp lệ.' })
  const parsed = meetings.map((meeting, index) =>
    meetingInput(meeting, index, termStart, allowRoom),
  )
  if (
    parsed.length > 0 &&
    new Set(parsed.map((meeting) => `${meeting.dayOfWeek}:${meeting.startSlot}`)).size !==
      parsed.length
  )
    invalid('MEETING_DUPLICATE', 'Hai buổi học không được trùng thứ và tiết bắt đầu.', {
      meetings: 'Buổi học trùng lịch.',
    })
  return {
    code: text('code', 'Mã lớp'),
    courseCode: text('courseCode', 'Môn mở'),
    systemCode: text('systemCode', 'Hệ đào tạo'),
    lecturerCode: optionalText(item.lecturerCode, 'lecturerCode'),
    capacity,
    reservedAdmissionYear: year ?? null,
    language: optionalText(item.language, 'language'),
    note: optionalText(item.note, 'note'),
    practiceMode: mode ?? null,
    parentCode: optionalText(item.parentCode, 'parentCode'),
    meetings: parsed,
  }
}

export function phaseFieldErrors(
  phase: TermPhase,
  current: SectionSnapshot,
  next: SectionSnapshot,
  enrolledCount: number,
): FieldErrors {
  if (phase === 'PREPARATION') return {}
  const errors: FieldErrors = {}
  const reason = 'Từ giai đoạn Đăng ký chỉ sửa được sĩ số và điền giảng viên, phòng còn trống.'
  for (const field of [
    'code',
    'courseCode',
    'systemCode',
    'reservedAdmissionYear',
    'language',
    'note',
    'practiceMode',
    'parentCode',
  ] as const)
    if (!same(current[field], next[field])) locked(errors, field, reason)
  if (!same(current.lecturerCode, next.lecturerCode) && current.lecturerCode !== null)
    locked(errors, 'lecturerCode', 'Chỉ điền giảng viên khi lớp chưa có giảng viên.')
  if (next.capacity < enrolledCount)
    locked(errors, 'capacity', `Sĩ số không được thấp hơn số đã đăng ký (${enrolledCount}).`)
  if (current.meetings.length !== next.meetings.length) locked(errors, 'meetings', reason)
  else
    for (let index = 0; index < current.meetings.length; index++) {
      const before = current.meetings[index]!
      const after = next.meetings[index]!
      for (const field of ['dayOfWeek', 'startSlot', 'endSlot', 'weeks'] as const)
        if (before[field] !== after[field])
          locked(errors, `meetings.${index}.${field}`, 'Không đổi lịch từ giai đoạn Đăng ký.')
      if (!same(before.room, after.room) && before.room !== '')
        locked(errors, `meetings.${index}.room`, 'Chỉ điền phòng khi buổi học chưa có phòng.')
    }
  if (Object.keys(errors).length > 0) invalid('PHASE_LOCKED', reason, errors)
  return errors
}

export function assertPreparation(phase: TermPhase, action: string) {
  if (phase !== 'PREPARATION')
    throw new HttpException(
      {
        code: 'PHASE_LOCKED',
        message: `Không ${action} khi học kỳ đã ở giai đoạn ${phase}; chỉ thao tác được ở giai đoạn Chuẩn bị.`,
      },
      409,
    )
}

export function assertCreditsPreparation(phase: TermPhase) {
  if (phase !== 'PREPARATION')
    throw new HttpException(
      {
        code: 'CREDITS_LOCKED',
        message: 'Chỉ sửa tín chỉ của môn mở khi học kỳ ở giai đoạn Chuẩn bị.',
      },
      409,
    )
}
