import { TermPhase, TermType } from '../../src/generated/prisma/enums'
import type { Catalog } from './catalog'
import { addDays, addHours, type Db, must, vn } from './lib'

export type TermInfo = {
  id: number
  code: string
  type: TermType
  phase: TermPhase
  /** Term number inside the academic year: 1, 2 or 3 (summer). */
  number: 1 | 2 | 3
  startDate: string
  registrationStartAt: Date
  registrationEndAt: Date
  adjustmentStartAt: Date
  adjustmentEndAt: Date
  tuitionDeadline: Date
}

/** A.7: the term whose registration window is open on 06/01/2027. */
export const OPEN_TERM = '20262'
export const IN_PROGRESS_TERM = '20261'
export const SUMMER_TERM = '20263'

type Milestones = Omit<TermInfo, 'id' | 'code' | 'type' | 'phase' | 'number'> & {
  finalExamStartAt: Date
}

function regularMilestones(startDate: string): Milestones {
  const start = vn(startDate)
  return {
    startDate,
    registrationStartAt: addHours(addDays(start, -21), 8),
    registrationEndAt: addHours(addDays(start, -14), 17),
    adjustmentStartAt: addHours(start, 8),
    adjustmentEndAt: addHours(addDays(start, 14), 17),
    tuitionDeadline: addHours(addDays(start, 45), 17),
    finalExamStartAt: addHours(addDays(start, 60), 7),
  }
}

/** A.7 milestones. 20261's tuition deadline has passed; 20262 is open; 20263 is in preparation. */
const A7_MILESTONES: Record<string, Milestones> = {
  20261: {
    startDate: '2026-09-07',
    registrationStartAt: vn('2026-08-17', '08:00'),
    registrationEndAt: vn('2026-08-21', '17:00'),
    adjustmentStartAt: vn('2026-09-07', '08:00'),
    adjustmentEndAt: vn('2026-09-18', '17:00'),
    tuitionDeadline: vn('2026-10-31', '17:00'),
    finalExamStartAt: vn('2026-12-21', '07:00'),
  },
  20262: {
    startDate: '2027-01-11',
    registrationStartAt: vn('2027-01-05', '08:00'),
    registrationEndAt: vn('2027-01-08', '17:00'),
    adjustmentStartAt: vn('2027-01-18', '08:00'),
    adjustmentEndAt: vn('2027-01-22', '17:00'),
    tuitionDeadline: vn('2027-02-28', '17:00'),
    finalExamStartAt: vn('2027-05-17', '07:00'),
  },
  20263: {
    startDate: '2027-07-05',
    registrationStartAt: vn('2027-06-14', '08:00'),
    registrationEndAt: vn('2027-06-18', '17:00'),
    adjustmentStartAt: vn('2027-07-05', '08:00'),
    adjustmentEndAt: vn('2027-07-09', '17:00'),
    tuitionDeadline: vn('2027-08-31', '17:00'),
    finalExamStartAt: vn('2027-09-20', '07:00'),
  },
}

const ACADEMIC_YEARS: [startYear: number, starts: [string, TermType, string][]][] = [
  [
    2024,
    [
      ['2024-09-02', TermType.FIRST, '20241'],
      ['2025-02-17', TermType.SECOND, '20242'],
      ['2025-06-30', TermType.SUMMER, '20243'],
    ],
  ],
  [
    2025,
    [
      ['2025-09-01', TermType.FIRST, '20251'],
      ['2026-02-16', TermType.SECOND, '20252'],
      ['2026-07-06', TermType.SUMMER, '20253'],
    ],
  ],
  [
    2026,
    [
      ['2026-09-07', TermType.FIRST, '20261'],
      ['2027-01-11', TermType.SECOND, '20262'],
      ['2027-07-05', TermType.SUMMER, '20263'],
    ],
  ],
]

const NUMBER: Record<TermType, 1 | 2 | 3> = { FIRST: 1, SECOND: 2, SUMMER: 3 }

function phaseOf(code: string): TermPhase {
  if (code === OPEN_TERM) return TermPhase.REGISTRATION
  if (code === IN_PROGRESS_TERM) return TermPhase.IN_PROGRESS
  if (code === SUMMER_TERM) return TermPhase.PREPARATION
  return TermPhase.CLOSED
}

export async function seedTerms(db: Db, catalog: Catalog): Promise<Map<string, TermInfo>> {
  const terms = new Map<string, TermInfo>()

  for (const [startYear, starts] of ACADEMIC_YEARS) {
    const academicYear = await db.academicYear.create({ data: { startYear } })
    for (const [startDate, type, code] of starts) {
      const m = A7_MILESTONES[code] ?? regularMilestones(startDate)
      const summer = type === TermType.SUMMER
      const term = await db.term.create({
        data: {
          academicYearId: academicYear.id,
          type,
          termCode: code,
          phase: phaseOf(code),
          ...m,
          startDate: new Date(`${m.startDate}T00:00:00Z`),
          // Requirements §10 defaults, copied so later parameter edits are not retroactive.
          minCredits: summer ? 0 : 14,
          maxCredits: summer ? 12 : 24,
        },
      })
      terms.set(code, {
        ...m,
        id: term.id,
        code,
        type,
        phase: term.phase,
        number: NUMBER[type],
      })
    }
  }

  // A.7: K17-K18 already had their window on 05/01, K19 is open on 06/01, K20 opens on 07/01.
  const open = must(terms, OPEN_TERM)
  const slots: [name: string, cohorts: string[], startAt: Date, endAt: Date][] = [
    ['Khoá 17–18', ['K17', 'K18'], vn('2027-01-05', '08:00'), vn('2027-01-05', '17:00')],
    ['Khoá 19', ['K19'], vn('2027-01-06', '08:00'), vn('2027-01-06', '17:00')],
    ['Khoá 20', ['K20'], vn('2027-01-07', '08:00'), vn('2027-01-07', '17:00')],
  ]
  for (const [name, cohorts, startAt, endAt] of slots) {
    await db.registrationSlot.create({
      data: {
        termId: open.id,
        name,
        startAt,
        endAt,
        cohorts: { create: cohorts.map((c) => ({ cohortId: must(catalog.cohorts, c).id })) },
      },
    })
  }

  return terms
}
