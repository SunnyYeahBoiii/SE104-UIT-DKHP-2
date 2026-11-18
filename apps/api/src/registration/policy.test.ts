import { describe, expect, it } from 'bun:test'

import { AttemptType, PrerequisiteType } from '../generated/prisma/enums'
import {
  attemptTypeOf,
  checkPrerequisites,
  effectiveResult,
  firstRule,
  ruleExit,
  ruleMessage,
  type AttemptLike,
  type PrerequisiteCondition,
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
    expect(firstRule(['DK-09', 'DK-04'])).toBe('DK-04')
    expect(firstRule(['DK-09', 'DK-05', 'DK-04'])).toBe('DK-04')
    expect(firstRule([])).toBeNull()
  })

  it('gives every error a reason and a way out', () => {
    for (const rule of ['DK-02', 'DK-03', 'DK-19', 'DK-04', 'DK-05', 'DK-09'] as const) {
      expect(ruleMessage(rule, { code: 'SE104.P21', courseCode: 'SE104' }).length).toBeGreaterThan(
        20,
      )
      expect(ruleExit(rule).length).toBeGreaterThan(4)
      expect(ruleMessage(rule)).not.toMatch(/^\s*[A-Z]{2}-\d+\s*$/)
    }
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

describe('DK-05/KQ-02…KQ-04: prerequisite evaluation', () => {
  const pass = (code = 'SE104'): PrerequisiteCondition => ({
    code,
    type: PrerequisiteType.REQUIRED_PASS,
    equivalenceIds: [1, 2],
  })
  const attempted = (code = 'SE104'): PrerequisiteCondition => ({
    code,
    type: PrerequisiteType.REQUIRED_ATTEMPT,
    equivalenceIds: [1, 2],
  })

  it('is OK when a required-pass course is passed, including an equivalent code', () => {
    const attempt: AttemptLike = { courseId: 2, equivalenceId: 2, score: 8, order: 1 }
    expect(checkPrerequisites([pass()], [attempt])).toEqual({ state: 'OK' })
  })

  it('is MISSING with a precise reason when a required-pass course failed', () => {
    const check = checkPrerequisites([pass()], [attempt(1, 4, 1)])
    expect(check.state).toBe('MISSING')
    expect(check.state === 'MISSING' && check.message).toBe('Cần Đạt SE104')
    expect(
      ruleMessage('DK-05', { reason: check.state === 'MISSING' ? check.message : '' }),
    ).toContain('Cần Đạt SE104')
  })

  it('is CONDITIONAL while the prerequisite attempt has no grade', () => {
    const check = checkPrerequisites([pass()], [attempt(1, null, 1)])
    expect(check.state).toBe('CONDITIONAL')
    expect(check.state === 'CONDITIONAL' && check.message).toBe(
      'Đăng ký có điều kiện: SE104 đang học, chưa có điểm',
    )
  })

  it('accepts a failed grade for a required-attempt course but needs a grade at all', () => {
    expect(checkPrerequisites([attempted()], [attempt(1, 4, 1)])).toEqual({ state: 'OK' })
    expect(checkPrerequisites([attempted()], [attempt(1, null, 1)]).state).toBe('CONDITIONAL')
    expect(checkPrerequisites([attempted()], []).state).toBe('MISSING')
    const missing = checkPrerequisites([attempted()], [])
    expect(missing.state === 'MISSING' && missing.message).toBe('Cần học trước SE104')
  })

  it('lets a hard miss win over a condition that could wait', () => {
    const missing: PrerequisiteCondition = { ...attempted('MA003'), equivalenceIds: [99] }
    expect(checkPrerequisites([missing, pass()], [attempt(1, null, 1)]).state).toBe('MISSING')
  })
})
