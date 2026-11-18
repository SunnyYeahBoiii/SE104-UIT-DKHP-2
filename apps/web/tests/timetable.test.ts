import { describe, expect, it } from 'bun:test'

import { cohortLabel, reportCsv, type PreviewResponse } from '../src/lib/timetable'

const preview: PreviewResponse = {
  termCode: '20263',
  phase: 'PREPARATION',
  canImport: true,
  reason: null,
  fileName: 'tkb.xlsx',
  rowCount: 3012,
  errors: [
    { row: 214, column: 'MÃ MH', code: 'COURSE_UNKNOWN', message: 'IT999 không có trong danh mục' },
    { row: 1102, column: 'TIẾT', code: 'SLOTS_INVALID', message: 'Tiết 12 không hợp lệ' },
  ],
  warnings: [{ row: 17, column: 'PHÒNG HỌC', code: 'ROOM_CLASH', message: 'Trùng phòng B1.14' }],
  summary: { offeredCourses: 412, sections: 1380, practiceGroups: 920, meetings: 3012 },
  existing: { offeredCourses: 0, sections: 0 },
}

describe('timetable report and labels', () => {
  it('exports every error and warning with row and column, with a UTF-8 BOM', () => {
    const csv = reportCsv(preview)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"214","MÃ MH","COURSE_UNKNOWN","IT999 không có trong danh mục"')
    expect(csv).not.toContain('"1.102"')
    expect(csv).toContain('"1102","TIẾT","SLOTS_INVALID","Tiết 12 không hợp lệ"')
    expect(csv).toContain('Cảnh báo (không chặn nhập)')
    expect(csv).toContain('"17","PHÒNG HỌC","ROOM_CLASH","Trùng phòng B1.14"')
  })

  it('quotes embedded quotes so the report stays one row per issue', () => {
    const csv = reportCsv({
      ...preview,
      errors: [{ row: 2, column: 'MÃ MH', code: 'X', message: 'Môn "IT004" sai' }],
      warnings: [],
    })
    expect(csv).toContain('"Môn ""IT004"" sai"')
  })

  it('TKB-07: shows the reserved cohort as both K-label and admission year', () => {
    expect(cohortLabel(2021)).toBe('K16 · 2021')
    expect(cohortLabel(2025)).toBe('K20 · 2025')
    expect(cohortLabel(null)).toBe('Mọi khoá')
  })
})
