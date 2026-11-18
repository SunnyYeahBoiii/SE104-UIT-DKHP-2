import { describe, expect, it } from 'bun:test'

import type { Bm7 } from './tuition.service'
import {
  missingFeeScheduleMessage,
  projectAfter,
  recalculationGroup,
  recalculationGroupOf,
  recalculationReason,
} from './recalculation'

const bm7 = (values: Partial<Bm7> = {}): Bm7 => ({
  grossAmount: 15_000_000,
  discountAmount: 0,
  netAmount: 15_000_000,
  paidAmount: 3_000_000,
  outstandingAmount: 12_000_000,
  ...values,
})

const facts = {
  cohortId: 1,
  trainingSystemId: 1,
  cohortCode: 'K19',
  trainingSystemCode: 'CQUI',
  priorityGroupIds: [],
}

describe('HP-12: what counts as a recalculation', () => {
  it('names each changed profile field and stays quiet for a plain profile edit', () => {
    expect(recalculationReason(facts, { ...facts, trainingSystemCode: 'CLC' })).toBe(
      'đổi hệ CQUI → CLC',
    )
    expect(recalculationReason(facts, { ...facts, cohortCode: 'K18' })).toBe('đổi khoá K19 → K18')
    expect(recalculationReason(facts, { ...facts, priorityGroupIds: [3] })).toBe(
      'đổi đối tượng ưu tiên',
    )
    expect(recalculationReason(facts, { ...facts })).toBe('')
  })

  it('ignores priority group ordering', () => {
    expect(
      recalculationReason(
        { ...facts, priorityGroupIds: [1, 2] },
        { ...facts, priorityGroupIds: [2, 1] },
      ),
    ).toBe('')
  })

  it('tells the officer to ask Finance when the new pair has no fee table', () => {
    expect(missingFeeScheduleMessage('K19', 'CLC')).toBe(
      'Chưa có bảng phí cho Khoá 19 · CLC. Liên hệ Phòng Tài vụ.',
    )
  })

  it('gives every entry of one run the same heading', () => {
    const group = recalculationGroup('đổi hệ CQUI → CLC', new Date('2027-01-06T03:00:00Z'))
    expect(group).toContain('Tính lại học phí · đổi hệ CQUI → CLC')
    expect(recalculationGroupOf(`${group} — Đảo học phí cố định`)).toBe(group)
    expect(recalculationGroupOf('Học phí cố định HK2')).toBeNull()
  })
})

describe('HP-09/HP-12: projecting BM7 after a recalculation', () => {
  it('replaces old debits and discounts without touching payments', () => {
    const after = projectAfter(bm7(), 15_000_000n, 0n, 20_000_000n, 0n)
    expect(after).toEqual({
      grossAmount: 20_000_000,
      discountAmount: 0,
      netAmount: 20_000_000,
      paidAmount: 3_000_000,
      outstandingAmount: 17_000_000,
    })
  })

  it('lets a negative outstanding amount stand as a credit balance', () => {
    const after = projectAfter(
      bm7({
        grossAmount: 15_000_000,
        discountAmount: 12_000_000,
        netAmount: 3_000_000,
        outstandingAmount: 0,
      }),
      15_000_000n,
      12_000_000n,
      14_500_000n,
      11_600_000n,
    )
    expect(after.netAmount).toBe(2_900_000)
    expect(after.outstandingAmount).toBe(-100_000)
  })
})
