import ExcelJS from 'exceljs'

export type ColumnKey =
  | 'courseCode'
  | 'classCode'
  | 'credits'
  | 'practice'
  | 'mode'
  | 'lecturerCode'
  | 'day'
  | 'slots'
  | 'room'
  | 'admissionYear'
  | 'systemCode'
  | 'capacity'
  | 'startDate'
  | 'endDate'
  | 'cadence'
  | 'note'
  | 'language'

export type ImportIssue = {
  row: number
  column: string
  code: string
  message: string
}

export type RawRow = {
  excelRow: number
  values: Partial<Record<ColumnKey, unknown>>
}

export type ParsedWorkbook = {
  rows: RawRow[]
  issues: ImportIssue[]
}

type ColumnSpec = { label: string; aliases: string[] }

const COLUMNS: Record<ColumnKey, ColumnSpec> = {
  courseCode: {
    label: 'MÃ MH',
    aliases: ['MÃ MH', 'MÃ MÔN', 'MÃ MÔN HỌC', 'MÔN HỌC', 'TÊN MÔN HỌC'],
  },
  classCode: { label: 'MÃ LỚP', aliases: ['MÃ LỚP', 'MÃ LỚP HỌC PHẦN', 'LỚP'] },
  credits: { label: 'TỐ TC', aliases: ['TỐ TC', 'TỐ TÍN CHỈ', 'SỐ TC', 'SỐ TÍN CHỈ'] },
  practice: { label: 'THỰC HÀNH', aliases: ['THỰC HÀNH', 'THỰC HÀNH 0/1', 'THỰC HÀNH (0/1)'] },
  mode: { label: 'HTGD', aliases: ['HTGD', 'HÌNH THỨC GD', 'HÌNH THỨC GIẢNG DẠY'] },
  lecturerCode: { label: 'MÃ GV', aliases: ['MÃ GV', 'MÃ GIẢNG VIÊN', 'GIẢNG VIÊN'] },
  day: { label: 'THỨ', aliases: ['THỨ', 'THỨ TRONG TUẦN'] },
  slots: { label: 'TIẾT', aliases: ['TIẾT', 'TIẾT HỌC', 'SỐ TIẾT'] },
  room: { label: 'PHÒNG HỌC', aliases: ['PHÒNG HỌC', 'PHÒNG'] },
  admissionYear: { label: 'KHOÁ HỌC', aliases: ['KHOÁ HỌC', 'KHOÁ'] },
  systemCode: { label: 'HỆ ĐT', aliases: ['HỆ ĐT', 'HỆ ĐÀO TẠO', 'HỆ'] },
  capacity: { label: 'SĨ SỐ', aliases: ['SĨ SỐ', 'SỐ LƯỢNG', 'SĨ SỐ TỐI ĐA'] },
  startDate: { label: 'NBD', aliases: ['NBD', 'NGÀY BẮT ĐẦU', 'TỪ NGÀY'] },
  endDate: { label: 'NKT', aliases: ['NKT', 'NGÀY KẾT THÚC', 'ĐẾN NGÀY'] },
  cadence: { label: 'CÁCH TUẦN', aliases: ['CÁCH TUẦN', 'CÁCH TUẦN (1/2)'] },
  note: { label: 'GHICHU', aliases: ['GHICHU', 'GHI CHÚ'] },
  language: { label: 'NGÔN NGỮ', aliases: ['', 'NGÔN NGỮ', 'NGON NGU', 'NN'] },
}

const REQUIRED: ColumnKey[] = [
  'courseCode',
  'classCode',
  'credits',
  'practice',
  'mode',
  'lecturerCode',
  'day',
  'slots',
  'room',
  'admissionYear',
  'systemCode',
  'capacity',
  'startDate',
  'endDate',
  'cadence',
]

/** Uppercase, strip diacritics and punctuation so `Mã MH`, `MÃ MH.` and `ma mh` all match. */
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('result' in record) return cellText(record.result)
    if ('richText' in record && Array.isArray(record.richText))
      return (record.richText as { text?: string }[]).map((part) => part.text ?? '').join('')
    if ('text' in record) return String(record.text).trim()
    return ''
  }
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value.toString().trim()
  return ''
}

/** The school template has title rows above the header; find the first row that names the course column. */
function findHeaderRow(rows: ExcelJS.Row[]): number | null {
  for (let index = 0; index < Math.min(rows.length, 15); index++) {
    const cells = rows[index]!.values as unknown[]
    const normalized = cells.map((cell) => normalizeHeader(cellText(cell)))
    if (normalized.includes(normalizeHeader(COLUMNS.courseCode.aliases[0]!))) return index + 1
  }
  return null
}

function mapColumns(rows: ExcelJS.Row[], headerRow: number) {
  const headerCells = rows[headerRow - 1]!.values as unknown[]
  const lastIndex = headerCells.length - 1
  const mapping = new Map<ColumnKey, number>()
  for (const [key, spec] of Object.entries(COLUMNS) as [ColumnKey, ColumnSpec][]) {
    for (let index = 1; index < headerCells.length; index++) {
      const actual = normalizeHeader(cellText(headerCells[index]))
      const expected = spec.aliases.map(normalizeHeader)
      const matches =
        key === 'language' ? index === lastIndex && actual === '' : expected.includes(actual)
      if (matches) {
        mapping.set(key, index)
        break
      }
    }
  }
  return mapping
}

/** Parse the school's .xlsx template into raw row values. No business rules live here. */
export async function parseWorkbook(
  input: ArrayBuffer | Uint8Array | Buffer,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(input as never)

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return {
      rows: [],
      issues: [
        {
          row: 1,
          column: 'FILE',
          code: 'EMPTY_WORKBOOK',
          message: 'Tệp Excel không có trang tính nào.',
        },
      ],
    }
  }

  const rows: ExcelJS.Row[] = []
  sheet.eachRow((row) => rows.push(row))
  const headerRow = findHeaderRow(rows)
  if (headerRow === null) {
    return {
      rows: [],
      issues: [
        {
          row: 1,
          column: 'MÃ MH',
          code: 'HEADER_NOT_FOUND',
          message: 'Không tìm thấy dòng tiêu đề có cột MÃ MH theo mẫu của trường.',
        },
      ],
    }
  }

  const mapping = mapColumns(rows, headerRow)
  const missing = REQUIRED.filter((key) => !mapping.has(key)).map((key) => COLUMNS[key].label)
  const issues: ImportIssue[] =
    missing.length === 0
      ? []
      : [
          {
            row: headerRow,
            column: missing[0]!,
            code: 'MISSING_COLUMN',
            message: `Thiếu cột bắt buộc trong tệp: ${missing.join(', ')}.`,
          },
        ]

  const parsed: RawRow[] = []
  for (const row of rows.slice(headerRow)) {
    const values: Partial<Record<ColumnKey, unknown>> = {}
    for (const [key, index] of mapping) {
      const cell = row.getCell(index)
      values[key] = cell.value ?? undefined
    }
    if (!cellText(values.courseCode) && !cellText(values.classCode)) continue
    parsed.push({ excelRow: row.number, values })
  }

  return { rows: parsed, issues }
}

export function rawText(row: RawRow, key: ColumnKey): string {
  return cellText(row.values[key])
}

export function columnLabel(key: ColumnKey): string {
  return COLUMNS[key].label
}
