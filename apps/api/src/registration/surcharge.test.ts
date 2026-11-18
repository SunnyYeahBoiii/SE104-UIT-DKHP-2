import { describe, expect, it } from 'bun:test'

import { surchargeFor } from './registration.service'
import { AttemptType, TermType } from '../generated/prisma/enums'

const rate = 27_000n

describe('HP-03: which registration lines carry a surcharge', () => {
  it('charges nothing for a first attempt in a main term', () => {
    expect(surchargeFor(TermType.FIRST, AttemptType.FIRST, 3, rate)).toBe(0n)
    expect(surchargeFor(TermType.SECOND, AttemptType.FIRST, 3, rate)).toBe(0n)
  })

  it('charges credits × unit price for retake and improvement in a main term', () => {
    expect(surchargeFor(TermType.SECOND, AttemptType.RETAKE, 3, rate)).toBe(81_000n)
    expect(surchargeFor(TermType.FIRST, AttemptType.IMPROVEMENT, 3, 37_000n)).toBe(111_000n)
  })

  it('charges every summer line, including first attempts, and no credits means no charge', () => {
    expect(surchargeFor(TermType.SUMMER, AttemptType.FIRST, 3, rate)).toBe(81_000n)
    expect(surchargeFor(TermType.SUMMER, AttemptType.RETAKE, 3, rate)).toBe(81_000n)
    expect(surchargeFor(TermType.SUMMER, AttemptType.FIRST, 0, rate)).toBe(0n)
  })
})
