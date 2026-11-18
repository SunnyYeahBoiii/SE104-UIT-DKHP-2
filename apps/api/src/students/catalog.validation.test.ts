import { describe, expect, it } from 'bun:test'

import { cohortInput, priorityGroupInput } from './catalog.validation'

function errorCode(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    const response = (error as { getResponse?: () => { code?: string } }).getResponse?.()
    return response?.code ?? ''
  }
  throw new Error('expected validation to fail')
}

describe('HS-02: priority group input', () => {
  const valid = { code: 'TEST', name: 'Đối tượng thử', discountRate: 50, priority: 5 }

  it('accepts the integer boundaries 0 and 100', () => {
    expect(priorityGroupInput({ ...valid, discountRate: 0 })).toEqual({
      ...valid,
      discountRate: 0,
    })
    expect(priorityGroupInput({ ...valid, discountRate: 100 }).discountRate).toBe(100)
  })

  it('rejects fractional, negative, over-100 and non-numeric rates', () => {
    for (const discountRate of [50.5, -1, 101, '50', null]) {
      expect(errorCode(() => priorityGroupInput({ ...valid, discountRate }))).toBe(
        'INVALID_DISCOUNT_RATE',
      )
    }
  })

  it('requires a name and an integer priority', () => {
    expect(errorCode(() => priorityGroupInput({ ...valid, name: '  ' }))).toBe('INVALID_REQUEST')
    for (const priority of [1.5, '5', undefined]) {
      expect(errorCode(() => priorityGroupInput({ ...valid, priority }))).toBe('INVALID_PRIORITY')
    }
  })
})

describe('HS-15: cohort input', () => {
  it('accepts an admission year and trims the code', () => {
    expect(cohortInput({ code: '  K21  ', admissionYear: 2026 })).toEqual({
      code: 'K21',
      admissionYear: 2026,
    })
  })

  it('rejects missing code and non-integer year', () => {
    expect(errorCode(() => cohortInput({ code: '', admissionYear: 2026 }))).toBe('INVALID_REQUEST')
    for (const admissionYear of [2026.5, '2026', undefined]) {
      expect(errorCode(() => cohortInput({ code: 'K21', admissionYear }))).toBe(
        'INVALID_ADMISSION_YEAR',
      )
    }
  })
})
