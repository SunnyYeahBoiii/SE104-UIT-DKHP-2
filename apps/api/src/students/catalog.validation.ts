import { HttpException } from '@nestjs/common'

export type PriorityGroupInput = {
  code: string
  name: string
  discountRate: number
  priority: number
}

export type CohortInput = {
  code: string
  admissionYear: number
}

function invalid(code: string, message: string, field: string): never {
  throw new HttpException({ code, message, field }, 400)
}

function requiredText(body: Record<string, unknown> | null, key: string, label: string): string {
  const value = body?.[key]
  if (typeof value !== 'string' || value.trim() === '')
    invalid('INVALID_REQUEST', `${label} là bắt buộc.`, key)
  return value.trim()
}

/** HS-02: the discount rate is an integer percentage in [0, 100]; priority is an integer rank. */
export function priorityGroupInput(body: unknown): PriorityGroupInput {
  const value = body as Record<string, unknown> | null
  const code = requiredText(value, 'code', 'Mã đối tượng')
  const name = requiredText(value, 'name', 'Tên đối tượng')
  const { discountRate, priority } = value ?? {}

  if (
    typeof discountRate !== 'number' ||
    !Number.isInteger(discountRate) ||
    discountRate < 0 ||
    discountRate > 100
  )
    invalid('INVALID_DISCOUNT_RATE', 'Tỉ lệ giảm phải là số nguyên từ 0 đến 100.', 'discountRate')
  if (typeof priority !== 'number' || !Number.isInteger(priority))
    invalid('INVALID_PRIORITY', 'Độ ưu tiên phải là số nguyên.', 'priority')

  return { code, name, discountRate, priority }
}

/** HS-15: a cohort is a code plus the year its students were admitted. */
export function cohortInput(body: unknown): CohortInput {
  const value = body as Record<string, unknown> | null
  const code = requiredText(value, 'code', 'Mã khoá')
  const { admissionYear } = value ?? {}
  if (typeof admissionYear !== 'number' || !Number.isInteger(admissionYear))
    invalid('INVALID_ADMISSION_YEAR', 'Năm nhập học phải là số nguyên.', 'admissionYear')
  return { code, admissionYear }
}
