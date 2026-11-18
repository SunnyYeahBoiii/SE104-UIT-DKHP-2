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
