import type { Bm7 } from './receipt'

export type TransactionStatus = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'IGNORED'

export type BankTransactionRow = {
  id: number
  sepayId: string
  gateway: string
  accountNumber: string
  transactionDate: string
  code: string | null
  content: string
  referenceCode: string | null
  amount: number
  status: TransactionStatus
  ignoreReason: string | null
  studentCode: string | null
  studentName: string | null
  termCode: string | null
  termName: string | null
  receiptNumber: string | null
  assignedBy: string | null
  processedAt: string | null
  suggestedStudentCodes: string[]
}

export type TransactionDetail = BankTransactionRow & {
  rawPayload: unknown
  history: {
    action: string
    actorName: string | null
    createdAt: string
    payload: unknown
  }[]
}

export type TransactionList = { items: BankTransactionRow[]; unmatchedCount: number }

export type StudentOption = { studentCode: string; fullName: string; email: string | null }

export type TermOption = { code: string; name: string }

export type DebtPreview = {
  studentCode: string
  studentName: string
  termCode: string
  termName: string
  amount: number
  before: Bm7
  after: Bm7
}

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  PENDING: 'Chờ xử lý',
  MATCHED: 'Đã khớp',
  UNMATCHED: 'Chưa khớp',
  IGNORED: 'Bỏ qua',
}

export const STATUS_CLASS: Record<TransactionStatus, string> = {
  PENDING: 'bg-brand-50 text-brand-700',
  MATCHED: 'bg-success-50 text-success-700',
  UNMATCHED: 'bg-warning-50 text-warning-700',
  IGNORED: 'bg-neutral-100 text-neutral-600',
}

/** D.4.4: codes found in the transfer content are ranked above literal search results. */
export function mergeSuggestions(
  codes: string[],
  query: string,
  options: StudentOption[],
): StudentOption[] {
  const needle = query.trim().toLowerCase()
  const matches = options.filter(
    (option) =>
      !needle ||
      option.studentCode.includes(needle) ||
      option.fullName.toLowerCase().includes(needle),
  )
  matches.sort(
    (a, b) =>
      Number(codes.includes(b.studentCode)) - Number(codes.includes(a.studentCode)) ||
      a.studentCode.localeCompare(b.studentCode),
  )
  const seen = new Set<string>()
  const result: StudentOption[] = []
  for (const option of matches) {
    if (seen.has(option.studentCode)) continue
    seen.add(option.studentCode)
    result.push(option)
    if (result.length === 8) break
  }
  return result
}
