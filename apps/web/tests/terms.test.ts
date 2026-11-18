import { describe, expect, it } from 'bun:test'

import { formatVn, isoFromVnInput, percentBetween, vnInputValue } from '../src/lib/terms'

describe('terms: every displayed time is Vietnam time (UTC+7)', () => {
  it('round-trips a datetime-local input through the +07:00 offset', () => {
    const instant = '2027-01-06T01:00:00.000Z'
    expect(vnInputValue(instant)).toBe('2027-01-06T08:00')
    expect(isoFromVnInput('2027-01-06T08:00')).toBe(instant)
    expect(vnInputValue(isoFromVnInput('2027-06-14T17:00'))).toBe('2027-06-14T17:00')
  })

  it('formats an instant in Vietnam regardless of the host time zone', () => {
    const rendered = formatVn('2027-01-06T01:00:00.000Z')
    expect(rendered).toContain('08:00')
    expect(rendered).toContain('6/1')
  })

  it('rejects a malformed input and clamps Gantt positions inside the timeline', () => {
    expect(() => isoFromVnInput('06/01/2027')).toThrow()
    expect(
      percentBetween(
        '2027-01-06T01:00:00.000Z',
        '2027-01-05T01:00:00.000Z',
        '2027-01-08T10:00:00.000Z',
      ),
    ).toBeGreaterThan(0)
    expect(
      percentBetween(
        '2026-01-01T00:00:00.000Z',
        '2027-01-01T00:00:00.000Z',
        '2027-02-01T00:00:00.000Z',
      ),
    ).toBe(0)
    expect(
      percentBetween(
        '2028-01-01T00:00:00.000Z',
        '2027-01-01T00:00:00.000Z',
        '2027-02-01T00:00:00.000Z',
      ),
    ).toBe(100)
  })
})
