import { formatVnDateTime } from '../academics/term-policy'
import type { Bm7 } from './tuition.service'

export const RECALCULATION_PREFIX = 'Tính lại học phí'
export const RECALCULATION_SEPARATOR = ' — '

export type ProfileFacts = {
  cohortId: number
  trainingSystemId: number
  cohortCode: string
  trainingSystemCode: string
  priorityGroupIds: number[]
}

/** HP-12/HS-14: what changed, shown as the reason on the dialog and on the ledger group. */
export function recalculationReason(before: ProfileFacts, after: ProfileFacts): string {
  const parts: string[] = []
  if (before.cohortCode !== after.cohortCode)
    parts.push(`đổi khoá ${before.cohortCode} → ${after.cohortCode}`)
  if (before.trainingSystemCode !== after.trainingSystemCode)
    parts.push(`đổi hệ ${before.trainingSystemCode} → ${after.trainingSystemCode}`)
  const sameGroups =
    before.priorityGroupIds.length === after.priorityGroupIds.length &&
    before.priorityGroupIds.every((id) => after.priorityGroupIds.includes(id))
  if (!sameGroups) parts.push('đổi đối tượng ưu tiên')
  return parts.join(', ')
}

/** HP-01/C.4.3: the exact warning the academic officer sees when the new pair has no fee table. */
export function missingFeeScheduleMessage(cohortCode: string, trainingSystemCode: string): string {
  return `Chưa có bảng phí cho Khoá ${cohortCode.replace(/^K/, '')} · ${trainingSystemCode}. Liên hệ Phòng Tài vụ.`
}

/** One heading per recalculation; every entry of that run carries the same prefix in its description. */
export function recalculationGroup(reason: string, at: Date): string {
  return `${RECALCULATION_PREFIX} · ${reason} · ${formatVnDateTime(at)}`
}

export function recalculationGroupOf(description: string | null): string | null {
  if (!description?.startsWith(RECALCULATION_PREFIX)) return null
  return description.split(RECALCULATION_SEPARATOR)[0]!
}

/** Project one term's BM7 after reversing the old debits/discounts and posting the new ones. */
export function projectAfter(
  before: Bm7,
  oldDebits: bigint,
  oldDiscounts: bigint,
  newDebits: bigint,
  newDiscounts: bigint,
): Bm7 {
  const grossAmount = Number(BigInt(before.grossAmount) - oldDebits + newDebits)
  const discountAmount = Number(BigInt(before.discountAmount) - oldDiscounts + newDiscounts)
  const netAmount = grossAmount - discountAmount
  return {
    grossAmount,
    discountAmount,
    netAmount,
    paidAmount: before.paidAmount,
    outstandingAmount: netAmount - before.paidAmount,
  }
}
