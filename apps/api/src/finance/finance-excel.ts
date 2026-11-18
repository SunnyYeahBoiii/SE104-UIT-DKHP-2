import ExcelJS from 'exceljs'

import { type Bm7Report } from './finance-report.service'

const HEADERS = [
  'STT',
  'MSSV',
  'Họ tên',
  'Khoá',
  'Hệ đào tạo',
  'Đối tượng ưu tiên',
  'Số tiền đăng ký',
  'Số tiền phải đóng',
  'Số tiền còn lại',
] as const

/** NFR-12: a real .xlsx, A4 landscape, with the BM7 column header repeated on every printed page. */
export async function bm7Excel(report: Bm7Report): Promise<Buffer> {
  const book = new ExcelJS.Workbook()
  book.creator = 'Phòng Tài vụ'
  const sheet = book.addWorksheet('BM7', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  })
  sheet.pageSetup.printTitlesRow = '5:5'
  sheet.pageSetup.printArea = `A1:I${6 + report.rows.length + 4}`

  sheet.mergeCells('A1:I1')
  sheet.getCell('A1').value = 'BÁO CÁO SINH VIÊN CHƯA HOÀN THÀNH HỌC PHÍ'
  sheet.getCell('A1').font = { bold: true, size: 16 }
  sheet.getCell('A1').alignment = { horizontal: 'center' }
  sheet.mergeCells('A2:I2')
  sheet.getCell('A2').value =
    `Học kỳ ${report.term.name} (${report.term.code}) · Ngày lập ${new Date(report.generatedAt).toLocaleDateString('vi-VN')} · Người lập ${report.maker}`
  sheet.getCell('A2').alignment = { horizontal: 'center' }

  const header = sheet.getRow(5)
  header.values = [...HEADERS]
  header.font = { bold: true }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6FF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  report.rows.forEach((row, index) => {
    sheet.getRow(6 + index).values = [
      row.stt,
      row.studentCode,
      row.fullName,
      row.cohortCode,
      row.systemCode,
      row.priorityName ?? '',
      row.grossAmount,
      row.netAmount,
      row.outstandingAmount,
    ]
  })
  const totalRow = sheet.getRow(6 + report.rows.length)
  totalRow.values = [
    '',
    '',
    'TỔNG',
    '',
    '',
    '',
    report.totals.grossAmount,
    report.totals.netAmount,
    report.totals.outstandingAmount,
  ]
  totalRow.font = { bold: true }
  sheet.getRow(8 + report.rows.length).values = [report.note]
  sheet.getRow(9 + report.rows.length).values = ['Người lập', '', '', '', '', '', 'Trưởng phòng']

  sheet.columns = [
    { width: 6 },
    { width: 12 },
    { width: 28 },
    { width: 9 },
    { width: 14 },
    { width: 24 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
  ]
  for (let row = 6; row <= 6 + report.rows.length; row++) {
    for (const column of [7, 8, 9]) sheet.getRow(row).getCell(column).numFmt = '#,##0'
  }

  return Buffer.from(await book.xlsx.writeBuffer())
}
