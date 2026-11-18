import { HttpException } from '@nestjs/common'

export type AssignInput = { studentCode: string; termCode: string }

function invalid(code: string, message: string, field: string): never {
  throw new HttpException({ code, message, field }, 400)
}

/** TT-07: a transfer may only be assigned to an existing MSSV/term pair. */
export function assignInput(body: unknown): AssignInput {
  const value = body as Record<string, unknown> | null
  const studentCode = value?.studentCode
  const termCode = value?.termCode
  if (typeof studentCode !== 'string' || !/^\d{6,12}$/.test(studentCode))
    invalid('INVALID_STUDENT_CODE', 'Mã số sinh viên không hợp lệ.', 'studentCode')
  if (typeof termCode !== 'string' || !/^\d{5}$/.test(termCode))
    invalid('INVALID_TERM_CODE', 'Học kỳ không hợp lệ.', 'termCode')
  return { studentCode, termCode }
}

export function ignoreReasonInput(body: unknown): string {
  const reason = (body as Record<string, unknown> | null)?.reason
  if (typeof reason !== 'string' || !reason.trim())
    invalid('IGNORE_REASON_REQUIRED', 'Bỏ qua giao dịch bắt buộc phải có lý do.', 'reason')
  if (reason.length > 500)
    invalid('INVALID_IGNORE_REASON', 'Lý do bỏ qua không được quá 500 ký tự.', 'reason')
  return reason.trim()
}

/**
 * D.4.4: prefill the MSSV combobox when the transfer content carries a student-code-like digit run.
 * Also catches an `HP<MSSV><term>` code whose student could not be resolved.
 */
export function suggestedStudentCodes(content: string): string[] {
  const found = new Set<string>()
  for (const match of content.matchAll(/(?<!\d)(\d{8})(?!\d)/g)) found.add(match[1]!)
  for (const match of content.matchAll(/\bHP(\d{8})\d{5}\b/gi)) found.add(match[1]!)
  return [...found].slice(0, 5)
}
