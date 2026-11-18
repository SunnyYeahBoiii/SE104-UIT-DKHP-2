import { describe, expect, it } from 'bun:test'

import { mergeSuggestions, STATUS_LABEL, type StudentOption } from '../src/lib/bank-transactions'

const options: StudentOption[] = [
  { studentCode: '24520001', fullName: 'Nguyễn Văn A', email: 'a@uit.edu.vn' },
  { studentCode: '24520007', fullName: 'Trần Thị B', email: 'b@uit.edu.vn' },
  { studentCode: '24520002', fullName: 'Lê Văn C', email: 'c@uit.edu.vn' },
]

describe('D.4.4 giao dịch ngân hàng', () => {
  it('ranks codes found in the transfer content above other results', () => {
    const result = mergeSuggestions(['24520007'], '', options)
    expect(result.map((row) => row.studentCode)).toEqual(['24520007', '24520001', '24520002'])
  })

  it('filters by MSSV or name and removes duplicates', () => {
    expect(mergeSuggestions([], 'Thị', options).map((row) => row.studentCode)).toEqual(['24520007'])
    expect(mergeSuggestions([], '2452000', options)).toHaveLength(3)
  })

  it('labels every transaction status in Vietnamese', () => {
    expect(STATUS_LABEL.UNMATCHED).toBe('Chưa khớp')
    expect(STATUS_LABEL.MATCHED).toBe('Đã khớp')
    expect(STATUS_LABEL.IGNORED).toBe('Bỏ qua')
    expect(STATUS_LABEL.PENDING).toBe('Chờ xử lý')
  })
})
