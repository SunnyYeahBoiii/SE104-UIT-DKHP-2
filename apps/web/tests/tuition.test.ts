import { describe, expect, it } from 'bun:test'

import {
  groupLedger,
  money,
  signedMoney,
  tuitionQrPayload,
  tuitionStatus,
  type LedgerRow,
} from '../src/lib/tuition'

const deadline = '2027-02-28T10:00:00.000Z'
const bm7 = (outstanding: number) => ({
  grossAmount: 15_000_000,
  discountAmount: 0,
  netAmount: 15_000_000,
  paidAmount: 15_000_000 - outstanding,
  outstandingAmount: outstanding,
})

describe('tuition: A.4 money and status formatting', () => {
  it('formats whole VND with thousand separators and a signed ledger amount', () => {
    expect(money(15_081_000)).toBe('15.081.000 đ')
    expect(signedMoney(81_000)).toBe('+81.000 đ')
    expect(signedMoney(-12_000_000)).toBe('−12.000.000 đ')
  })

  it('derives status from the ledger figures and the deadline', () => {
    expect(tuitionStatus(bm7(15_000_000), deadline, Date.parse('2027-01-06T03:00:00Z'))).toBe(
      'OUTSTANDING',
    )
    expect(tuitionStatus(bm7(5_000_000), deadline, Date.parse('2027-03-01T03:00:00Z'))).toBe(
      'OVERDUE',
    )
    expect(tuitionStatus(bm7(0), deadline, Date.parse('2027-03-01T03:00:00Z'))).toBe('SETTLED')
    expect(tuitionStatus(bm7(-500_000), deadline, Date.parse('2027-03-01T03:00:00Z'))).toBe(
      'CREDIT',
    )
  })

  it('TT-02/TT-03: QR content carries the receiving account, locked amount and payment code', () => {
    expect(
      tuitionQrPayload(
        { gateway: 'MBBank', accountNumber: '0000000000', accountName: 'UIT' },
        15_000_000,
        'HP2452000120262',
      ),
    ).toBe('MBBank|0000000000|UIT|15000000|HP2452000120262')
  })

  it('groups recalculation rows under one heading and leaves normal rows alone', () => {
    const row = (id: number, group: string | null): LedgerRow => ({
      id,
      date: '2027-01-06T01:00:00.000Z',
      label: 'Đảo học phí cố định',
      detail: null,
      amount: -15_000_000,
      type: 'BASE_TUITION_REVERSAL',
      receiptId: null,
      receiptNumber: null,
      group,
    })
    expect(
      groupLedger([row(1, null), row(2, 'Tính lại học phí'), row(3, 'Tính lại học phí')]),
    ).toEqual([
      { title: null, rows: [row(1, null)] },
      {
        title: 'Tính lại học phí',
        rows: [row(2, 'Tính lại học phí'), row(3, 'Tính lại học phí')],
      },
    ])
  })
})
