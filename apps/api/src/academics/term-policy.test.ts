import { describe, expect, it } from 'bun:test'

import {
  cohortsWithoutSlots,
  editableMilestones,
  slotState,
  termPhase,
  validateCreditLimits,
  validateMilestoneChange,
  validateMilestoneOrder,
  validateRegistrationOverlap,
  validateSlotWrite,
  validateSlotsInsideRegistration,
  type MilestoneValues,
  type SlotInput,
} from './term-policy'

/** A.7 "now" is 06/01/2027 10:00 Vietnam. Injected everywhere, so no test reads the real clock. */
const now = new Date('2027-01-06T10:00:00+07:00')
const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)

const milestones = (): MilestoneValues => ({
  registrationStartAt: vn('2027-01-05', '08:00'),
  registrationEndAt: vn('2027-01-08', '17:00'),
  adjustmentStartAt: vn('2027-01-18', '08:00'),
  adjustmentEndAt: vn('2027-01-22', '17:00'),
  tuitionDeadline: vn('2027-02-28', '17:00'),
})

const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code)

describe('HK-03: phase derived from milestones', () => {
  it('moves preparation → registration → adjustment → in progress, never backwards', () => {
    const m = milestones()
    expect(termPhase(m, vn('2027-01-04', '23:59'))).toBe('PREPARATION')
    expect(termPhase(m, vn('2027-01-06', '10:00'))).toBe('REGISTRATION')
    expect(termPhase(m, vn('2027-01-19', '10:00'))).toBe('ADJUSTMENT')
    expect(termPhase(m, vn('2027-02-01', '10:00'))).toBe('IN_PROGRESS')
  })
})

describe('HK-02: milestone order', () => {
  it('accepts regStart < regEnd ≤ adjStart < adjEnd < tuitionDeadline < final exam', () => {
    expect(validateMilestoneOrder(milestones(), vn('2027-05-17', '07:00'))).toEqual([])
  })

  it('reports each violated pair with the offending fields', () => {
    const m = milestones()
    m.registrationEndAt = vn('2027-01-05', '08:00')
    m.adjustmentStartAt = vn('2027-01-05', '07:00')
    m.tuitionDeadline = vn('2027-01-19', '08:00')
    const issues = validateMilestoneOrder(m)
    expect(codes(issues)).toEqual(['MILESTONE_ORDER', 'MILESTONE_ORDER', 'MILESTONE_ORDER'])
    expect(issues[1]?.fields).toContain('adjustmentStartAt')
    expect(issues[2]?.fields).toContain('tuitionDeadline')
  })

  it('rejects a tuition deadline on or after the final exam', () => {
    const exam = vn('2027-05-17', '07:00')
    expect(codes(validateMilestoneOrder(milestones(), exam))).toEqual([])
    expect(
      codes(validateMilestoneOrder({ ...milestones(), tuitionDeadline: exam }, exam)),
    ).toContain('MILESTONE_ORDER')
  })
})

describe('HK-06: who may edit which milestone', () => {
  it('an upcoming range may move both ends; a started range only its end; a finished range nothing', () => {
    const m = milestones()
    expect(editableMilestones(m, vn('2026-12-01', '08:00'))).toEqual({
      registrationStartAt: true,
      registrationEndAt: true,
      adjustmentStartAt: true,
      adjustmentEndAt: true,
      tuitionDeadline: true,
    })
    expect(editableMilestones(m, now)).toEqual({
      registrationStartAt: false,
      registrationEndAt: true,
      adjustmentStartAt: true,
      adjustmentEndAt: true,
      tuitionDeadline: true,
    })
    expect(editableMilestones(m, vn('2027-01-25', '08:00'))).toMatchObject({
      registrationStartAt: false,
      registrationEndAt: false,
      adjustmentStartAt: false,
      adjustmentEndAt: false,
      tuitionDeadline: true,
    })
    expect(editableMilestones(m, vn('2027-03-01', '08:00')).tuitionDeadline).toBe(false)
  })

  it('extends a started registration window but rejects edits to its start', () => {
    const m = milestones()
    const extended = { ...m, registrationEndAt: vn('2027-01-11', '17:00') }
    expect(validateMilestoneChange(m, extended, now)).toEqual([])

    const movedStart = { ...m, registrationStartAt: vn('2027-01-06', '12:00') }
    expect(codes(validateMilestoneChange(m, movedStart, now))).toContain('MILESTONE_LOCKED')
  })

  it('locks a finished range and a passed tuition deadline', () => {
    const m = milestones()
    const late = vn('2027-01-25', '08:00')
    expect(
      codes(validateMilestoneChange(m, { ...m, adjustmentEndAt: vn('2027-01-23', '17:00') }, late)),
    ).toContain('MILESTONE_LOCKED')
    expect(
      codes(
        validateMilestoneChange(
          m,
          { ...m, tuitionDeadline: vn('2027-03-02', '17:00') },
          vn('2027-03-01', '08:00'),
        ),
      ),
    ).toContain('MILESTONE_LOCKED')
  })

  it('rejects a new value before now even when the milestone is otherwise editable', () => {
    const m = milestones()
    const past = { ...m, registrationEndAt: vn('2027-01-06', '09:00') }
    expect(codes(validateMilestoneChange(m, past, now))).toContain('MILESTONE_IN_PAST')
    expect(validateMilestoneChange(m, { ...m, registrationEndAt: now }, now)).toEqual([])
  })
})

describe('HK-04: one open registration period', () => {
  const other = {
    termCode: '20261',
    registrationStartAt: vn('2026-08-17', '08:00'),
    adjustmentEndAt: vn('2026-09-18', '17:00'),
  }
  const candidate = {
    termCode: '20262',
    registrationStartAt: milestones().registrationStartAt,
    adjustmentEndAt: milestones().adjustmentEndAt,
  }

  it('rejects an overlapping term and names it in the message', () => {
    const issues = validateRegistrationOverlap(
      { ...candidate, registrationStartAt: vn('2026-09-01', '08:00') },
      [other],
    )
    expect(codes(issues)).toEqual(['TERM_OVERLAP'])
    expect(issues[0]?.message).toContain('20261')
  })

  it('allows adjacent or disjoint periods', () => {
    expect(
      validateRegistrationOverlap(candidate, [
        { ...other, adjustmentEndAt: candidate.registrationStartAt },
      ]),
    ).toEqual([])
    expect(validateRegistrationOverlap(candidate, [other])).toEqual([])
  })
})

describe('HK-07: registration slots', () => {
  const m = milestones()
  const slot = (): SlotInput => ({
    startAt: vn('2027-01-06', '08:00'),
    endAt: vn('2027-01-06', '17:00'),
    cohortIds: [1],
  })

  it('classifies upcoming, ongoing and past slots', () => {
    expect(slotState(slot(), vn('2027-01-05', '08:00'))).toBe('UPCOMING')
    expect(slotState(slot(), now)).toBe('ONGOING')
    expect(slotState(slot(), vn('2027-01-06', '17:00'))).toBe('PAST')
  })

  it('lets a future slot move freely or be deleted, an ongoing slot only extend its end', () => {
    const future = {
      ...slot(),
      startAt: vn('2027-01-07', '08:00'),
      endAt: vn('2027-01-07', '17:00'),
    }
    expect(
      validateSlotWrite({
        current: future,
        next: { ...future, cohortIds: [1, 2] },
        m,
        now,
        knownCohortIds: [1, 2],
      }),
    ).toEqual([])
    expect(
      validateSlotWrite({
        current: future,
        next: future,
        m,
        now,
        knownCohortIds: [1],
        deleting: true,
      }),
    ).toEqual([])

    const running = slot()
    expect(
      validateSlotWrite({
        current: running,
        next: { ...running, endAt: vn('2027-01-06', '18:00') },
        m,
        now,
        knownCohortIds: [1],
      }),
    ).toEqual([])
    expect(
      codes(
        validateSlotWrite({
          current: running,
          next: { ...running, cohortIds: [2] },
          m,
          now,
          knownCohortIds: [1, 2],
        }),
      ),
    ).toContain('SLOT_LOCKED')
    expect(
      codes(
        validateSlotWrite({
          current: running,
          next: running,
          m,
          now,
          knownCohortIds: [1],
          deleting: true,
        }),
      ),
    ).toContain('SLOT_LOCKED')
  })

  it('freezes a past slot', () => {
    const past = { ...slot(), startAt: vn('2026-01-05', '08:00'), endAt: vn('2026-01-05', '17:00') }
    expect(
      codes(
        validateSlotWrite({
          current: past,
          next: { ...past, endAt: vn('2027-01-07', '17:00') },
          m,
          now,
          knownCohortIds: [1],
        }),
      ),
    ).toContain('SLOT_LOCKED')
  })

  it('requires a window inside registration, a valid end and at least one known cohort', () => {
    const s = { ...slot(), startAt: vn('2027-01-07', '08:00'), endAt: vn('2027-01-07', '17:00') }
    expect(
      codes(validateSlotWrite({ current: null, next: s, m, now, knownCohortIds: [1] })),
    ).toEqual([])
    expect(
      codes(
        validateSlotWrite({
          current: null,
          next: { ...s, cohortIds: [] },
          m,
          now,
          knownCohortIds: [1],
        }),
      ),
    ).toContain('SLOT_NO_COHORT')
    expect(
      codes(
        validateSlotWrite({
          current: null,
          next: { ...s, cohortIds: [9] },
          m,
          now,
          knownCohortIds: [1],
        }),
      ),
    ).toContain('SLOT_UNKNOWN_COHORT')
    expect(
      codes(
        validateSlotWrite({
          current: null,
          next: { ...s, endAt: s.startAt },
          m,
          now,
          knownCohortIds: [1],
        }),
      ),
    ).toContain('SLOT_ORDER')
    const later = {
      startAt: vn('2027-01-08', '18:00'),
      endAt: vn('2027-01-09', '17:00'),
      cohortIds: [1],
    }
    expect(
      codes(validateSlotWrite({ current: null, next: later, m, now, knownCohortIds: [1] })),
    ).toContain('SLOT_OUTSIDE_REGISTRATION')
    const earlier = {
      startAt: vn('2027-01-04', '08:00'),
      endAt: vn('2027-01-04', '17:00'),
      cohortIds: [1],
    }
    expect(
      codes(validateSlotWrite({ current: null, next: earlier, m, now, knownCohortIds: [1] })),
    ).toContain('SLOT_OUTSIDE_REGISTRATION')
  })

  it('reports existing slots pushed outside registration by a milestone change', () => {
    const running = slot()
    expect(validateSlotsInsideRegistration([running], m)).toEqual([])
    const moved = { ...m, registrationEndAt: vn('2027-01-06', '12:00') }
    expect(codes(validateSlotsInsideRegistration([running], moved))).toContain(
      'SLOT_OUTSIDE_REGISTRATION',
    )
  })

  it('warns (without blocking) about cohorts with no slot', () => {
    expect(cohortsWithoutSlots([1, 2, 3], [1, 3])).toEqual([2])
    expect(cohortsWithoutSlots([1, 2], [1, 2])).toEqual([])
  })
})

describe('DK-08 / §10: credit limits', () => {
  const current = { minCredits: 14, mainTermMaxCredits: 24, summerMaxCredits: 12 }
  it('accepts a changed valid set and copies it only to preparation terms', () => {
    expect(
      validateCreditLimits(
        { minCredits: 12, mainTermMaxCredits: 21, summerMaxCredits: 9 },
        current,
      ),
    ).toEqual([])
  })
  it('rejects non-positive, non-integer, inverted and unchanged values', () => {
    expect(codes(validateCreditLimits({ ...current, minCredits: 0 }, current))).toContain(
      'CREDIT_LIMIT_INVALID',
    )
    expect(codes(validateCreditLimits({ ...current, summerMaxCredits: 1.5 }, current))).toContain(
      'CREDIT_LIMIT_INVALID',
    )
    expect(codes(validateCreditLimits({ ...current, minCredits: 25 }, current))).toContain(
      'CREDIT_LIMIT_INVALID',
    )
    expect(codes(validateCreditLimits(current, current))).toContain('CREDIT_LIMIT_UNCHANGED')
  })
})
