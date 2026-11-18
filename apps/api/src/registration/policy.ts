import { AttemptType } from '../generated/prisma/enums'

/** DK-10: only the rules owned by this slice, in the order the full rule would check them. */
export const REGISTRATION_RULES = [
  'DK-02',
  'DK-03',
  'DK-19',
  'DK-04',
  'DK-07',
  'DK-08',
  'DK-09',
] as const
export type RegistrationRule = (typeof REGISTRATION_RULES)[number]

export function firstRule(rules: readonly RegistrationRule[]): RegistrationRule | null {
  return REGISTRATION_RULES.find((rule) => rules.includes(rule)) ?? null
}

export type RuleDetail = Record<string, string | number>

/** A.2 error copy: always one reason plus a way out, never a bare code. */
export function ruleMessage(rule: RegistrationRule, detail: RuleDetail = {}): string {
  switch (rule) {
    case 'DK-02':
      return 'Ngoài khung giờ đăng ký của khoá bạn, hoặc học kỳ không mở đăng ký. Xem thời điểm mở kế tiếp.'
    case 'DK-03':
      return `Môn của lớp ${detail.code ?? ''} không mở trong học kỳ này. Quay lại danh sách môn mở.`
    case 'DK-19':
      return `Lớp ${detail.code ?? ''} thuộc hệ ${detail.system ?? ''}, bạn thuộc hệ ${detail.studentSystem ?? ''}. Chọn lớp cùng hệ đào tạo của môn này.`
    case 'DK-04':
      return `Môn ${detail.courseCode ?? ''} hoặc môn tương đương đã có trong phiếu. Mở phiếu để huỷ dòng cũ rồi đăng ký lại.`
    case 'DK-07': {
      const other = detail.clashWith ?? ''
      return `Lớp ${detail.code ?? ''} trùng lịch với lớp ${other} (Thứ ${detail.day ?? ''} tiết ${detail.slots ?? ''}). Huỷ lớp ${other} hoặc chọn lớp khác.`
    }
    case 'DK-08':
      return `Vượt tín chỉ tối đa của học kỳ. Bạn chỉ được đăng ký thêm ${detail.remaining ?? 0} tín chỉ. Mở phiếu để huỷ bớt.`
    case 'DK-09':
      return `Lớp ${detail.code ?? ''} vừa đầy. Chọn lớp khác của môn này còn chỗ.`
  }
}

export function ruleExit(rule: RegistrationRule, detail: RuleDetail = {}): string {
  switch (rule) {
    case 'DK-02':
      return detail.nextAt ? 'Xem thời điểm mở kế tiếp' : 'Chờ đợt đăng ký tiếp theo'
    case 'DK-03':
      return 'Quay lại danh sách môn mở'
    case 'DK-19':
      return 'Chọn lớp cùng hệ đào tạo'
    case 'DK-04':
      return 'Mở phiếu để huỷ dòng cũ'
    case 'DK-07':
      return `Huỷ lớp ${detail.clashWith ?? 'trùng'}`
    case 'DK-08':
      return 'Mở phiếu để huỷ bớt'
    case 'DK-09':
      return 'Chọn lớp khác còn chỗ'
  }
}

/** DK-08: the cap comes from the term (12 in summer, 24 in a main term). */
export function remainingCredits(
  maxCredits: number,
  usedCredits: number,
  incoming: number,
): number {
  return maxCredits - usedCredits - incoming
}

export type AttemptLike = {
  courseId: number
  equivalenceId: number | null
  /** Score on the 10-point scale; null when the attempt has no result yet (KQ-03). */
  score: number | null
  /** Recency key, larger is later. */
  order: number
}

export type EffectiveResult = 'PASSED' | 'FAILED' | null

/** KQ-04/KQ-03: nearest passed attempt, else the nearest graded attempt; no grade means no result. */
export function effectiveResult(
  attempts: readonly AttemptLike[],
  equivalenceIds: readonly number[],
): EffectiveResult {
  const keys = new Set(equivalenceIds)
  const relevant = attempts
    .filter((attempt) => keys.has(attempt.equivalenceId ?? attempt.courseId))
    .sort((left, right) => right.order - left.order)
  const passed = relevant.find((attempt) => attempt.score !== null && attempt.score >= 5)
  if (passed) return 'PASSED'
  return relevant[0]?.score === null || relevant.length === 0 ? null : 'FAILED'
}

/** DK-16: the attempt type follows the effective result, never a separate user choice. */
export function attemptTypeOf(result: EffectiveResult): AttemptType {
  if (result === 'PASSED') return AttemptType.IMPROVEMENT
  if (result === 'FAILED') return AttemptType.RETAKE
  return AttemptType.FIRST
}
