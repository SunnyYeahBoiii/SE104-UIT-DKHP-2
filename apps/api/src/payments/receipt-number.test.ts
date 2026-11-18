import { describe, expect, it } from 'bun:test'

import { nextReceiptNumber } from './receipt-number'

describe('TT-01: receipt numbering per term', () => {
  it('continues the seeded sequence and ignores other terms', () => {
    expect(nextReceiptNumber('20262', ['PT-20262-00011', 'PT-20262-00012', 'PT-20261-00099'])).toBe(
      'PT-20262-00013',
    )
  })

  it('starts at 00001 for a fresh term and pads past five digits', () => {
    expect(nextReceiptNumber('20263', [])).toBe('PT-20263-00001')
    expect(nextReceiptNumber('20263', ['PT-20263-99999'])).toBe('PT-20263-100000')
  })
})
