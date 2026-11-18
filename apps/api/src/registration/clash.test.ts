import { describe, expect, it } from 'bun:test'

import { findScheduleClash, type ClashMeeting } from './clash'

const meeting = (
  dayOfWeek: number,
  startSlot: number,
  endSlot: number,
  weeks: number,
): ClashMeeting => ({
  dayOfWeek,
  startSlot,
  endSlot,
  weeks,
})

const weeks = (...numbers: number[]) => numbers.reduce((mask, week) => mask | (1 << (week - 1)), 0)

const section = (code: string, ...meetings: ClashMeeting[]) => ({ code, meetings })

describe('DK-07: schedule conflict on day, overlapping periods and a shared week', () => {
  it('does not clash on a different day or with disjoint periods', () => {
    expect(
      findScheduleClash(section('A', meeting(2, 1, 3, weeks(1, 2))), [
        section('B', meeting(3, 1, 3, weeks(1, 2))),
      ]),
    ).toBeNull()
    expect(
      findScheduleClash(section('A', meeting(2, 1, 3, weeks(1, 2))), [
        section('B', meeting(2, 4, 6, weeks(1, 2))),
      ]),
    ).toBeNull()
  })

  it('never clashes across alternating (cách tuần) weeks', () => {
    const odd = section('A', meeting(2, 1, 3, weeks(1, 3, 5, 7)))
    const even = section('B', meeting(2, 1, 3, weeks(2, 4, 6, 8)))
    expect(findScheduleClash(odd, [even])).toBeNull()
    expect(findScheduleClash(even, [odd])).toBeNull()
  })

  it('clashes when one offset (lệch tuần) meeting shares a single week', () => {
    const left = section('SE104.P21', meeting(2, 1, 3, weeks(1, 3, 5)))
    const shifted = section('SE104.P21.1', meeting(2, 6, 8, weeks(2, 4, 6)))
    expect(findScheduleClash(left, [shifted])).toBeNull()
    const overlapping = section('IT004.P22', meeting(2, 2, 4, weeks(5, 7)))
    expect(findScheduleClash(left, [shifted, overlapping])).toEqual({
      withCode: 'IT004.P22',
      dayOfWeek: 2,
      startSlot: 2,
      endSlot: 3,
    })
  })

  it('treats a shared slot as an overlap and ignores sections with no meeting', () => {
    expect(
      findScheduleClash(section('A', meeting(4, 1, 3, weeks(1))), [
        section('B', meeting(4, 3, 5, weeks(1))),
      ])?.withCode,
    ).toBe('B')
    expect(
      findScheduleClash(section('HT2', ...[]), [section('B', meeting(2, 1, 3, weeks(1)))]),
    ).toBeNull()
    expect(findScheduleClash(section('A', meeting(2, 1, 3, weeks(1))), [section('HT2')])).toBeNull()
  })
})
