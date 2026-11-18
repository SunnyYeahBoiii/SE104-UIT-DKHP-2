import { describe, expect, it } from 'bun:test'

import { amountInWords } from './money-in-words'

describe('BM6: amount in words', () => {
  it('writes round millions and thousands with "đồng chẵn"', () => {
    expect(amountInWords(15_000_000n)).toBe('Mười lăm triệu đồng chẵn')
    expect(amountInWords(500_000n)).toBe('Năm trăm nghìn đồng chẵn')
    expect(amountInWords(81_000n)).toBe('Tám mươi mốt nghìn đồng chẵn')
    expect(amountInWords(25_000n)).toBe('Hai mươi lăm nghìn đồng chẵn')
  })

  it('handles mixed groups and non-round amounts', () => {
    expect(amountInWords(15_081_000n)).toBe('Mười lăm triệu tám mươi mốt nghìn đồng chẵn')
    expect(amountInWords(1_234_567n)).toBe(
      'Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy đồng',
    )
    expect(amountInWords(11n)).toBe('Mười một đồng')
    expect(amountInWords(0n)).toBe('Không đồng')
  })
})
