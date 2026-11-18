export type Bm7 = {
  grossAmount: number
  discountAmount: number
  netAmount: number
  paidAmount: number
  outstandingAmount: number
}

export type LedgerEntryType =
  | 'BASE_TUITION'
  | 'BASE_TUITION_REVERSAL'
  | 'SURCHARGE'
  | 'SURCHARGE_REVERSAL'
  | 'DISCOUNT'
  | 'DISCOUNT_REVERSAL'
  | 'PAYMENT'
  | 'BALANCE_CARRY_OUT'
  | 'BALANCE_CARRY_IN'

export type LedgerRow = {
  id: number
  date: string
  label: string
  detail: string | null
  amount: number
  type: LedgerEntryType
  receiptId: number | null
  receiptNumber: string | null
  group: string | null
}

export type TuitionTermOption = {
  code: string
  name: string
  type: 'FIRST' | 'SECOND' | 'SUMMER'
  tuitionDeadline: string
  outstandingAmount: number
}

export type TuitionOverview = {
  student: {
    studentCode: string
    fullName: string
    email: string | null
    cohortCode: string
    trainingSystemCode: string
  }
  terms: TuitionTermOption[]
  selected: {
    code: string
    name: string
    type: 'FIRST' | 'SECOND' | 'SUMMER'
    phase: string
    tuitionDeadline: string
    paymentCode: string
    bm7: Bm7
    priority: { name: string; rate: number } | null
    ledger: LedgerRow[]
    payment: { gateway: string; accountNumber: string; accountName: string }
  } | null
}

export type QrPayment = { gateway: string; accountNumber: string; accountName: string }

export function tuitionQrPayload(payment: QrPayment, amount: number, paymentCode: string): string {
  return `${payment.gateway}|${payment.accountNumber}|${payment.accountName}|${amount}|${paymentCode}`
}

export type TuitionStatus = 'OVERDUE' | 'OUTSTANDING' | 'SETTLED' | 'CREDIT'

export const money = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`

export const signedMoney = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`

export const dateTime = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))

/** A.3.5/B.4.4: status drives the colour and the banner, not a separately stored flag. */
export function tuitionStatus(bm7: Bm7, tuitionDeadline: string, now: number): TuitionStatus {
  if (bm7.outstandingAmount < 0) return 'CREDIT'
  if (bm7.outstandingAmount === 0) return 'SETTLED'
  return now > Date.parse(tuitionDeadline) ? 'OVERDUE' : 'OUTSTANDING'
}

/** A.4: group recalculation reversals under one heading, keep the rest as individual rows. */
export function groupLedger(rows: LedgerRow[]): { title: string | null; rows: LedgerRow[] }[] {
  const groups: { title: string | null; rows: LedgerRow[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.title === row.group) last.rows.push(row)
    else groups.push({ title: row.group, rows: [row] })
  }
  return groups
}
