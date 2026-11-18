/**
 * Pure policy for academic-office term edits (HK-02/03/04/06/07, DK-08).
 * No database and no clock of its own: every rule takes `now`, so tests can freeze time and the
 * read model can show the same lock icons the write path enforces.
 */
export const MILESTONE_FIELDS = [
  'registrationStartAt',
  'registrationEndAt',
  'adjustmentStartAt',
  'adjustmentEndAt',
  'tuitionDeadline',
] as const

export type MilestoneField = (typeof MILESTONE_FIELDS)[number]
export type MilestoneValues = Record<MilestoneField, Date>
export type TermPhase = 'PREPARATION' | 'REGISTRATION' | 'ADJUSTMENT' | 'IN_PROGRESS' | 'CLOSED'

export type PolicyIssue = {
  code: string
  message: string
  /** Field names the UI should mark, e.g. `registrationEndAt`. */
  fields: string[]
}

type Interval = { startAt: Date; endAt: Date }

const same = (a: Date, b: Date) => a.getTime() === b.getTime()
const before = (a: Date, b: Date) => a.getTime() < b.getTime()

/** Vietnam has no DST; formatting is injected here only so error text reads like the design prompt. */
const vnDateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatVnDateTime = (moment: Date): string => vnDateTime.format(moment)

/** HK-03: the phase is derived from milestones. CLOSED is out of scope (no rule depends on it). */
export function termPhase(m: MilestoneValues, now: Date): TermPhase {
  if (before(now, m.registrationStartAt)) return 'PREPARATION'
  if (before(now, m.adjustmentStartAt)) return 'REGISTRATION'
  if (before(now, m.adjustmentEndAt)) return 'ADJUSTMENT'
  return 'IN_PROGRESS'
}

/**
 * HK-06: an interval that has not begun can move both ends; once it has begun only its end may
 * move; once it has ended nothing may move. The tuition deadline is editable until it is reached.
 * `/staff/terms` uses this for lock icons and tooltips; the command uses it again for enforcement.
 */
export function editableMilestones(m: MilestoneValues, now: Date): Record<MilestoneField, boolean> {
  const intervalEditable = (interval: Interval) => ({
    start: before(now, interval.startAt),
    end: before(now, interval.endAt),
  })
  const registration = intervalEditable({
    startAt: m.registrationStartAt,
    endAt: m.registrationEndAt,
  })
  const adjustment = intervalEditable({
    startAt: m.adjustmentStartAt,
    endAt: m.adjustmentEndAt,
  })
  return {
    registrationStartAt: registration.start,
    registrationEndAt: registration.end,
    adjustmentStartAt: adjustment.start,
    adjustmentEndAt: adjustment.end,
    tuitionDeadline: before(now, m.tuitionDeadline),
  }
}

/** HK-02 (and the DB check): five ordered milestones; the deadline also precedes the final exam. */
export function validateMilestoneOrder(
  next: MilestoneValues,
  finalExamStartAt?: Date,
): PolicyIssue[] {
  const checks: [boolean, string, string, MilestoneField[]][] = [
    [
      before(next.registrationStartAt, next.registrationEndAt),
      'MILESTONE_ORDER',
      'Bắt đầu Đăng ký phải trước Kết thúc Đăng ký.',
      ['registrationStartAt', 'registrationEndAt'],
    ],
    [
      !before(next.adjustmentStartAt, next.registrationEndAt),
      'MILESTONE_ORDER',
      'Bắt đầu Điều chỉnh không được trước Kết thúc Đăng ký.',
      ['registrationEndAt', 'adjustmentStartAt'],
    ],
    [
      before(next.adjustmentStartAt, next.adjustmentEndAt),
      'MILESTONE_ORDER',
      'Bắt đầu Điều chỉnh phải trước Kết thúc Điều chỉnh.',
      ['adjustmentStartAt', 'adjustmentEndAt'],
    ],
    [
      before(next.adjustmentEndAt, next.tuitionDeadline),
      'MILESTONE_ORDER',
      'Hạn đóng học phí phải sau Kết thúc Điều chỉnh.',
      ['adjustmentEndAt', 'tuitionDeadline'],
    ],
  ]
  if (finalExamStartAt)
    checks.push([
      before(next.tuitionDeadline, finalExamStartAt),
      'MILESTONE_ORDER',
      'Hạn đóng học phí phải trước ngày thi kết thúc.',
      ['tuitionDeadline'],
    ])

  return checks
    .filter(([valid]) => !valid)
    .map(([, code, message, fields]) => ({ code, message, fields }))
}

/** HK-02 + HK-06 on a full proposed snapshot: only changed fields are checked for locks/past. */
export function validateMilestoneChange(
  current: MilestoneValues,
  next: MilestoneValues,
  now: Date,
  finalExamStartAt?: Date,
): PolicyIssue[] {
  const editable = editableMilestones(current, now)
  const issues: PolicyIssue[] = []
  for (const field of MILESTONE_FIELDS) {
    if (same(current[field], next[field])) continue
    if (!editable[field]) {
      issues.push({
        code: 'MILESTONE_LOCKED',
        message: 'Mốc đã bắt đầu hoặc đã qua; chỉ sửa được mốc còn mở.',
        fields: [field],
      })
      continue
    }
    if (before(next[field], now)) {
      issues.push({
        code: 'MILESTONE_IN_PAST',
        message: 'Giá trị mới không được ở quá khứ.',
        fields: [field],
      })
    }
  }
  return [...issues, ...validateMilestoneOrder(next, finalExamStartAt)]
}

/** HK-04: at most one term's registration period (registration start → adjustment end) is open. */
export function validateRegistrationOverlap(
  candidate: { termCode: string; registrationStartAt: Date; adjustmentEndAt: Date },
  others: { termCode: string; registrationStartAt: Date; adjustmentEndAt: Date }[],
): PolicyIssue[] {
  return others
    .filter(
      (other) =>
        before(candidate.registrationStartAt, other.adjustmentEndAt) &&
        before(other.registrationStartAt, candidate.adjustmentEndAt),
    )
    .map((other) => ({
      code: 'TERM_OVERLAP',
      message: `${other.termCode} đang trong đợt đăng ký từ ${formatVnDateTime(other.registrationStartAt)} đến ${formatVnDateTime(other.adjustmentEndAt)}.`,
      fields: ['registrationStartAt', 'registrationEndAt', 'adjustmentStartAt', 'adjustmentEndAt'],
    }))
}

/** HK-07: a milestone change must not push any existing slot outside the registration interval. */
export function validateSlotsInsideRegistration(
  slots: Interval[],
  m: MilestoneValues,
): PolicyIssue[] {
  return slots
    .filter(
      (slot) =>
        before(slot.startAt, m.registrationStartAt) || before(m.registrationEndAt, slot.endAt),
    )
    .map(() => ({
      code: 'SLOT_OUTSIDE_REGISTRATION',
      message: 'Khung giờ cũ nằm ngoài giai đoạn Đăng ký sau khi dời mốc.',
      fields: ['registrationStartAt', 'registrationEndAt'],
    }))
}

export type SlotState = 'UPCOMING' | 'ONGOING' | 'PAST'

/**
 * HK-03: one forward step at a time. Walking (instead of jumping to `termPhase`) keeps per-phase hooks
 * in order when the job first runs after several milestones have already passed. Never goes backwards.
 */
export function nextTermPhase(current: TermPhase, m: MilestoneValues, now: Date): TermPhase | null {
  if (current === 'PREPARATION' && !before(now, m.registrationStartAt)) return 'REGISTRATION'
  if (current === 'REGISTRATION' && !before(now, m.adjustmentStartAt)) return 'ADJUSTMENT'
  if (current === 'ADJUSTMENT' && !before(now, m.adjustmentEndAt)) return 'IN_PROGRESS'
  return null
}

export function slotState(slot: Interval, now: Date): SlotState {
  if (!before(now, slot.startAt)) return before(now, slot.endAt) ? 'ONGOING' : 'PAST'
  return 'UPCOMING'
}

export type SlotInput = Interval & { cohortIds: number[] }

/**
 * HK-05/HK-07: slots live inside REGISTRATION and carry at least one cohort. An upcoming slot can be
 * changed freely or deleted, an ongoing one only has its end extended, a past one is frozen.
 */
export function validateSlotWrite(options: {
  current: SlotInput | null
  next: SlotInput
  m: MilestoneValues
  now: Date
  knownCohortIds: number[]
  deleting?: boolean
}): PolicyIssue[] {
  const { current, next, m, now, knownCohortIds, deleting = false } = options
  const issues: PolicyIssue[] = []

  if (current) {
    const state = slotState(current, now)
    if (state === 'PAST') {
      return [
        {
          code: 'SLOT_LOCKED',
          message: 'Khung giờ đã kết thúc, không sửa được.',
          fields: ['startAt', 'endAt', 'cohortIds'],
        },
      ]
    }
    if (state === 'ONGOING') {
      const startMoved = !same(current.startAt, next.startAt)
      const endMovedEarlier = before(next.endAt, current.endAt)
      const cohortsChanged =
        current.cohortIds.length !== next.cohortIds.length ||
        current.cohortIds.some((id) => !next.cohortIds.includes(id))
      if (deleting || startMoved || endMovedEarlier || cohortsChanged)
        return [
          {
            code: 'SLOT_LOCKED',
            message: 'Khung giờ đang diễn ra, chỉ sửa được giờ kết thúc.',
            fields: deleting ? ['startAt', 'endAt'] : ['startAt', 'cohortIds'],
          },
        ]
    }
  }

  if (!deleting) {
    if (!before(next.startAt, next.endAt))
      issues.push({
        code: 'SLOT_ORDER',
        message: 'Giờ bắt đầu phải trước giờ kết thúc.',
        fields: ['startAt', 'endAt'],
      })
    const startChanged = !current || !same(current.startAt, next.startAt)
    if (startChanged && before(next.startAt, now))
      issues.push({
        code: 'SLOT_IN_PAST',
        message: 'Giờ bắt đầu không được ở quá khứ.',
        fields: ['startAt'],
      })
    if (before(next.endAt, now))
      issues.push({
        code: 'SLOT_IN_PAST',
        message: 'Giờ kết thúc không được ở quá khứ.',
        fields: ['endAt'],
      })
    if (before(next.startAt, m.registrationStartAt) || before(m.registrationEndAt, next.endAt))
      issues.push({
        code: 'SLOT_OUTSIDE_REGISTRATION',
        message: 'Khung giờ phải nằm trong giai đoạn Đăng ký.',
        fields: ['startAt', 'endAt'],
      })
    if (next.cohortIds.length === 0)
      issues.push({
        code: 'SLOT_NO_COHORT',
        message: 'Khung giờ phải có ít nhất một khoá.',
        fields: ['cohortIds'],
      })
    else if (next.cohortIds.some((id) => !knownCohortIds.includes(id)))
      issues.push({
        code: 'SLOT_UNKNOWN_COHORT',
        message: 'Khoá không tồn tại.',
        fields: ['cohortIds'],
      })
  }
  return issues
}

/** HK-05 warning only: cohorts with no slot can still register during ADJUSTMENT. */
export function cohortsWithoutSlots(allCohortIds: number[], slotCohortIds: number[]): number[] {
  return allCohortIds.filter((id) => !slotCohortIds.includes(id))
}

export type CreditLimits = {
  minCredits: number
  mainTermMaxCredits: number
  summerMaxCredits: number
}

/** DK-08 / §10: positive integers and min ≤ main max before the limits are copied to PREPARATION terms. */
export function validateCreditLimits(next: CreditLimits, current: CreditLimits): PolicyIssue[] {
  const values = [next.minCredits, next.mainTermMaxCredits, next.summerMaxCredits]
  if (values.some((value) => !Number.isInteger(value) || value <= 0))
    return [
      {
        code: 'CREDIT_LIMIT_INVALID',
        message: 'Giới hạn tín chỉ phải là số nguyên lớn hơn 0.',
        fields: ['minCredits', 'mainTermMaxCredits', 'summerMaxCredits'],
      },
    ]
  if (next.minCredits > next.mainTermMaxCredits)
    return [
      {
        code: 'CREDIT_LIMIT_INVALID',
        message: 'Tín chỉ tối thiểu không được lớn hơn tín chỉ tối đa học kỳ chính.',
        fields: ['minCredits', 'mainTermMaxCredits'],
      },
    ]
  if (
    next.minCredits === current.minCredits &&
    next.mainTermMaxCredits === current.mainTermMaxCredits &&
    next.summerMaxCredits === current.summerMaxCredits
  )
    return [
      {
        code: 'CREDIT_LIMIT_UNCHANGED',
        message: 'Giới hạn tín chỉ không đổi.',
        fields: [],
      },
    ]
  return []
}
