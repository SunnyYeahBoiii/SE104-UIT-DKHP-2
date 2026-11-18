export type PaymentChannel = 'COUNTER' | 'BANK_TRANSFER'

export type Bm7 = {
  grossAmount: number
  discountAmount: number
  netAmount: number
  paidAmount: number
  outstandingAmount: number
}

export type ReceiptDetail = {
  id: number
  number: string
  studentCode: string
  studentName: string
  cohortCode: string
  trainingSystemCode: string
  termCode: string
  termName: string
  channel: PaymentChannel
  amount: number
  amountInWords: string
  paidAt: string
  collector: string | null
  note: string | null
}

export type CounterDebt = {
  code: string
  name: string
  outstandingAmount: number
  netAmount: number
  paidAmount: number
  tuitionDeadline: string
  phase: string
}

export type CounterStudent = {
  studentCode: string
  fullName: string
  email: string | null
  cohortCode: string
  trainingSystemCode: string
  priority: { name: string; rate: number } | null
  debts: CounterDebt[]
  defaultTermCode: string | null
}

export type PaymentResult = {
  receipt: ReceiptDetail
  before: Bm7
  after: Bm7
  settled: boolean
  creditBalance: number
}

export type ShiftReceipts = { receipts: ReceiptDetail[]; totalAmount: number }

export const money = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`

export const dateTime = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))

/** HP-11/TT-06: a payment above the outstanding amount becomes a credit balance, never a refund. */
export const remainingAfter = (outstanding: number, paid: number): number => outstanding - paid

export const channelLabel = (channel: PaymentChannel): string =>
  channel === 'COUNTER' ? 'Tại quầy' : 'Chuyển khoản'

const ONES = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']

function belowHundred(value: number): string {
  const tens = Math.floor(value / 10)
  const ones = value % 10
  if (tens === 0) return ONES[ones]!
  const ten = tens === 1 ? 'mười' : `${ONES[tens]} mươi`
  if (ones === 0) return ten
  const last =
    ones === 5
      ? 'lăm'
      : ones === 1 && tens > 1
        ? 'mốt'
        : ones === 4 && tens > 1
          ? 'tư'
          : ONES[ones]!
  return `${ten} ${last}`
}

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  if (hundreds === 0) return belowHundred(rest)
  return rest === 0 ? `${ONES[hundreds]} trăm` : `${ONES[hundreds]} trăm ${belowHundred(rest)}`
}

/** The dialog needs the words before the API can issue a receipt (D.4.2). */
export function amountInWords(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) return ''
  if (amount === 0) return 'Không đồng'
  const parts: string[] = []
  let rest = amount
  let scale = 0
  while (rest > 0) {
    const group = rest % 1000
    if (group > 0) parts.unshift(`${belowThousand(group)} ${SCALES[scale] ?? 'tỷ'}`.trim())
    rest = Math.floor(rest / 1000)
    scale++
  }
  const words = parts.join(' ')
  return `${words[0]!.toUpperCase()}${words.slice(1)} đồng${amount % 1000 === 0 ? ' chẵn' : ''}`
}
