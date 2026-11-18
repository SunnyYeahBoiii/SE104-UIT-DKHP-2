export type PriorityGroup = {
  id: number
  code: string
  name: string
  discountRate: number
  priority: number
}

export type Cohort = { id: number; code: string; admissionYear: number }
export type TrainingSystem = { id: number; code: string; name: string }

export type Student = {
  id: number
  studentCode: string
  fullName: string
  email: string | null
  cohort: Cohort
  trainingSystem: TrainingSystem
  priorityGroups: PriorityGroup[]
  appliedPriorityGroup: PriorityGroup | null
  createdAt: string
  updatedAt: string
}

export type Catalogs = {
  cohorts: Cohort[]
  trainingSystems: TrainingSystem[]
  priorityGroups: PriorityGroup[]
}

export type StudentListResponse = Catalogs & { items: Student[] }

export type StudentDetailResponse = Catalogs & {
  item: Student
  registrationForms: {
    id: number
    term: string
    finalizedAt: string | null
    enrollments: {
      id: number
      code: string
      name: string
      status: string
      attemptType: string
      credits: number
      creditRate: number
      surcharge: number
      cancelledAt: string | null
    }[]
  }[]
  auditLogs: {
    id: number
    action: string
    actorName: string
    createdAt: string
    payload: unknown
  }[]
  deleteBlocked: { reason: string | null; registrationForms: number; ledgerEntries: number }
}

export type StudentPayload = {
  studentCode: string
  fullName: string
  email: string
  cohortId: number
  trainingSystemId: number
  priorityGroupIds: number[]
}

export type BeforeAfterRow = {
  baseTuition: number
  surcharge: number
  discount: number
  netAmount: number
  outstandingAmount: number
}

export type TuitionPreviewTerm = {
  termCode: string
  termName: string
  phase: string
  reason: string
  before: BeforeAfterRow
  after: BeforeAfterRow
  creditBalance: number
  blocked: { code: string; message: string } | null
}

export type TuitionPreview = {
  student: { studentCode: string; fullName: string }
  terms: TuitionPreviewTerm[]
}

export const ACTION_LABELS: Record<string, string> = {
  STUDENT_CREATED: 'Tạo hồ sơ',
  STUDENT_UPDATED: 'Sửa hồ sơ',
  STUDENT_PASSWORD_RESET: 'Đặt lại mật khẩu',
  STUDENT_DELETED: 'Xoá hồ sơ',
  TUITION_RECALCULATED: 'Tính lại học phí',
}

/** HS-14: only these three fields can trigger a recalculation. */
export function profileChanged(current: Student, proposed: StudentPayload): boolean {
  const currentGroups = current.priorityGroups.map((group) => group.id).sort((a, b) => a - b)
  const proposedGroups = [...proposed.priorityGroupIds].sort((a, b) => a - b)
  return (
    current.cohort.id !== proposed.cohortId ||
    current.trainingSystem.id !== proposed.trainingSystemId ||
    currentGroups.length !== proposedGroups.length ||
    currentGroups.some((id, index) => id !== proposedGroups[index])
  )
}

const BEFORE_AFTER_FIELDS: [keyof BeforeAfterRow, string][] = [
  ['baseTuition', 'Học phí cố định'],
  ['surcharge', 'Phụ thu'],
  ['discount', 'Giảm trừ'],
  ['netAmount', 'Số tiền phải đóng'],
  ['outstandingAmount', 'Số tiền còn lại'],
]

export function beforeAfterRows(term: TuitionPreviewTerm) {
  return BEFORE_AFTER_FIELDS.map(([key, label]) => ({
    key,
    label,
    before: term.before[key],
    after: term.after[key],
    delta: term.after[key] - term.before[key],
  }))
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`
}
