import type { ReconciliationDiscrepancyType } from '../generated/prisma/client'

export type ReconciliationRunSummary = {
  id: number
  date: string
  bankCount: number
  systemCount: number
  backfilledCount: number
  residualCount: number
  status: 'MATCHED' | 'HAS_DIFFERENCES'
  statusLabel: string
  createdAt: string
}

export type ReconciliationBackfill = {
  transactionId: number
  sepayId: string
  amount: number
  transactionDate: string
  code: string | null
  receiptNumber: string | null
  studentCode: string | null
  studentName: string | null
}

export type ReconciliationDiscrepancyView = {
  id: number
  type: ReconciliationDiscrepancyType
  typeLabel: string
  sepayId: string | null
  bankAmount: number | null
  systemAmount: number | null
  detail: string | null
}

export type ReconciliationRunDetail = ReconciliationRunSummary & {
  note: string
  backfilled: ReconciliationBackfill[]
  discrepancies: ReconciliationDiscrepancyView[]
}

export const RECONCILIATION_NOTE =
  'Đối soát chạy tự động hằng ngày. Giao dịch webhook bỏ sót được tự ghi bù. Chỗ lệch còn lại chỉ để xem, xử lý ngoài hệ thống.'

export const discrepancyLabels: Record<ReconciliationDiscrepancyType, string> = {
  MISSING_AT_BANK: 'Có trong hệ thống nhưng không thấy ở ngân hàng',
  AMOUNT_MISMATCH: 'Lệch số tiền',
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The Vietnam calendar day containing `at`, as a UTC-midnight date plus its UTC half-open range. */
export function vietnamDay(at: Date): { date: Date; from: Date; to: Date; label: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  const year = part('year')
  const month = part('month')
  const day = part('day')
  return {
    date: new Date(Date.UTC(year, month - 1, day)),
    from: new Date(Date.UTC(year, month - 1, day, -7)),
    to: new Date(Date.UTC(year, month - 1, day + 1, -7)),
    label: `${year}-${pad(month)}-${pad(day)}`,
  }
}

/** The daily job runs just after midnight and reconciles the day that just ended. */
export function previousVietnamDay(at: Date): Date {
  return new Date(at.getTime() - 86_400_000)
}
