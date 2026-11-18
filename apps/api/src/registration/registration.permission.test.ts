import { describe, expect, it } from 'bun:test'

import { permissionFor } from './registration.service'

const vn = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`)

const term = {
  type: 'SECOND',
  academicYear: { startYear: 2026 },
  registrationStartAt: vn('2027-01-05', '08:00'),
  registrationEndAt: vn('2027-01-08', '17:00'),
  adjustmentStartAt: vn('2027-01-18', '08:00'),
  adjustmentEndAt: vn('2027-01-22', '17:00'),
  tuitionDeadline: vn('2027-02-28', '17:00'),
  registrationSlots: [
    {
      startAt: vn('2027-01-06', '08:00'),
      endAt: vn('2027-01-06', '17:00'),
      cohorts: [{ cohortId: 1 }],
    },
  ],
} as never

const student = { cohort: { id: 1, code: 'K19' } } as never

describe('DK-02: registration permission and countdown', () => {
  it('exposes a countdown and refuses writes before the cohort slot', () => {
    const before = permissionFor(term, student, vn('2027-01-06', '07:00'))
    expect(before.state).toBe('BEFORE_SLOT')
    expect(before.countdownTo).toBe(vn('2027-01-06', '08:00').toISOString())
    expect(before.message).toContain('Khoá 19')
  })

  it('opens inside the slot and stays open for every cohort in adjustment', () => {
    expect(permissionFor(term, student, vn('2027-01-06', '10:00')).state).toBe('OPEN')
    const adjustment = permissionFor(term, student, vn('2027-01-20', '10:00'))
    expect(adjustment.state).toBe('OPEN')
    expect(adjustment.message).toContain('Điều chỉnh')
  })

  it('closes after the slot when no later slot exists for the cohort', () => {
    const closed = permissionFor(term, student, vn('2027-01-08', '09:00'))
    expect(closed.state).toBe('OUTSIDE_SLOT')
    expect(closed.countdownTo).toBeNull()
  })
})
