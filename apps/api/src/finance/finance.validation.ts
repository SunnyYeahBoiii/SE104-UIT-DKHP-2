import { HttpException } from '@nestjs/common'

export type FeeScheduleInput = {
  cohortId: number
  trainingSystemId: number
  baseTuition: number
  theoryCreditRate: number
  practiceCreditRate: number
}

export type CreditRateInput = {
  theoryCreditRate: number
  practiceCreditRate: number
}

export type BankAccountInput = {
  gateway: string
  accountNumber: string
  accountName: string
}

function invalid(code: string, message: string, field: string): never {
  throw new HttpException({ code, message, field }, 400)
}

function wholeVnd(body: Record<string, unknown> | null, key: string, label: string): number {
  const value = body?.[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    invalid('INVALID_MONEY', `${label} phải là số nguyên đồng.`, key)
  return value
}

function positiveId(body: Record<string, unknown> | null, key: string, label: string): number {
  const value = body?.[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    invalid('INVALID_REQUEST', `${label} không hợp lệ.`, key)
  return value
}

export function feeScheduleInput(body: unknown): FeeScheduleInput {
  const value = body as Record<string, unknown> | null
  const cohortId = positiveId(value, 'cohortId', 'Khoá tuyển sinh')
  const trainingSystemId = positiveId(value, 'trainingSystemId', 'Hệ đào tạo')
  const baseTuition = wholeVnd(value, 'baseTuition', 'Học phí cố định')
  const theoryCreditRate = wholeVnd(value, 'theoryCreditRate', 'Đơn giá LT')
  const practiceCreditRate = wholeVnd(value, 'practiceCreditRate', 'Đơn giá TH')
  if (baseTuition < 0)
    invalid('INVALID_BASE_TUITION', 'Học phí cố định không được âm.', 'baseTuition')
  if (theoryCreditRate <= 0)
    invalid('INVALID_CREDIT_RATE', 'Đơn giá LT phải lớn hơn 0.', 'theoryCreditRate')
  if (practiceCreditRate <= 0)
    invalid('INVALID_CREDIT_RATE', 'Đơn giá TH phải lớn hơn 0.', 'practiceCreditRate')
  return { cohortId, trainingSystemId, baseTuition, theoryCreditRate, practiceCreditRate }
}

export function creditRateInput(body: unknown): CreditRateInput {
  const value = body as Record<string, unknown> | null
  const theoryCreditRate = wholeVnd(value, 'theoryCreditRate', 'Đơn giá LT')
  const practiceCreditRate = wholeVnd(value, 'practiceCreditRate', 'Đơn giá TH')
  if (theoryCreditRate <= 0 || practiceCreditRate <= 0)
    invalid(
      'INVALID_CREDIT_RATE',
      'Đơn giá tín chỉ phải là số nguyên đồng lớn hơn 0.',
      'theoryCreditRate',
    )
  return { theoryCreditRate, practiceCreditRate }
}

export function bankAccountInput(body: unknown): BankAccountInput {
  const value = body as Record<string, unknown> | null
  const gateway = value?.gateway
  const accountNumber = value?.accountNumber
  const accountName = value?.accountName
  if (typeof gateway !== 'string' || gateway.trim() === '')
    invalid('INVALID_BANK_ACCOUNT', 'Ngân hàng là bắt buộc.', 'gateway')
  if (typeof accountNumber !== 'string' || !/^\d+$/.test(accountNumber))
    invalid('INVALID_BANK_ACCOUNT', 'Số tài khoản chỉ được chứa chữ số.', 'accountNumber')
  if (typeof accountName !== 'string' || accountName.trim() === '')
    invalid('INVALID_BANK_ACCOUNT', 'Tên chủ tài khoản là bắt buộc.', 'accountName')
  return {
    gateway: gateway.trim(),
    accountNumber,
    accountName: accountName.trim().toUpperCase(),
  }
}
