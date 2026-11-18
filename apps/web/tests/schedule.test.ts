import { describe, expect, it } from 'bun:test'

import type { SectionMeeting } from '../src/lib/registration'
import { clashLabel, dayDate, sectionClash } from '../src/lib/schedule'

const meeting = (
  dayOfWeek: number,
  startSlot: number,
  endSlot: number,
  weeks: number,
): SectionMeeting => ({
  dayOfWeek,
  startSlot,
  endSlot,
  weeks,
  room: 'B1.14',
})

const weeks = (...values: number[]) => values.reduce((mask, week) => mask | (1 << (week - 1)), 0)

describe('DK-07: inline clash warning in SectionCard', () => {
  it('flags a shared day, shared week and overlapping periods', () => {
    const candidate = { code: 'IT004.P22', meetings: [meeting(2, 1, 3, weeks(1, 3, 5))] }
    const clash = sectionClash(candidate, [
      { code: 'SE104.P21', meetings: [meeting(2, 2, 4, weeks(3, 7))] },
    ])
    expect(clash).toEqual({ withCode: 'SE104.P21', dayOfWeek: 2, startSlot: 2, endSlot: 3 })
    expect(clashLabel(clash!)).toBe('Trùng với SE104.P21 · Thứ 2 tiết 2–3')
  })

  it('ignores alternating weeks, different days and sections without meetings', () => {
    const candidate = { code: 'A', meetings: [meeting(2, 1, 3, weeks(1, 3, 5))] }
    expect(
      sectionClash(candidate, [{ code: 'B', meetings: [meeting(2, 1, 3, weeks(2, 4, 6))] }]),
    ).toBeNull()
    expect(
      sectionClash(candidate, [{ code: 'B', meetings: [meeting(3, 1, 3, weeks(1))] }]),
    ).toBeNull()
    expect(sectionClash(candidate, [{ code: 'HT2', meetings: [] }])).toBeNull()
  })
})

describe('BB02: real dates of a weekly session', () => {
  it('maps week and Vietnamese day to a concrete date', () => {
    expect(dayDate('2027-01-04', 1, 2)).toBe('2027-01-04')
    expect(dayDate('2027-01-04', 3, 6)).toBe('2027-01-22')
  })
})
