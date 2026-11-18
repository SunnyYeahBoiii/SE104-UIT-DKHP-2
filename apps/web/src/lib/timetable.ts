export type TermOption = {
  code: string
  phase: 'PREPARATION' | 'REGISTRATION' | 'ADJUSTMENT' | 'IN_PROGRESS' | 'CLOSED'
}

export type ImportIssue = {
  row: number
  column: string
  code: string
  message: string
}

export type Counts = {
  offeredCourses: number
  sections: number
  practiceGroups: number
  meetings: number
}

export type PreviewResponse = {
  termCode: string
  phase: TermOption['phase']
  canImport: boolean
  reason: string | null
  fileName: string | null
  rowCount: number
  errors: ImportIssue[]
  warnings: ImportIssue[]
  summary: Counts | null
  existing: { offeredCourses: number; sections: number }
}

export type OfferedCourseView = {
  id: number
  code: string
  name: string
  type: 'THEORY' | 'PRACTICE'
  credits: number
  defaultCredits: number
  sectionCount: number
  totalCapacity: number
}

export type SectionView = {
  id: number
  code: string
  courseCode: string
  courseName: string
  systemCode: string
  lecturerCode: string | null
  capacity: number
  enrolledCount: number
  reservedAdmissionYear: number | null
  language: string | null
  note: string | null
  meetingCount: number
  practiceMode: 'SCHEDULED' | 'SELF_SCHEDULED' | null
  parentCode: string | null
  hasWarning: boolean
}

export type OverviewResponse = {
  term: { code: string; phase: TermOption['phase']; canImport: boolean; reason: string | null }
  counts: Counts
  warnings: ImportIssue[]
  offeredCourses: OfferedCourseView[]
  sections: SectionView[]
}

export type ImportResult = {
  termCode: string
  counts: Counts
  warnings: ImportIssue[]
}

export type ClashWarning = ImportIssue & { sectionId: number; meetingId: number | null }

export type MeetingDraft = {
  dayOfWeek: number
  startSlot: number
  endSlot: number
  room: string
  startDate: string
  endDate: string
  cadence: 1 | 2
}

export type SectionDraft = {
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
  meetings: MeetingDraft[]
}

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

export type EditorSection = Omit<SectionDraft, 'meetings'> & {
  id: number
  courseName: string
  lecturerName: string | null
  enrolledCount: number
  offeringId: number
  meetings: EditorMeeting[]
  practiceGroupCount: number
  hasWarning: boolean
  canEdit: boolean
}

export type EditorOffering = {
  id: number
  code: string
  name: string
  type: 'THEORY' | 'PRACTICE'
  credits: number
  defaultCredits: number
  sectionCount: number
}

export type EditorOptions = {
  offerings: EditorOffering[]
  lecturers: { code: string; fullName: string }[]
  rooms: string[]
  systems: string[]
  cohorts: number[]
}

export type EditorResponse = {
  term: {
    code: string
    phase: TermOption['phase']
    startDate: string
    canEdit: boolean
    reason: string | null
  }
  options: EditorOptions
  sections: EditorSection[]
  warnings: ClashWarning[]
  counts: Counts
}

const DAY_MS = 86_400_000

const parseDay = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year!, month! - 1, day!)
}

export function meetingWeeks(termStart: string, meeting: MeetingDraft): number[] {
  if (!meeting.startDate || !meeting.endDate) return []
  const from = Math.max(
    1,
    Math.floor((parseDay(meeting.startDate) - parseDay(termStart)) / (7 * DAY_MS)) + 1,
  )
  const to = Math.max(
    1,
    Math.floor((parseDay(meeting.endDate) - parseDay(termStart)) / (7 * DAY_MS)) + 1,
  )
  const weeks: number[] = []
  for (let week = from; week <= to && week <= 31; week += meeting.cadence) weeks.push(week)
  return weeks
}

export function occursInWeek(weeks: number, week: number): boolean {
  return (weeks & (1 << (week - 1))) !== 0
}

/** "Sao chép lịch nhóm trước, lùi một tuần": same pattern, dates moved one week later. */
export function shiftMeetingWeek(meeting: MeetingDraft): MeetingDraft {
  const later = (value: string) => new Date(parseDay(value) + 7 * DAY_MS).toISOString().slice(0, 10)
  return { ...meeting, startDate: later(meeting.startDate), endDate: later(meeting.endDate) }
}

export function emptyDraft(options: EditorOptions): SectionDraft {
  return {
    code: '',
    courseCode: options.offerings[0]?.code ?? '',
    systemCode: options.systems[0] ?? '',
    lecturerCode: null,
    capacity: 30,
    reservedAdmissionYear: null,
    language: 'VN',
    note: null,
    practiceMode: null,
    parentCode: null,
    meetings: [],
  }
}

export function draftFromSection(section: EditorSection): SectionDraft {
  return {
    code: section.code,
    courseCode: section.courseCode,
    systemCode: section.systemCode,
    lecturerCode: section.lecturerCode,
    capacity: section.capacity,
    reservedAdmissionYear: section.reservedAdmissionYear,
    language: section.language,
    note: section.note,
    practiceMode: section.practiceMode,
    parentCode: section.parentCode,
    meetings: section.meetings.map((meeting) => ({
      dayOfWeek: meeting.dayOfWeek,
      startSlot: meeting.startSlot,
      endSlot: meeting.endSlot,
      room: meeting.room,
      startDate: meeting.startDate,
      endDate: meeting.endDate,
      cadence: meeting.cadence,
    })),
  }
}

export const PHASE_LABELS: Record<TermOption['phase'], string> = {
  PREPARATION: 'Chuẩn bị',
  REGISTRATION: 'Đăng ký',
  ADJUSTMENT: 'Điều chỉnh',
  IN_PROGRESS: 'Đang học',
  CLOSED: 'Đã kết thúc',
}

export const MODE_LABELS: Record<SectionView['practiceMode'] & string, string> = {
  SCHEDULED: 'HT1 · theo lịch',
  SELF_SCHEDULED: 'HT2 · tự xếp',
}

export function cohortLabel(year: number | null): string {
  return year === null ? 'Mọi khoá' : `K${String(year - 2005).padStart(2, '0')} · ${year}`
}

/** Tải báo cáo lỗi: one row per issue with BOM so Excel opens the Vietnamese text correctly. */
export function reportCsv(preview: PreviewResponse): string {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  const lines = [
    ['Dòng', 'Cột', 'Mã lỗi', 'Mô tả'].map(quote).join(','),
    ...preview.errors.map((error) =>
      [error.row, error.column, error.code, error.message].map(quote).join(','),
    ),
    '',
    ['Cảnh báo (không chặn nhập)'].map(quote).join(','),
    ['Dòng', 'Cột', 'Mã cảnh báo', 'Mô tả'].map(quote).join(','),
    ...preview.warnings.map((warning) =>
      [warning.row, warning.column, warning.code, warning.message].map(quote).join(','),
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** File → base64 in chunks; spreading a 10 MB array into btoa would overflow the call stack. */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}
