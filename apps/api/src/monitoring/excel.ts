import ExcelJS from 'exceljs'

export const ROSTER_HEADERS = [
  'STT',
  'MSSV',
  'Họ tên',
  'Khoá',
  'Hệ đào tạo',
  'Hình thức học',
  'Trạng thái dòng',
] as const

export const UNDER_CREDIT_HEADERS = ['STT', 'MSSV', 'Họ tên', 'Khoá', 'Tổng tín chỉ'] as const

export type RosterExportRow = {
  stt: number
  studentCode: string
  fullName: string
  cohortCode: string
  systemCode: string
  attemptType: string
  status: string
}

export type UnderCreditExportRow = {
  stt: number
  studentCode: string
  fullName: string
  cohortCode: string
  credits: number
}

function workbook(headers: readonly string[], rows: (string | number)[][]): ExcelJS.Workbook {
  const book = new ExcelJS.Workbook()
  book.creator = 'Phòng Đào tạo'
  const sheet = book.addWorksheet('Danh sách')
  sheet.addRow([...headers])
  for (const row of rows) sheet.addRow(row)
  sheet.getRow(1).font = { bold: true }
  sheet.columns = headers.map((header) => ({ width: Math.max(12, header.length + 4) }))
  return book
}

/** NFR-12: BB01 and the post-finalization credit warning are real .xlsx files, not CSV renames. */
export async function rosterExcel(rows: RosterExportRow[]): Promise<Buffer> {
  const book = workbook(
    ROSTER_HEADERS,
    rows.map((row) => [
      row.stt,
      row.studentCode,
      row.fullName,
      row.cohortCode,
      row.systemCode,
      row.attemptType,
      row.status,
    ]),
  )
  return Buffer.from(await book.xlsx.writeBuffer())
}

export async function underCreditExcel(rows: UnderCreditExportRow[]): Promise<Buffer> {
  const book = workbook(
    UNDER_CREDIT_HEADERS,
    rows.map((row) => [row.stt, row.studentCode, row.fullName, row.cohortCode, row.credits]),
  )
  return Buffer.from(await book.xlsx.writeBuffer())
}
