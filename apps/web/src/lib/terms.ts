/** Vietnam-time helpers and read-only view types for the academic terms screens. */

export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export type MilestoneField =
  | 'registrationStartAt'
  | 'registrationEndAt'
  | 'adjustmentStartAt'
  | 'adjustmentEndAt'
  | 'tuitionDeadline'

export type SlotView = {
  id: number
  name: string
  startAt: string
  endAt: string
  cohortIds: number[]
  state: 'UPCOMING' | 'ONGOING' | 'PAST'
  canEditStart: boolean
  canEditEnd: boolean
  canDelete: boolean
}

export type TermView = {
  id: number
  code: string
  type: 'FIRST' | 'SECOND' | 'SUMMER'
  startYear: number
  phase: string
  derivedPhase: string
  startDate: string
  milestones: Record<MilestoneField, string>
  finalExamStartAt: string
  minCredits: number
  maxCredits: number
  editable: Record<MilestoneField, boolean>
  slots: SlotView[]
  cohortsWithoutSlots: number[]
}

export type CreditLimits = {
  minCredits: number
  mainTermMaxCredits: number
  summerMaxCredits: number
}

export type TermsResponse = {
  now: string
  creditLimits: CreditLimits
  cohorts: { id: number; code: string }[]
  terms: TermView[]
}

const vnParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** `<input type="datetime-local">` shows wall-clock time; the API stores UTC instants. */
export function vnInputValue(iso: string): string {
  const parts = Object.fromEntries(
    vnParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function isoFromVnInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Thời điểm không hợp lệ.')
  return new Date(`${value}:00+07:00`).toISOString()
}

const vnDisplay = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
  hour12: false,
})

/** Everything on screen is Vietnam time, whatever the browser's own time zone is. */
export function formatVn(iso: string): string {
  return vnDisplay.format(new Date(iso))
}

/** Position of a moment on a Gantt bar, in percent between two instants. */
export function percentBetween(moment: string, start: string, end: string): number {
  const t = Date.parse(moment)
  const a = Date.parse(start)
  const b = Date.parse(end)
  if (b <= a) return 0
  return Math.min(100, Math.max(0, ((t - a) / (b - a)) * 100))
}
