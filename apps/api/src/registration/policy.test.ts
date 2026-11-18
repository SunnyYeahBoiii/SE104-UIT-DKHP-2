import { describe, expect, it } from 'bun:test'

import { AttemptType } from '../generated/prisma/enums'
import {
  attemptTypeOf,
  effectiveResult,
  firstRule,
  REGISTRATION_RULES,
  ruleExit,
  ruleMessage,
  type AttemptLike,
} from './policy'

const attempt = (courseId: number, score: number | null, order: number): AttemptLike => ({
  courseId,
  equivalenceId: null,
  score,
  order,
})

describe('DK-10: rule order and error copy', () => {
  it('returns the first failing rule in DK-10 order, not the first in the input', () => {
    expect(firstRule(['DK-09', 'DK-04', 'DK-02'])).toBe('DK-02')
    expect(firstRule(['DK-09', 'DK-11', 'DK-04'])).toBe('DK-04')
    expect(firstRule(['DK-09', 'DK-11'])).toBe('DK-11')
    expect(firstRule([])).toBeNull()
  })

  it('gives every error a reason and a way out', () => {
    for (const rule of REGISTRATION_RULES) {
      expect(ruleMessage(rule, { code: 'SE104.P21', courseCode: 'SE104' }).length).toBeGreaterThan(
        20,
      )
      expect(ruleExit(rule).length).toBeGreaterThan(4)
      expect(ruleMessage(rule)).not.toMatch(/^\s*[A-Z]{2}-\d+\s*$/)
    }
    expect(ruleMessage('DK-11', { parentFailed: 'true', parentCode: 'SE104.P21' })).toContain(
      'Lớp LT cha không đăng ký được',
    )
  })
})

describe('DK-16/KQ-04: attempt type from the effective result', () => {
  it('is FIRST with no prior attempt or an ungraded attempt', () => {
    expect(attemptTypeOf(effectiveResult([], [1]))).toBe(AttemptType.FIRST)
    expect(attemptTypeOf(effectiveResult([attempt(1, null, 3)], [1]))).toBe(AttemptType.FIRST)
  })

  it('is RETAKE when the nearest result is a fail, IMPROVEMENT when a pass exists', () => {
    expect(attemptTypeOf(effectiveResult([attempt(1, 4, 3)], [1]))).toBe(AttemptType.RETAKE)
    expect(attemptTypeOf(effectiveResult([attempt(1, 9, 1), attempt(1, 3, 2)], [1]))).toBe(
      AttemptType.IMPROVEMENT,
    )
  })

  it('treats equivalent courses as one result', () => {
    const old: AttemptLike = { courseId: 2, equivalenceId: 9, score: 8, order: 1 }
    const current: AttemptLike = { courseId: 1, equivalenceId: 9, score: null, order: 2 }
    expect(effectiveResult([old, current], [1, 9])).toBe('PASSED')
    expect(attemptTypeOf(effectiveResult([old, current], [1, 9]))).toBe(AttemptType.IMPROVEMENT)
  })
})
