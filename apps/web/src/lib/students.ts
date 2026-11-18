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

export const ACTION_LABELS: Record<string, string> = {
  STUDENT_CREATED: 'Tạo hồ sơ',
  STUDENT_UPDATED: 'Sửa hồ sơ',
  STUDENT_PASSWORD_RESET: 'Đặt lại mật khẩu',
  STUDENT_DELETED: 'Xoá hồ sơ',
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`
}
