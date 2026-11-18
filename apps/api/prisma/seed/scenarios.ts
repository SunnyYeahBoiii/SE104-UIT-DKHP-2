import { vn } from './lib'

/** All seeded accounts share this password (dev only). */
export const DEV_PASSWORD = 'Dkhp@2026'

/** "Now" in every A.7 mockup: 06/01/2027. Fixed so the seed is deterministic across runs. */
export const DEMO_NOW = vn('2027-01-06', '10:00')

/** The named characters of design prompt §A.7, plus a few fillers for the sample classes. */
export const DEMO = {
  /** Main character; still owes the whole 20262 fixed tuition, QR shown. */
  student: '24520001',
  /** Child of a fallen soldier: 80 % discount, 3.000.000 / 15.000.000 đ. */
  discount80: '24520002',
  /** Conditional SE100 and SE113 while SE104 has no result yet (DK-05). */
  pendingPrerequisite: '24520003',
  /** Two priority groups; only the higher-priority one (70 %) applies (HS-02). */
  twoGroups: '24520004',
  /** Overpaid 500.000 đ in 20261; the credit is carried into 20262 (HP-11). */
  overpaid: '24520005',
  /** Passed IT002TH, retakes theory alone: cancelled IT002.P21, registered IT002.P22 (81.000 đ). */
  retakeReregistered: '24520009',
  /** K19 CQUI filler; the only student in the full CS106.P21 class. */
  fullClass: '24520006',
  /** Retakes IT003 in summer 20263: no fixed tuition, every line surcharged (HP-03). */
  summerRetake: '24520010',
  /** 5.000.000 đ outstanding on 20261 after the deadline, listed in BM7. */
  overdue: '24520011',
  /** Academic office switched CQUI → CLC during registration: 15M reversed, 20M posted (HP-12). */
  recalculated: '24520013',
  /** K19 CLC filler; the student in SE104.P23 (language EN). */
  clcStudent: '24520014',
  /** K18, improves SE113: 81.000 đ surcharge. */
  improvement: '23520003',
  /** K20 CLC; deliberately no fee schedule (the missing-schedule warning). */
  missingFeeSchedule: '25520001',
  /** K20 profile just created, never logged in, must change password (NFR-08). */
  newProfile: '25520010',
} as const
