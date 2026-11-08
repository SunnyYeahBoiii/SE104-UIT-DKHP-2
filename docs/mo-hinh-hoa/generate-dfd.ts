/**
 * Sinh sơ đồ luồng dữ liệu (SVG) cho so-do-luong-du-lieu.md và thay-doi-qui-dinh.md, theo mẫu "Hướng dẫn mô
 * hình hoá yêu cầu": luồng có dữ liệu vẽ nét liền màu đen, luồng "Không có" vẽ nét chấm màu đỏ sẫm.
 * Chạy: `bun docs/mo-hinh-hoa/generate-dfd.ts`
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Flow = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6'

interface Diagram {
  file: string
  /** Tên xử lý, mỗi phần tử là một dòng trong hình ellipse. */
  process: string[]
  /** Các luồng có dữ liệu. Luồng không liệt kê là "Không có". */
  flows: Flow[]
  /** Tác nhân ở ô trên cùng, mặc định "Người dùng". */
  actor?: string
}

const LIST: Flow[] = ['D1', 'D3', 'D4', 'D5']
const VALUE: Flow[] = ['D1', 'D3', 'D4']
const LOOKUP: Flow[] = ['D1', 'D3', 'D6']
const PRINT: Flow[] = ['D1', 'D3', 'D5', 'D6']
const WRITE_SHOW: Flow[] = ['D1', 'D3', 'D4', 'D6']
const TIMER = 'Bộ định thời'
const QUEUE = 'Hàng đợi'
const SEPAY = 'SePay'

/** Các luồng người dùng và tác vụ tự động (so-do-luong-du-lieu.md). */
const USER_FLOWS: Diagram[] = [
  { file: '01-dang-nhap.svg', process: ['Đăng nhập'], flows: WRITE_SHOW },
  { file: '02-doi-mat-khau.svg', process: ['Đổi mật khẩu'], flows: VALUE },
  { file: '03-tra-cuu-lop.svg', process: ['Tra cứu', 'lớp học phần mở'], flows: LOOKUP },
  { file: '04-dang-ky-lop.svg', process: ['Đăng ký', 'lớp học phần'], flows: WRITE_SHOW },
  { file: '05-huy-lop.svg', process: ['Huỷ lớp học phần'], flows: WRITE_SHOW },
  { file: '06-phieu-dang-ky.svg', process: ['Xem, in phiếu đăng ký', 'và thời khoá biểu'], flows: PRINT },
  { file: '07-cong-no-qr.svg', process: ['Xem công nợ', 'và mã QR học phí'], flows: LOOKUP },
  { file: '08-phieu-thu.svg', process: ['Xem, in phiếu thu'], flows: PRINT },
  { file: '09-lap-ho-so.svg', process: ['Lập hồ sơ', 'sinh viên'], flows: WRITE_SHOW },
  { file: '10-cap-nhat-ho-so.svg', process: ['Cập nhật hồ sơ,', 'tính lại học phí'], flows: VALUE },
  { file: '11-xoa-ho-so.svg', process: ['Xoá hồ sơ', 'sinh viên'], flows: VALUE },
  { file: '12-dat-lai-mat-khau.svg', process: ['Đặt lại mật khẩu', 'sinh viên'], flows: WRITE_SHOW },
  { file: '13-khoa-tuyen-sinh.svg', process: ['Quản lý', 'khoá tuyển sinh'], flows: VALUE },
  { file: '14-moc-hoc-ky.svg', process: ['Cập nhật mốc', 'thời gian học kỳ'], flows: VALUE },
  { file: '15-khung-gio.svg', process: ['Quản lý', 'khung giờ đăng ký'], flows: VALUE },
  { file: '16-nhap-tkb.svg', process: ['Nhập thời khoá biểu', 'học kỳ'], flows: ['D1', 'D2', 'D3', 'D4', 'D6'] },
  { file: '17-dieu-chinh-lop.svg', process: ['Điều chỉnh', 'lớp học phần'], flows: WRITE_SHOW },
  { file: '18-danh-sach-lop.svg', process: ['Xem danh sách', 'sinh viên của lớp'], flows: PRINT },
  { file: '19-thu-tai-quay.svg', process: ['Lập phiếu thu', 'tại quầy'], flows: LIST },
  { file: '20-gan-giao-dich.svg', process: ['Gán giao dịch', 'chưa khớp'], flows: VALUE },
  { file: '21-bao-cao-bm7.svg', process: ['Lập báo cáo SV', 'chưa đóng học phí'], flows: PRINT },
  { file: '22-chuyen-giai-doan.svg', process: ['Chuyển giai đoạn,', 'ghi nợ học phí cố định'], flows: VALUE, actor: TIMER },
  { file: '23-chot-phieu.svg', process: ['Chốt phiếu', 'đăng ký'], flows: VALUE, actor: TIMER },
  { file: '24-webhook.svg', process: ['Nhận giao dịch', 'chuyển khoản'], flows: WRITE_SHOW, actor: SEPAY },
  { file: '25-ghi-nhan-chuyen-khoan.svg', process: ['Ghi nhận thanh toán', 'chuyển khoản'], flows: VALUE, actor: QUEUE },
  { file: '26-doi-soat.svg', process: ['Đối soát', 'giao dịch'], flows: VALUE, actor: SEPAY },
  { file: '27-dang-ky-co-dieu-kien.svg', process: ['Xử lý đăng ký', 'có điều kiện'], flows: VALUE, actor: TIMER },
  { file: '28-email-dong-du.svg', process: ['Gửi email', 'đóng đủ học phí'], flows: LIST, actor: QUEUE },
]

/** Các yêu cầu thay đổi qui định (thay-doi-qui-dinh.md). */
const REGULATIONS: Diagram[] = [
  { file: 'qd-01-doi-tuong-uu-tien.svg', process: ['Nhập danh sách', 'Đối tượng ưu tiên'], flows: LIST },
  { file: 'qd-02-tin-chi-mon-mo.svg', process: ['Thay đổi tín chỉ', 'của môn mở'], flows: VALUE },
  { file: 'qd-03-don-gia-mac-dinh.svg', process: ['Thay đổi đơn giá', 'tín chỉ mặc định'], flows: VALUE },
  { file: 'qd-04-bang-phi.svg', process: ['Thay đổi bảng phí'], flows: LIST },
  { file: 'qd-05-han-dong-hoc-phi.svg', process: ['Thay đổi hạn đóng', 'học phí'], flows: VALUE },
  { file: 'qd-06-gioi-han-tin-chi.svg', process: ['Thay đổi giới hạn', 'tín chỉ'], flows: VALUE },
  { file: 'qd-07-tai-khoan-nhan.svg', process: ['Thay đổi tài khoản', 'nhận học phí'], flows: VALUE },
]

const DIAGRAMS = [...USER_FLOWS, ...REGULATIONS]


const W = 680
const H = 320
const CX = 340
const CY = 150
const RX = 180
const RY = 42
const BLUE = '#1f5fbf'
const GREEN = '#33e033'
const RED = '#8b0a3a'
const FONT = "'Times New Roman', Times, serif"

function arrow(used: boolean, x1: number, y1: number, x2: number, y2: number) {
  const color = used ? '#000' : RED
  const dash = used ? '' : ' stroke-dasharray="3 3"'
  const marker = used ? 'url(#solid)' : 'url(#dotted)'
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5"${dash} marker-end="${marker}"/>`
}

function label(id: Flow, used: boolean, x: number, y: number) {
  return `<text x="${x}" y="${y}" font-size="15" font-weight="bold" fill="${used ? '#000' : RED}">${id}</text>`
}

function box(text: string, x: number, y: number, w: number) {
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="38" fill="${BLUE}" stroke="#7aa7e6" stroke-width="2"/>`,
    `<text x="${x + w / 2}" y="${y + 27}" font-size="22" fill="#fff" text-anchor="middle">${text}</text>`,
  ].join('\n  ')
}

function render(d: Diagram) {
  const has = (f: Flow) => d.flows.includes(f)
  const actor = d.actor ?? 'Người dùng'
  const actorWidth = Math.max(150, actor.length * 12 + 30)
  const lineHeight = 26
  const firstLine = CY + 8 - ((d.process.length - 1) * lineHeight) / 2
  const processText = d.process
    .map(
      (line, i) =>
        `<text x="${CX}" y="${firstLine + i * lineHeight}" font-size="22" fill="#fff" text-anchor="middle">${line}</text>`,
    )
    .join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
  <defs>
    <marker id="solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#000"/>
    </marker>
    <marker id="dotted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${RED}"/>
    </marker>
  </defs>
  <rect width="${W}" height="${H}" fill="#fff"/>
  ${box(actor, CX - actorWidth / 2, 10, actorWidth)}
  ${arrow(has('D1'), CX - 20, 48, CX - 20, CY - RY - 2)}
  ${label('D1', has('D1'), CX - 48, 80)}
  ${arrow(has('D6'), CX + 20, CY - RY - 2, CX + 20, 50)}
  ${label('D6', has('D6'), CX + 28, 80)}
  ${box('Tb nhập', 10, CY - 19, 108)}
  ${arrow(has('D2'), 120, CY, CX - RX - 2, CY)}
  ${label('D2', has('D2'), 126, CY - 10)}
  <ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}" fill="${GREEN}"/>
  ${processText}
  ${arrow(has('D5'), CX + RX + 2, CY, W - 120, CY)}
  ${label('D5', has('D5'), CX + RX + 10, CY - 10)}
  ${box('Tb xuất', W - 118, CY - 19, 108)}
  ${arrow(has('D3'), CX - 20, 252, CX - 20, CY + RY + 2)}
  ${label('D3', has('D3'), CX - 48, 225)}
  ${arrow(has('D4'), CX + 20, CY + RY + 2, CX + 20, 250)}
  ${label('D4', has('D4'), CX + 28, 225)}
  <line x1="${CX - 120}" y1="256" x2="${CX + 120}" y2="256" stroke="${BLUE}" stroke-width="1.5"/>
  <text x="${CX}" y="284" font-size="22" fill="${BLUE}" text-anchor="middle">Bộ nhớ</text>
  <line x1="${CX - 120}" y1="296" x2="${CX + 120}" y2="296" stroke="${BLUE}" stroke-width="1.5"/>
</svg>
`
}

const outDir = join(import.meta.dir, 'dfd')
mkdirSync(outDir, { recursive: true })
for (const d of DIAGRAMS) writeFileSync(join(outDir, d.file), render(d))
console.log(`Wrote ${DIAGRAMS.length} diagrams to ${outDir}`)
