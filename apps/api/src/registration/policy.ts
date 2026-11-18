import { AttemptType, PrerequisiteType } from '../generated/prisma/enums'

/** DK-10: only the rules owned by our slices, in the order the full rule would check them. */
export const REGISTRATION_RULES = ['DK-02', 'DK-03', 'DK-19', 'DK-04', 'DK-05', 'DK-09'] as const
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
    case 'DK-05':
      return `${detail.reason ?? 'Chưa đủ điều kiện tiên quyết'}. Liên hệ Phòng Đào tạo nếu kết quả chưa đúng.`
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
    case 'DK-05':
      return 'Liên hệ Phòng Đào tạo'
    case 'DK-09':
      return 'Chọn lớp khác còn chỗ'
  }
}

export type AttemptLike = {
  courseId: number
  /** Group key compared with the course-id list passed to effectiveResult; the course id by default. */
  equivalenceId: number | null
  /** Score on the 10-point scale; null when the attempt has no result yet (KQ-03). */
  score: number | null
  /** Recency key, larger is later. */
  order: number
}

export type EffectiveResult = 'PASSED' | 'FAILED' | null

/** DK-05: a prerequisite of a course, widened to its whole equivalence group. */
export type PrerequisiteCondition = {
  code: string
  type: PrerequisiteType
  equivalenceIds: number[]
}

export type PrerequisiteCheck =
  | { state: 'OK' }
  | { state: 'CONDITIONAL'; message: string; condition: PrerequisiteCondition }
  | { state: 'MISSING'; message: string; condition: PrerequisiteCondition }

const inGroup = (attempt: AttemptLike, ids: readonly number[]) =>
  ids.includes(attempt.equivalenceId ?? attempt.courseId)

/**
 * DK-05/KQ-02…KQ-04: REQUIRED_PASS needs a passing effective result; REQUIRED_ATTEMPT needs any
 * graded attempt. An attempt of the prerequisite with no grade yet makes the line conditional
 * instead of rejected (a hard miss still wins when conditions are mixed).
 */
export function checkPrerequisites(
  conditions: readonly PrerequisiteCondition[],
  attempts: readonly AttemptLike[],
): PrerequisiteCheck {
  let conditional: PrerequisiteCondition | null = null
  for (const condition of conditions) {
    const relevant = attempts.filter((attempt) => inGroup(attempt, condition.equivalenceIds))
    const graded = relevant.some((attempt) => attempt.score !== null)
    const passed = effectiveResult(relevant, condition.equivalenceIds) === 'PASSED'
    if (condition.type === PrerequisiteType.REQUIRED_PASS ? passed : graded) continue
    const ungraded = relevant.some((attempt) => attempt.score === null)
    if (ungraded) {
      conditional ??= condition
      continue
    }
    const message =
      condition.type === PrerequisiteType.REQUIRED_PASS
        ? `Cần Đạt ${condition.code}`
        : `Cần học trước ${condition.code}`
    return { state: 'MISSING', message, condition }
  }
  if (conditional)
    return {
      state: 'CONDITIONAL',
      condition: conditional,
      message: `Đăng ký có điều kiện: ${conditional.code} đang học, chưa có điểm`,
    }
  return { state: 'OK' }
}

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
