import { describe, expect, it } from 'bun:test'

import { bankAccountInput, creditRateInput, feeScheduleInput } from './finance.validation'

describe('finance input validation (HP-08)', () => {
  it('accepts whole VND amounts and rejects fractional or unsafe money', () => {
    const input = feeScheduleInput({
      cohortId: 1,
      trainingSystemId: 2,
      baseTuition: 15_000_000,
      theoryCreditRate: 27_000,
      practiceCreditRate: 37_000,
    })
    expect(input.baseTuition).toBe(15_000_000)

    for (const bad of [15_000_000.5, '15000000', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        feeScheduleInput({
          cohortId: 1,
          trainingSystemId: 2,
          baseTuition: bad,
          theoryCreditRate: 27_000,
          practiceCreditRate: 37_000,
        }),
      ).toThrow()
    }
    expect(() =>
      feeScheduleInput({
        cohortId: 1,
        trainingSystemId: 2,
        baseTuition: -1,
        theoryCreditRate: 27_000,
        practiceCreditRate: 37_000,
      }),
    ).toThrow()
    expect(() =>
      feeScheduleInput({
        cohortId: 1,
        trainingSystemId: 2,
        baseTuition: 0,
        theoryCreditRate: 0,
        practiceCreditRate: 37_000,
      }),
    ).toThrow()
  })

  it('keeps default credit rates positive integers', () => {
    expect(creditRateInput({ theoryCreditRate: 27_000, practiceCreditRate: 37_000 })).toEqual({
      theoryCreditRate: 27_000,
      practiceCreditRate: 37_000,
    })
    expect(() => creditRateInput({ theoryCreditRate: 0, practiceCreditRate: 37_000 })).toThrow()
    expect(() =>
      creditRateInput({ theoryCreditRate: 27_000.2, practiceCreditRate: 37_000 }),
    ).toThrow()
  })

  it('accepts only digit-only account numbers and non-empty bank/owner', () => {
    expect(
      bankAccountInput({
        gateway: ' MBBank ',
        accountNumber: '0000123456',
        accountName: 'truong dai hoc',
      }),
    ).toEqual({ gateway: 'MBBank', accountNumber: '0000123456', accountName: 'TRUONG DAI HOC' })
    expect(() =>
      bankAccountInput({ gateway: 'MBBank', accountNumber: '00a12', accountName: 'Chủ tài khoản' }),
    ).toThrow()
    expect(() =>
      bankAccountInput({ gateway: '', accountNumber: '0012', accountName: 'Chủ tài khoản' }),
    ).toThrow()
  })
})
