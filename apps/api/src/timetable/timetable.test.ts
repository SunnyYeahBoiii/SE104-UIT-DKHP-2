import { describe, expect, it } from 'bun:test'
import ExcelJS from 'exceljs'

import { parseWorkbook, type RawRow } from './timetable-parse'
import { validateRows, type ReferenceData } from './timetable-validate'

const HEADERS = [
  'Mã MH',
  'Mã lớp',
  'Tố TC',
  'Thực hành',
  'HTGD',
  'Mã GV',
  'Thứ',
  'Tiết',
  'Phòng học',
  'Khoá học',
  'Hệ ĐT',
  'Sĩ số',
  'NBD',
  'NKT',
  'Cách tuần',
  'Khoa QL',
  'Đã ĐK',
  'Ghi chú',
  '',
]

async function workbookFrom(rows: unknown[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('TKB')
  for (const row of rows) sheet.addRow(row)
  return await workbook.xlsx.writeBuffer()
}

const refs: ReferenceData = {
  courseIds: new Map([
    ['SE104', 1],
    ['SE104TH', 2],
    ['CE119', 3],
    ['MA003', 4],
  ]),
  courses: new Map([
    ['SE104', { code: 'SE104', type: 'THEORY', credits: 3, companionCode: 'SE104TH' }],
    ['SE104TH', { code: 'SE104TH', type: 'PRACTICE', credits: 1, companionCode: 'SE104' }],
    ['CE119', { code: 'CE119', type: 'PRACTICE', credits: 2 }],
    ['MA003', { code: 'MA003', type: 'THEORY', credits: 3 }],
  ]),
  lecturers: new Map([
    ['GV001', 1],
    ['GV002', 2],
    ['GV003', 3],
  ]),
  rooms: new Set(['B1.14', 'B4.02']),
  systems: new Map([
    ['CQUI', 1],
    ['CLC', 2],
  ]),
}

const termStart = new Date('2027-01-11T00:00:00.000Z')

function row(n: number, overrides: Record<string, unknown> = {}): RawRow {
  return {
    excelRow: n,
    values: {
      courseCode: 'SE104',
      classCode: 'SE104.P21',
      credits: '3',
      practice: '0',
      mode: 'LT',
      lecturerCode: 'GV001',
      day: '2',
      slots: '1-3',
      room: 'B1.14',
      admissionYear: '16',
      systemCode: 'CQUI',
      capacity: '120(0)',
      startDate: '11/01/2027',
      endDate: '17/05/2027',
      cadence: '1',
      note: 'Ghi chú A',
      language: 'VN',
      ...overrides,
    },
  }
}

function codes(result: ReturnType<typeof validateRows>) {
  return result.errors.map((error) => error.code)
}

describe('parseWorkbook: school .xlsx template', () => {
  it('finds the header under title rows, maps columns and ignores KHOA QL / Đã ĐK', async () => {
    const buffer = await workbookFrom([
      ['DANH SÁCH MÔN HỌC MỞ - HỌC KỲ 2'],
      ['Học kỳ:', '20262'],
      HEADERS,
      [
        'SE104',
        'SE104.P21',
        3,
        0,
        'LT',
        'GV001',
        'Thứ 2',
        '1-3',
        'B1.14',
        '16',
        'CQUI',
        '120(0)',
        new Date('2027-01-11T00:00:00Z'),
        new Date('2027-05-17T00:00:00Z'),
        1,
        'CNTT',
        0,
        'Ghi chú A',
        'EN',
      ],
    ])
    const parsed = await parseWorkbook(buffer)
    expect(parsed.issues).toEqual([])
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]!.excelRow).toBe(4)
    expect(parsed.rows[0]!.values.courseCode).toBe('SE104')
    expect(parsed.rows[0]!.values.language).toBe('EN')
    expect(parsed.rows[0]!.values.note).toBe('Ghi chú A')
    expect(parsed.rows[0]!.values.admissionYear).toBe('16')
  })

  it('reports a file without a MÃ MH header', async () => {
    const buffer = await workbookFrom([
      ['Tên môn', 'Lớp'],
      ['SE104', 'SE104.P21'],
    ])
    const parsed = await parseWorkbook(buffer)
    expect(parsed.issues[0]!.code).toBe('HEADER_NOT_FOUND')
  })

  it('reports every missing required column at once', async () => {
    const buffer = await workbookFrom([
      ['Mã MH', 'Mã lớp', 'Thực hành', 'HTGD', 'Mã GV', 'Thứ', 'Tiết'],
      ['SE104', 'SE104.P21', 0, 'LT', 'GV001', 2, '1-3'],
    ])
    const parsed = await parseWorkbook(buffer)
    expect(parsed.issues[0]!.code).toBe('MISSING_COLUMN')
    expect(parsed.issues[0]!.message).toContain('TỐ TC')
    expect(parsed.issues[0]!.message).toContain('SĨ SỐ')
  })
})

describe('validateRows: TKB-03…TKB-07 row errors', () => {
  it('TKB-03: rejects unknown course, lecturer, room and system', () => {
    const result = validateRows(
      [
        row(2, { courseCode: 'IT999' }),
        row(3, { classCode: 'SE104.P22', lecturerCode: 'GV999' }),
        row(4, { classCode: 'SE104.P23', room: 'Z9.99' }),
        row(5, { classCode: 'SE104.P24', systemCode: 'XXX' }),
      ],
      refs,
      termStart,
    )
    expect(codes(result)).toEqual([
      'COURSE_UNKNOWN',
      'LECTURER_UNKNOWN',
      'ROOM_UNKNOWN',
      'SYSTEM_UNKNOWN',
    ])
    expect(result.errors.map((e) => e.column)).toEqual(['MÃ MH', 'MÃ GV', 'PHÒNG HỌC', 'HỆ ĐT'])
  })

  it('TKB-04: rejects duplicate class codes and a group without its theory class', () => {
    const result = validateRows(
      [row(2), row(3), row(4, { classCode: 'SE104.P99.1', practice: '1', mode: 'HT1' })],
      refs,
      termStart,
    )
    expect(codes(result)).toEqual(['CLASS_DUPLICATE', 'GROUP_PARENT_MISSING'])
  })

  it('TKB-04: resolves a group to the companion practice course and the parent mode', () => {
    const result = validateRows(
      [
        row(2, { day: '*', slots: '*' }),
        row(3, {
          classCode: 'SE104.P21.1',
          practice: '1',
          mode: 'HT1',
          lecturerCode: 'GV002',
          room: 'B4.02',
        }),
      ],
      refs,
      termStart,
    )
    expect(result.errors).toEqual([])
    expect(result.sections[1]!.courseCode).toBe('SE104TH')
    expect(result.sections[1]!.parentClassCode).toBe('SE104.P21')
    expect(result.sections[0]!.practiceMode).toBe('SCHEDULED')
    expect(result.summary.practiceGroups).toBe(1)
  })

  it('QĐ11.7: rejects mixed HT1/HT2 within one parent and drops meetings for HT2', () => {
    const result = validateRows(
      [
        row(2, { day: '*', slots: '*' }),
        row(3, { classCode: 'SE104.P21.1', practice: '1', mode: 'HT1' }),
        row(4, { classCode: 'SE104.P21.2', practice: '1', mode: 'HT2', room: 'B4.02' }),
      ],
      refs,
      termStart,
    )
    expect(codes(result)).toContain('MODE_INCONSISTENT')
    expect(result.sections[2]!.meetings).toEqual([])
  })

  it('TKB-04: a standalone practice course keeps its own code and needs no parent', () => {
    const result = validateRows(
      [row(2, { courseCode: 'CE119', classCode: 'CE119.P21.1', practice: '1', mode: 'HT1' })],
      refs,
      termStart,
    )
    expect(result.errors).toEqual([])
    expect(result.sections[0]!.courseCode).toBe('CE119')
    expect(result.sections[0]!.parentClassCode).toBeNull()
  })

  it('TKB-05: rejects inconsistent credits, accepts blank (course default) and zero', () => {
    const result = validateRows(
      [
        row(2, { classCode: 'SE104.P21', credits: '' }),
        row(3, { classCode: 'SE104.P22', credits: '4' }),
        row(4, { classCode: 'MA003.P21', courseCode: 'MA003', credits: '0' }),
      ],
      refs,
      termStart,
    )
    expect(codes(result)).toEqual(['CREDITS_INCONSISTENT'])
    expect(result.errors[0]!.column).toBe('TỐ TC')
    expect(result.errors[0]!.message).toContain('dòng 2 ghi 3')
    expect(result.offeredCourses.find((item) => item.courseCode === 'MA003')!.credits).toBe(0)
  })

  it('TKB-05: rejects a non-numeric credit value', () => {
    const result = validateRows([row(2, { credits: '3.5' })], refs, termStart)
    expect(codes(result)).toContain('CREDITS_INVALID')
  })

  it('TKB-06: decodes 0 as slot 10, 1/2 cadence and rejects bad day, slots, dates and cadence', () => {
    const ok = validateRows(
      [row(2, { slots: '0', cadence: '2', startDate: '11/01/2027', endDate: '25/01/2027' })],
      refs,
      termStart,
    )
    expect(ok.errors).toEqual([])
    expect(ok.sections[0]!.meetings[0]!.startSlot).toBe(10)
    expect(ok.sections[0]!.meetings[0]!.endSlot).toBe(10)
    expect(ok.sections[0]!.meetings[0]!.weeks).toBe(0b101)

    const bad = validateRows(
      [
        row(2, { day: '9' }),
        row(3, { classCode: 'SE104.P22', slots: '12' }),
        row(4, { classCode: 'SE104.P23', startDate: 'không phải ngày' }),
        row(5, { classCode: 'SE104.P24', startDate: '17/05/2027', endDate: '11/01/2027' }),
        row(6, { classCode: 'SE104.P25', cadence: '3' }),
      ],
      refs,
      termStart,
    )
    expect(codes(bad)).toEqual([
      'DAY_INVALID',
      'SLOTS_INVALID',
      'START_DATE_INVALID',
      'DATE_ORDER',
      'CADENCE_INVALID',
    ])
    expect(bad.errors[1]!.column).toBe('TIẾT')
  })

  it('TKB-06: `*` in THỨ and TIẾT means no meeting', () => {
    const result = validateRows([row(2, { day: '*', slots: '*' })], refs, termStart)
    expect(result.errors).toEqual([])
    expect(result.sections[0]!.meetings).toEqual([])
    expect(result.summary.meetings).toBe(0)
  })

  it('TKB-07: parses 120(0), 16 → 2021, 2021 → 2021, 0 → all cohorts', () => {
    const result = validateRows(
      [
        row(2, { admissionYear: '16' }),
        row(3, { classCode: 'SE104.P22', admissionYear: '2021' }),
        row(4, { classCode: 'SE104.P23', admissionYear: '0' }),
      ],
      refs,
      termStart,
    )
    expect(result.errors).toEqual([])
    expect(result.sections.map((section) => section.reservedAdmissionYear)).toEqual([
      2021,
      2021,
      null,
    ])
    expect(result.sections[0]!.capacity).toBe(120)
  })

  it('TKB-07: rejects a bad capacity and keeps the note and language for display', () => {
    const result = validateRows(
      [row(2, { capacity: '0(5)', note: 'Đồ án', language: 'EN' })],
      refs,
      termStart,
    )
    expect(codes(result)).toContain('CAPACITY_INVALID')
    expect(result.sections[0]!.note).toBe('Đồ án')
    expect(result.sections[0]!.language).toBe('EN')
  })

  it('TKB-02: warnings are separate from errors and never block the import', () => {
    const result = validateRows(
      [
        row(2, { classCode: 'SE104.P21', room: 'B1.14', slots: '1-3' }),
        row(3, { classCode: 'SE104.P22', lecturerCode: 'GV002', room: 'B1.14', slots: '2-4' }),
        row(4, {
          classCode: 'MA003.P21',
          courseCode: 'MA003',
          lecturerCode: 'GV003',
          room: 'B4.02',
          slots: '1-3',
        }),
      ],
      refs,
      termStart,
    )
    expect(result.errors).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]!.code).toBe('ROOM_CLASH')
    expect(result.warnings[0]!.column).toBe('PHÒNG HỌC')
    expect(result.warnings[0]!.row).toBe(3)
  })
})
