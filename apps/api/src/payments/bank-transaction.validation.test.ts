import { describe, expect, it } from 'bun:test'

import {
  assignInput,
  ignoreReasonInput,
  suggestedStudentCodes,
} from './bank-transaction.validation'

describe('D.4.4 MSSV suggestions', () => {
  it('finds a student code in free-form transfer content', () => {
    expect(suggestedStudentCodes('HP 24520007 hoc phi')).toEqual(['24520007'])
  })

  it('finds a code inside a payment code and de-duplicates with content runs', () => {
    expect(suggestedStudentCodes('HP2452000720262 chuyen khoan 24520007')).toEqual(['24520007'])
  })

  it('returns several distinct candidates, ignoring unrelated short numbers', () => {
    expect(suggestedStudentCodes('noi dung 12, 24520001 va 24520002 hoc phi')).toEqual([
      '24520001',
      '24520002',
    ])
  })

  it('returns nothing for content without a student-code-like run', () => {
    expect(suggestedStudentCodes('ung ho quy 200000')).toEqual([])
  })
})

describe('TT-07 command input', () => {
  it('accepts a valid MSSV and term', () => {
    expect(assignInput({ studentCode: '24520007', termCode: '20262' })).toEqual({
      studentCode: '24520007',
      termCode: '20262',
    })
  })

  it('rejects malformed assignment input', () => {
    expect(() => assignInput({ studentCode: 'abc', termCode: '20262' })).toThrow()
    expect(() => assignInput({ studentCode: '24520007', termCode: '26' })).toThrow()
  })

  it('requires a non-empty ignore reason', () => {
    expect(() => ignoreReasonInput({ reason: '   ' })).toThrow()
    expect(() => ignoreReasonInput({})).toThrow()
    expect(ignoreReasonInput({ reason: '  Khong phai hoc phi  ' })).toBe('Khong phai hoc phi')
  })
})
