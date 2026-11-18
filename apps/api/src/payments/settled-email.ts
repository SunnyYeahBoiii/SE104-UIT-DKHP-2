export const TUITION_SETTLED = 'TUITION_SETTLED'

export type SettledPayload = {
  studentCode: string
  studentName: string
  email: string | null
  termCode: string
  termName: string
  netAmount: number
  paidAmount: number
  creditBalance: number
  receiptNumber: string
}

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const vnd = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`

/** B.4.7: a 600px HTML email that still reads with images blocked. */
export function renderSettledEmail(payload: SettledPayload) {
  const credit =
    payload.creditBalance > 0
      ? `<tr><td>Số dư có (tự trừ học kỳ sau)</td><td align="right"><strong>${vnd(payload.creditBalance)}</strong></td></tr>`
      : ''
  return {
    to: payload.email ?? '',
    subject: `Bạn đã đóng đủ học phí ${payload.termName}`,
    html: `<div style="background:#F7F9FD;padding:24px;font-family:Arial,sans-serif;color:#323B52">
  <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;width:600px">
    <tr><td style="padding:20px 24px;background:#152F70;color:#fff;font-size:20px;font-weight:bold">UIT · Trường Đại học Công nghệ Thông tin</td></tr>
    <tr><td style="padding:24px">
      <h1 style="font-size:20px;color:#152F70">Bạn đã đóng đủ học phí ${escape(payload.termName)}</h1>
      <p>${escape(payload.studentName)} · MSSV <strong>${escape(payload.studentCode)}</strong></p>
      <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #E6EBF5">
        <tr><td>Học kỳ</td><td align="right">${escape(payload.termName)} (${escape(payload.termCode)})</td></tr>
        <tr><td>Số tiền phải đóng</td><td align="right">${vnd(payload.netAmount)}</td></tr>
        <tr><td>Tổng đã thanh toán</td><td align="right">${vnd(payload.paidAmount)}</td></tr>
        ${credit}
        <tr><td>Phiếu thu mới nhất</td><td align="right"><strong>${escape(payload.receiptNumber)}</strong></td></tr>
      </table>
      <p style="margin:24px 0"><a href="/student/tuition" style="background:#1A56E8;color:#fff;padding:12px 18px;text-decoration:none">Xem học phí</a></p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#F1F4FA;color:#5B6680;font-size:12px">Đây là email tự động, vui lòng không trả lời.</td></tr>
  </table>
</div>`,
  }
}
