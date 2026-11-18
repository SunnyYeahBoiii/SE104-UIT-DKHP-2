import { HttpException } from '@nestjs/common'

export type CounterPaymentInput = {
  studentCode: string
  termCode: string
  amount: number
  note: string | null
}

function invalid(code: string, message: string, field: string): never {
  throw new HttpException({ code, message, field }, 400)
}

export function counterPaymentInput(body: unknown): CounterPaymentInput {
  const value = body as Record<string, unknown> | null
  const studentCode = value?.studentCode
  const termCode = value?.termCode
  const amount = value?.amount
  const note = value?.note
  if (typeof studentCode !== 'string' || !/^\d{6,12}$/.test(studentCode))
    invalid('INVALID_STUDENT_CODE', 'Mã số sinh viên không hợp lệ.', 'studentCode')
  if (typeof termCode !== 'string' || !/^\d{5}$/.test(termCode))
    invalid('INVALID_TERM_CODE', 'Học kỳ không hợp lệ.', 'termCode')
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0)
    invalid('INVALID_MONEY', 'Số tiền thu phải là số nguyên đồng lớn hơn 0.', 'amount')
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 255))
    invalid('INVALID_NOTE', 'Ghi chú không được quá 255 ký tự.', 'note')
  return { studentCode, termCode, amount, note: typeof note === 'string' ? note.trim() : null }
}
