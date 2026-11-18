import { describe, expect, it } from 'bun:test'

import { ReconciliationDiscrepancyType } from '../generated/prisma/enums'
import { discrepancyLabels, previousVietnamDay, vietnamDay } from './reconciliation'
import { sepayDateTime } from './sepay-api'

describe('TT-08: reconciliation day boundaries', () => {
  it('uses Vietnam midnight for the half-open comparison window', () => {
    const window = vietnamDay(new Date('2027-02-10T03:00:00.000Z'))
    expect(window.label).toBe('2027-02-10')
    expect(window.date.toISOString()).toBe('2027-02-10T00:00:00.000Z')
    expect(window.from.toISOString()).toBe('2027-02-09T17:00:00.000Z')
    expect(window.to.toISOString()).toBe('2027-02-10T17:00:00.000Z')
    expect(sepayDateTime(window.from)).toBe('2027-02-10 00:00:00')
    expect(sepayDateTime(window.to)).toBe('2027-02-11 00:00:00')
  })

  it('reconciles the day that just ended when the daily job fires after midnight', () => {
    expect(vietnamDay(previousVietnamDay(new Date('2027-02-11T16:59:00.000Z'))).label).toBe(
      '2027-02-10',
    )
  })

  it('labels both residual discrepancy types for the read-only detail view', () => {
    expect(discrepancyLabels[ReconciliationDiscrepancyType.MISSING_AT_BANK]).toContain(
      'không thấy ở ngân hàng',
    )
    expect(discrepancyLabels[ReconciliationDiscrepancyType.AMOUNT_MISMATCH]).toBe('Lệch số tiền')
  })
})
