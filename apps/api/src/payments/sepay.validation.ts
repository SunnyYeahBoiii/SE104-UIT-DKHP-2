import { HttpException } from '@nestjs/common'

export const SEPAY_API_KEY_PARAMETER = 'payment.sepayApiKey'
export const SEPAY_API_KEY = 'dkhp-sepay-dev-key'

export type SepayPayload = {
  sepayId: bigint
  gateway: string
  accountNumber: string
  transactionDate: Date
  code: string | null
  content: string
  referenceCode: string | null
  transferType: string
  amount: bigint
  raw: Record<string, unknown>
}

function invalid(code: string, message: string, field: string): never {
  throw new HttpException({ code, message, field }, 400)
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value.trim() : null)

export function parseTransactionDate(value: unknown): Date {
  if (typeof value !== 'string')
    invalid('INVALID_TRANSACTION_DATE', 'Thời điểm giao dịch không hợp lệ.', 'transactionDate')
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value.trim())
  const parsed = new Date(match ? `${match[1]}T${match[2]}+07:00` : value.trim())
  if (Number.isNaN(parsed.getTime()))
    invalid('INVALID_TRANSACTION_DATE', 'Thời điểm giao dịch không hợp lệ.', 'transactionDate')
  return parsed
}

export function sepayPayload(body: unknown): SepayPayload {
  const value = body as Record<string, unknown> | null
  if (!value || typeof value !== 'object')
    invalid('INVALID_PAYLOAD', 'Dữ liệu webhook không hợp lệ.', 'body')

  const id = value.id ?? value.sepayId
  if ((typeof id !== 'number' && typeof id !== 'string') || !/^\d+$/.test(String(id).trim()))
    invalid('INVALID_PAYLOAD', 'Mã giao dịch SePay là bắt buộc.', 'id')
  const sepayId = BigInt(String(id).trim())
  const gateway = text(value.gateway)
  const accountNumber = text(value.accountNumber)
  const content = text(value.content) ?? ''
  const transferType = text(value.transferType)
  const referenceCode = text(value.referenceCode)
  const amount = value.transferAmount ?? value.amount
  if (!gateway || !accountNumber)
    invalid('INVALID_PAYLOAD', 'Thông tin tài khoản không hợp lệ.', 'accountNumber')
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0)
    invalid('INVALID_MONEY', 'Số tiền chuyển khoản không hợp lệ.', 'transferAmount')
  if (!transferType) invalid('INVALID_PAYLOAD', 'Loại giao dịch là bắt buộc.', 'transferType')

  return {
    sepayId,
    gateway,
    accountNumber,
    transactionDate: parseTransactionDate(value.transactionDate),
    code: text(value.code),
    content,
    referenceCode,
    transferType,
    amount: BigInt(amount),
    raw: value,
  }
}

export function parsePaymentCode(
  code: string | null,
): { studentCode: string; termCode: string } | null {
  const value = (code ?? '').trim().toUpperCase()
  const direct = /^HP(\d{6,12})(\d{5})$/.exec(value)
  if (direct) return { studentCode: direct[1]!, termCode: direct[2]! }
  const embedded = /(?:^|[^A-Z0-9])(HP\d{11,17})(?![A-Z0-9])/.exec(value)
  if (!embedded) return null
  const digits = embedded[1]!.slice(2)
  return { studentCode: digits.slice(0, -5), termCode: digits.slice(-5) }
}

export function verifyApiKey(header: string | undefined, expected: string): boolean {
  if (!header) return false
  const match = /^Apikey\s+(.+)$/.exec(header.trim())
  if (!match) return false
  const supplied = match[1]!.trim()
  if (supplied.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < supplied.length; index++)
    difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0
}
