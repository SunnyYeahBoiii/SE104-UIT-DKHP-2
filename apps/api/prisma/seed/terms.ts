import { TermPhase, TermType } from '../../src/generated/prisma/enums'
import type { Catalog } from './catalog'
import { addDays, addHours, type Db, mondayOnOrAfter, must, vn, vnDate } from './lib'

export type TermInfo = {
  id: number
  code: string
  type: TermType
  phase: TermPhase
  /** Term number inside the academic year: 1, 2 or 3 (summer). Used in section codes such as SE104.P21. */
  number: 1 | 2 | 3
  registrationStartAt: Date
  registrationEndAt: Date
  adjustmentEndAt: Date
  tuitionDeadline: Date
}

/** The term whose registration is open whenever the seed is run. */
export const OPEN_TERM = '20262'
/** Terms that carry enrollments, grades and tuition, in chronological order. */
export const ACTIVE_TERMS = ['20251', '20252', '20253', '20261', OPEN_TERM] as const

const TERMS_BY_YEAR: Record<number, TermType[]> = {
  2023: [TermType.FIRST, TermType.SECOND],
  2024: [TermType.FIRST, TermType.SECOND, TermType.SUMMER],
  2025: [TermType.FIRST, TermType.SECOND, TermType.SUMMER],
  2026: [TermType.FIRST, TermType.SECOND],
}

const NUMBER: Record<TermType, 1 | 2 | 3> = { FIRST: 1, SECOND: 2, SUMMER: 3 }

/**
 * Milestones on the usual UIT calendar: HK1 starts in September, HK2 after Tết, summer in July. Registration
 * closes a week before classes; adjustment covers the first two weeks (HK-02 order holds by construction).
 */
function milestones(startYear: number, type: TermType) {
  const summer = type === TermType.SUMMER
  const startDate = mondayOnOrAfter(
    type === TermType.FIRST
      ? `${startYear}-09-01`
      : type === TermType.SECOND
        ? `${startYear + 1}-02-16`
        : `${startYear + 1}-07-01`,
  )
  const start = vn(startDate)
  return {
    startDate,
    registrationStartAt: addHours(addDays(start, summer ? -14 : -21), 8),
    registrationEndAt: addHours(addDays(start, -7), 17),
    adjustmentStartAt: addHours(start, 8),
    adjustmentEndAt: addHours(addDays(start, summer ? 4 : 13), 17),
    tuitionDeadline: addHours(addDays(start, summer ? 18 : 52), 17),
    finalExamStartAt: addHours(addDays(start, summer ? 49 : 119), 7),
  }
}

/**
 * The open term ignores the calendar and is anchored to the moment the seed runs, so a fresh local database
 * always has a registration window open right now.
 */
function openTermMilestones(now: Date) {
  const registrationStartAt = addDays(now, -2)
  const registrationEndAt = addDays(now, 12)
  const adjustmentStartAt = addDays(registrationEndAt, 7)
  const adjustmentEndAt = addDays(adjustmentStartAt, 14)
  return {
    startDate: vnDate(adjustmentStartAt),
    registrationStartAt,
    registrationEndAt,
    adjustmentStartAt,
    adjustmentEndAt,
    tuitionDeadline: addDays(adjustmentEndAt, 30),
    finalExamStartAt: addDays(adjustmentEndAt, 100),
  }
}

function phaseOf(code: string): TermPhase {
  if (code === OPEN_TERM) return TermPhase.REGISTRATION
  if (code === '20261') return TermPhase.IN_PROGRESS
  return TermPhase.CLOSED
}

export async function seedTerms(
  db: Db,
  catalog: Catalog,
  now: Date,
): Promise<Map<string, TermInfo>> {
  const terms = new Map<string, TermInfo>()

  for (const [year, types] of Object.entries(TERMS_BY_YEAR)) {
    const startYear = Number(year)
    const academicYear = await db.academicYear.create({ data: { startYear } })
    for (const type of types) {
      const code = `${startYear}${NUMBER[type]}`
      const m = code === OPEN_TERM ? openTermMilestones(now) : milestones(startYear, type)
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
      terms.set(code, { ...m, id: term.id, code, type, phase: term.phase, number: NUMBER[type] })
    }
  }

  // HK-05: staggered windows by cohort inside the open term's registration phase. Relative to `now`, K17–K18
  // have finished, K19 is registering and K20 has not started yet.
  const open = must(terms, OPEN_TERM)
  const slots: [name: string, cohorts: string[], startAt: Date, endAt: Date][] = [
    ['Khoá 17–18', ['K17', 'K18'], open.registrationStartAt, addDays(now, -1)],
    ['Khoá 19', ['K19'], addDays(now, -1), addDays(now, 6)],
    ['Khoá 20', ['K20'], addDays(now, 1), open.registrationEndAt],
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
