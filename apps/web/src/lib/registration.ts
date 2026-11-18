export type PermissionState = 'OPEN' | 'BEFORE_SLOT' | 'OUTSIDE_SLOT' | 'NO_TERM' | 'FINALIZED'

export type Permission = {
  state: PermissionState
  phase: string
  message: string
  countdownTo: string | null
}

export type AttemptType = 'FIRST' | 'RETAKE' | 'IMPROVEMENT'

export type Section = {
  id: number
  code: string
  courseCode: string
  courseName: string
  courseType: 'THEORY' | 'PRACTICE'
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
  registered: boolean
}

export type FormRow = {
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
}

export type Form = {
  id: number | null
  totalCredits: number
  maxCredits: number
  finalizedAt: string | null
  rows: FormRow[]
  cancelled: FormRow[]
}

export type RegistrationOverview = {
  now: string
  term: { code: string; name: string; phase: string } | null
  permission: Permission
  student: {
    studentCode: string
    fullName: string
    cohortCode: string
    trainingSystemCode: string
    trainingSystemName: string
    admissionYear: number
  }
  sections: Section[]
  form: Form
}

export type RegistrationResult = {
  sectionId: number
  sectionCode: string
  ok: boolean
  enrollmentId?: number
  attemptType?: AttemptType
  code?: string
  message?: string
  exit?: string
}

export const ATTEMPT_LABELS: Record<AttemptType, string> = {
  FIRST: 'Lần đầu',
  RETAKE: 'Học lại',
  IMPROVEMENT: 'Cải thiện',
}

export const DAY_LABELS: Record<number, string> = {
  2: 'T2',
  3: 'T3',
  4: 'T4',
  5: 'T5',
  6: 'T6',
  7: 'T7',
  8: 'CN',
}

export const PHASE_LABELS: Record<string, string> = {
  PREPARATION: 'Chuẩn bị',
  REGISTRATION: 'Đăng ký',
  ADJUSTMENT: 'Điều chỉnh',
  IN_PROGRESS: 'Đang học',
  CLOSED: 'Kết thúc',
}

/** A.3.5: "Còn 2 ngày 04:12:09"; sub-day countdowns drop the zero day. */
export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return '00:00:00'
  const total = Math.floor(milliseconds / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  return days > 0 ? `${days} ngày ${clock}` : clock
}

export function formatCredits(credits: number): string {
  return `${credits} tín chỉ`
}

export function sectionDays(section: Section): string {
  return section.days.length
    ? section.days.map((day) => DAY_LABELS[day] ?? day).join(' · ')
    : 'Không có lịch cố định'
}
