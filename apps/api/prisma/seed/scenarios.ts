/**
 * Accounts that exercise specific business rules. Every other student follows the regular plan of their
 * cohort with passing grades. All accounts share DEV_PASSWORD.
 */
export const DEV_PASSWORD = 'Dkhp@2026'

export const DEMO = {
  /** Clean history; registered MA006 in the open term; has not paid 20261, so the tuition QR shows. */
  student: '24520001',
  /** Child of a fallen soldier: 80 % discount on base tuition and surcharges (HS-02, HP-06). */
  priorityLietSi: '24520002',
  /** Registered SE100 and SE113 while SE104 is still in progress (DK-05), plus CS106 as a free elective. */
  pendingPrerequisite: '24520003',
  /** In two priority groups; only the one with the higher priority applies (HS-02). */
  twoPriorityGroups: '24520004',
  /** Overpaid 20252; the credit balance is carried into 20261 (HP-11). */
  overpaid: '24520005',
  /** Failed IT002 theory in 20251, passed its practice; retakes theory alone in 20262 (DK-12) after switching sections. */
  retakeSwitched: '24520009',
  /** Failed IT003 theory in 20251 and retook it in summer 20253, where every line carries a surcharge (HP-03). */
  summerRetake: '24520010',
  /** Unpaid at the 20252 deadline: exam ban, final scores 0, paid late but the ban stays (CT-01..03). */
  examBanned: '24520011',
  /** On leave for 20262, so no base tuition is posted for that term (HS-06, HP-02). */
  onLeave: '24520012',
  /** Passed SE113 in 20252 and registers it again in 20262 to improve the grade (IMPROVEMENT surcharge). */
  improvement: '23520003',
  /** Withdrawn from 20252 onwards. */
  withdrawn: '23520008',
  /** Has never logged in; must change password first (NFR-08). */
  mustChangePassword: '25520010',
} as const

/** Course scores (tenths) forced for specific (student, term, course) to create failures. */
export const FORCED_SCORES: Record<string, number> = {
  [`${DEMO.retakeSwitched}:20251:IT002`]: 38,
  [`${DEMO.summerRetake}:20251:IT003`]: 42,
}

/** Score changed after the gradebook was locked (KQ-06). */
export const AMENDMENT = {
  student: DEMO.student,
  termCode: '20251',
  courseCode: 'IT004',
  reason: 'Phúc khảo bài thi cuối kỳ, chấm lại tăng 1,0 điểm',
}
