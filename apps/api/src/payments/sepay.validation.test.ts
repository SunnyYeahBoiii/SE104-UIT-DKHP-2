import { describe, expect, it } from 'bun:test'

import { parsePaymentCode, parseTransactionDate, verifyApiKey } from './sepay.validation'

describe('SePay webhook validation', () => {
  it('TT-02: reads the deterministic HP + student + term payment code', () => {
    expect(parsePaymentCode('HP2352000120251')).toEqual({
      studentCode: '23520001',
      termCode: '20251',
    })
    expect(parsePaymentCode('  hp2452000120262  ')).toEqual({
      studentCode: '24520001',
      termCode: '20262',
    })
    expect(parsePaymentCode('ung ho quy')).toBeNull()
    expect(parsePaymentCode(null)).toBeNull()
  })

  it('TT-04: accepts only the Apikey scheme with an exact key', () => {
    expect(verifyApiKey('Apikey dkhp-sepay-dev-key', 'dkhp-sepay-dev-key')).toBe(true)
    expect(verifyApiKey('Apikey wrong', 'dkhp-sepay-dev-key')).toBe(false)
    expect(verifyApiKey('Bearer dkhp-sepay-dev-key', 'dkhp-sepay-dev-key')).toBe(false)
    expect(verifyApiKey(undefined, 'dkhp-sepay-dev-key')).toBe(false)
  })

  it('QĐ20.4: reads SePay bank timestamps in Vietnam time', () => {
    expect(parseTransactionDate('2027-01-06 09:15:00').toISOString()).toBe(
      '2027-01-06T02:15:00.000Z',
    )
  })
})
