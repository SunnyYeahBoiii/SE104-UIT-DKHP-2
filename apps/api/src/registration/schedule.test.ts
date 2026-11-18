import { describe, expect, it } from 'bun:test'

import { meetingDates } from './schedule'

const termStart = new Date('2027-01-04T00:00:00.000Z')

describe('BB02: concrete meeting dates from the weeks bitmask', () => {
  it('maps week 1 Monday and the day offset to real dates', () => {
    expect(meetingDates(termStart, 2, 1 | (1 << 2))).toEqual(['2027-01-04', '2027-01-18'])
    expect(meetingDates(termStart, 6, 1)).toEqual(['2027-01-08'])
  })

  it('expands alternating weeks without touching the skipped week', () => {
    const odd = 1 | (1 << 2) | (1 << 4)
    expect(meetingDates(termStart, 3, odd)).toEqual(['2027-01-05', '2027-01-19', '2027-02-02'])
    expect(meetingDates(termStart, 3, odd)).not.toContain('2027-01-12')
    expect(meetingDates(termStart, 3, 0)).toEqual([])
  })
})
