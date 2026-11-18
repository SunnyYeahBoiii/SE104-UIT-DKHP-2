import type { SectionClash, SectionMeeting } from './registration'

const DAY_MS = 86_400_000

export type ScheduleSection = {
  code: string
  meetings: readonly SectionMeeting[]
}

/** DK-07, same predicate as the API: shared day, overlapping slots and a shared week bit. */
export function sectionClash(
  candidate: ScheduleSection,
  others: readonly ScheduleSection[],
): SectionClash | null {
  for (const other of others) {
    for (const left of candidate.meetings) {
      for (const right of other.meetings) {
        if (
          left.dayOfWeek !== right.dayOfWeek ||
          left.startSlot > right.endSlot ||
          right.startSlot > left.endSlot ||
          (left.weeks & right.weeks) === 0
        )
          continue
        return {
          withCode: other.code,
          dayOfWeek: left.dayOfWeek,
          startSlot: Math.max(left.startSlot, right.startSlot),
          endSlot: Math.min(left.endSlot, right.endSlot),
        }
      }
    }
  }
  return null
}

export function clashLabel(clash: SectionClash): string {
  return `Trùng với ${clash.withCode} · Thứ ${clash.dayOfWeek} tiết ${clash.startSlot}–${clash.endSlot}`
}

/** UIT period boundaries; B.4.3 asks for the real clock time next to the period number. */
export const SLOT_TIMES: Record<number, string> = {
  1: '07:00–07:50',
  2: '07:50–08:40',
  3: '09:00–09:50',
  4: '09:50–10:40',
  5: '10:40–11:30',
  6: '12:30–13:20',
  7: '13:20–14:10',
  8: '14:30–15:20',
  9: '15:20–16:10',
  10: '16:10–17:00',
}

export function dayDate(termStart: string, week: number, dayOfWeek: number): string {
  const [year, month, day] = termStart.split('-').map(Number)
  const monday = Date.UTC(year!, month! - 1, day!)
  return new Date(monday + ((week - 1) * 7 + dayOfWeek - 2) * DAY_MS).toISOString().slice(0, 10)
}

export type StudentMeeting = SectionMeeting & {
  id: number
  sectionId: number
  sectionCode: string
  courseCode: string
  courseName: string
  courseType: 'THEORY' | 'PRACTICE'
  lecturer: string | null
  dates: string[]
}

export type UnscheduledSection = {
  sectionId: number
  sectionCode: string
  courseCode: string
  courseName: string
  courseType: 'THEORY' | 'PRACTICE'
  practiceMode: string | null
  lecturer: string | null
}

export type StudentTimetable = {
  term: {
    code: string
    name: string
    phase: string
    startDate: string
    weekCount: number
  } | null
  today: string
  meetings: StudentMeeting[]
  unscheduled: UnscheduledSection[]
}
