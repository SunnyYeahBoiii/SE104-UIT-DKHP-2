import type { Bm7 } from './tuition'

export type LedgerViewRow = {
  id: number
  at: string
  type: string
  typeLabel: string
  description: string
  detail: string | null
  debit: number
  credit: number
  balance: number
  actor: string
  relatedEntryId: number | null
  receipt: {
    id: number
    number: string
    bankTransactionId: number | null
    bankTransactionCode: string | null
  } | null
  group: string | null
}

export type DebtOverview = {
  student: {
    studentCode: string
    fullName: string
    cohortCode: string
    trainingSystemCode: string
    priority: { name: string; rate: number } | null
  }
  terms: { code: string; name: string; outstandingAmount: number }[]
  totalOutstanding: number
  creditBalance: number
  selected: {
    code: string
    name: string
    phase: string
    tuitionDeadline: string
    bm7: Bm7
    ledger: LedgerViewRow[]
  } | null
  note: string
  ledgerTypes: { type: string; label: string }[]
}

export type ReceiptRow = {
  id: number
  receiptNumber: string
  paidAt: string
  studentCode: string
  fullName: string
  termCode: string
  amount: number
  channel: string
  channelLabel: string
  collector: string | null
  note: string | null
  bankTransactionId: number | null
  bankTransactionCode: string | null
}

export type ReceiptList = { items: ReceiptRow[]; totalAmount: number; count: number }

export type Bm7Row = {
  stt: number
  studentCode: string
  fullName: string
  cohortCode: string
  systemCode: string
  priorityName: string | null
  grossAmount: number
  discountAmount: number
  netAmount: number
  paidAmount: number
  outstandingAmount: number
}

export type Bm7Report = {
  term: { code: string; name: string; type: string; phase: string; tuitionDeadline: string }
  generatedAt: string
  maker: string
  rows: Bm7Row[]
  totals: {
    grossAmount: number
    discountAmount: number
    netAmount: number
    paidAmount: number
    outstandingAmount: number
  }
  note: string
}

export type FinanceTerm = Bm7Report['term']

export type FinanceFilters = {
  terms: FinanceTerm[]
  cohorts: { id: number; code: string; admissionYear: number }[]
  trainingSystems: { id: number; code: string; name: string }[]
  priorityGroups: { id: number; code: string; name: string; discountRate: number }[]
  collectors: { id: number; fullName: string }[]
}

export type FinanceOverview = {
  term: FinanceTerm
  now: string
  stats: {
    mustPay: number
    collected: number
    collectedByChannel: { counter: number; bankTransfer: number }
    remaining: number
    settledCount: number
    studentCount: number
    settledRatio: number
    overdueCount: number
  }
  daily: {
    date: string
    counter: number
    bankTransfer: number
    total: number
    cumulative: number
  }[]
  todos: { key: string; title: string; count: number; detail: string; href: string }[]
}

export const EMPTY_FILTERS: FinanceFilters = {
  terms: [],
  cohorts: [],
  trainingSystems: [],
  priorityGroups: [],
  collectors: [],
}

/** D.4.3: recalculation rows share one heading; all other rows stay individual. */
export function groupDebtLedger(
  rows: LedgerViewRow[],
): { title: string | null; rows: LedgerViewRow[] }[] {
  const groups: { title: string | null; rows: LedgerViewRow[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.title === row.group) last.rows.push(row)
    else groups.push({ title: row.group, rows: [row] })
  }
  return groups
}

/** D.5: split the report into fixed-size pages so every page carries its own header and "Trang x/y". */
export function paginate<T>(rows: T[], perPage: number): T[][] {
  if (perPage <= 0) return rows.length ? [rows] : []
  const pages: T[][] = []
  for (let index = 0; index < rows.length; index += perPage)
    pages.push(rows.slice(index, index + perPage))
  return pages.length ? pages : [[]]
}

export const bm7Query = (values: Record<string, string>): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (value && value !== 'all') params.set(key, value)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const shortDate = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  )

export const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
