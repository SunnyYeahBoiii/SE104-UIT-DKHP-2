/** View types and pure filters for the academic office's registration desk. */

export type MonitorPhase = 'PREPARATION' | 'REGISTRATION' | 'ADJUSTMENT' | 'IN_PROGRESS' | 'CLOSED'

export type MonitorSection = {
  id: number
  code: string
  courseCode: string
  courseName: string
  systemCode: string
  lecturerName: string | null
  capacity: number
  enrolledCount: number
  fillPercent: number
}

export type MonitorResponse = {
  now: string
  pollIntervalSeconds: number
  term: { code: string; phase: MonitorPhase }
  sections: MonitorSection[]
}

export type RosterRow = {
  stt: number
  studentCode: string
  fullName: string
  cohortCode: string
  systemCode: string
  attemptType: 'FIRST' | 'RETAKE' | 'IMPROVEMENT'
  attemptTypeLabel: string
  status: 'REGISTERED' | 'CANCELLED' | 'FINALIZED'
  statusLabel: string
}

export type RosterResponse = {
  section: {
    code: string
    courseCode: string
    courseName: string
    capacity: number
    enrolledCount: number
    termCode: string
  }
  includeCancelled: boolean
  rows: RosterRow[]
}

export type UnderCreditRow = {
  stt: number
  studentCode: string
  fullName: string
  cohortCode: string
  credits: number
  minCredits: number
}

export type UnderCreditResponse = {
  term: { code: string; phase: MonitorPhase; minCredits: number }
  rows: UnderCreditRow[]
}

export type TodoItem = {
  type: string
  key: string
  title: string
  detail: string
  count: number
  href: string
}

export type OverviewResponse = {
  now: string
  focusTerm: { code: string; phase: MonitorPhase } | null
  stats: {
    phase: MonitorPhase | null
    timetableImported: boolean
    offeredCourses: number
    sections: number
    clashes: number
    studentsWithForm: number
    totalStudents: number
    fullSections: number
    smallSections: number
    underCredits: number
  }
  todos: TodoItem[]
}

export type MonitorFilter = 'all' | 'full' | 'nearFull' | 'small'

/** C.4.8 filters: the four named chips plus two column selects, all over one polled read. */
export function filterSections(
  sections: MonitorSection[],
  filter: MonitorFilter,
  courseCode: string,
  systemCode: string,
): MonitorSection[] {
  return sections.filter((section) => {
    if (courseCode && section.courseCode !== courseCode) return false
    if (systemCode && section.systemCode !== systemCode) return false
    if (filter === 'full') return section.capacity > 0 && section.enrolledCount >= section.capacity
    if (filter === 'nearFull') return section.fillPercent >= 90
    if (filter === 'small') return section.enrolledCount < 10
    return true
  })
}

/** Whole seconds since the last successful poll; never negative when the clock drifts. */
export function secondsSince(sinceIso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(sinceIso)) / 1000))
}

export function updatedLabel(seconds: number): string {
  return `Cập nhật ${seconds} giây trước`
}
