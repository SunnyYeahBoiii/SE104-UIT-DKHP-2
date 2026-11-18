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

export type ReconciliationRunDetail = ReconciliationRunSummary & {
  note: string
  backfilled: {
    transactionId: number
    sepayId: string
    amount: number
    transactionDate: string
    code: string | null
    receiptNumber: string | null
    studentCode: string | null
    studentName: string | null
  }[]
  discrepancies: {
    id: number
    type: 'MISSING_AT_BANK' | 'AMOUNT_MISMATCH'
    typeLabel: string
    sepayId: string | null
    bankAmount: number | null
    systemAmount: number | null
    detail: string | null
  }[]
}

export type ReconciliationList = {
  items: ReconciliationRunSummary[]
  count: number
}

export const reconciliationNote =
  'Đối soát chạy tự động hằng ngày. Giao dịch webhook bỏ sót được tự ghi bù. Chỗ lệch còn lại chỉ để xem, xử lý ngoài hệ thống.'

export function displayDay(iso: string): string {
  const parts = iso.slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
}
