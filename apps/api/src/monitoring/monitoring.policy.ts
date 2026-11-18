/** C.4.1/C.4.8: pure read-model rules shared by the staff overview and monitoring table. */

export type TodoType =
  'MISSING_TIMETABLE' | 'MISSING_FEE_SCHEDULE' | 'FULL_SECTION' | 'SCHEDULE_CLASH' | 'UNDER_CREDIT'

export type TodoItem = {
  type: TodoType
  key: string
  title: string
  detail: string
  count: number
  href: string
}

export type TodoInput = {
  termCode: string
  missingTimetable: { code: string }[]
  missingFeeSchedules: { cohortCode: string; systemCode: string; count: number }[]
  fullSectionCount: number
  clashCount: number
  underCreditCount: number
}

/** Percentage of seats taken, safe for an empty section. */
export function fillPercent(enrolled: number, capacity: number): number {
  if (capacity <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((enrolled / capacity) * 100)))
}

/** C.4.1: one entry per issue class, each with its count and the page that can resolve it. */
export function buildTodos(input: TodoInput): TodoItem[] {
  const todos: TodoItem[] = []
  for (const term of input.missingTimetable)
    todos.push({
      type: 'MISSING_TIMETABLE',
      key: `timetable:${term.code}`,
      title: `HK ${term.code} chưa nhập thời khoá biểu`,
      detail: 'Học kỳ sắp vào Đăng ký. Nhập thời khoá biểu để mở đăng ký.',
      count: 1,
      href: `/staff/terms/${term.code}`,
    })
  for (const fee of input.missingFeeSchedules)
    todos.push({
      type: 'MISSING_FEE_SCHEDULE',
      key: `fee:${fee.cohortCode}:${fee.systemCode}`,
      title: `Khoá ${fee.cohortCode.replace(/^K/, '')} · ${fee.systemCode} chưa có bảng phí`,
      detail: 'Học kỳ sẽ không chuyển sang Đăng ký được. Liên hệ Phòng Tài vụ.',
      count: fee.count,
      href: '/staff/fees',
    })
  if (input.fullSectionCount > 0)
    todos.push({
      type: 'FULL_SECTION',
      key: 'full-sections',
      title: `${input.fullSectionCount} lớp đã đầy trong đợt đăng ký`,
      detail: `HK ${input.termCode} · kiểm tra sĩ số trên trang theo dõi đăng ký.`,
      count: input.fullSectionCount,
      href: '/staff/registration',
    })
  if (input.clashCount > 0)
    todos.push({
      type: 'SCHEDULE_CLASH',
      key: 'clashes',
      title: 'Lịch có trùng phòng hoặc trùng giảng viên',
      detail: 'Kiểm tra các buổi học bị gạch chéo trong lịch tổng.',
      count: input.clashCount,
      href: '/staff/sections',
    })
  if (input.underCreditCount > 0)
    todos.push({
      type: 'UNDER_CREDIT',
      key: 'under-credits',
      title: 'Sinh viên dưới tín chỉ tối thiểu sau khi chốt phiếu',
      detail: 'Chỉ cảnh báo, không chặn chốt phiếu.',
      count: input.underCreditCount,
      href: '/staff/registration?tab=under-credits',
    })
  return todos
}
