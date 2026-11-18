export type ClashMeeting = {
  dayOfWeek: number
  startSlot: number
  endSlot: number
  weeks: number
}

export type ClashSection<T extends ClashMeeting = ClashMeeting> = {
  code: string
  meetings: readonly T[]
}

export type ScheduleClash = {
  withCode: string
  dayOfWeek: number
  startSlot: number
  endSlot: number
}

/**
 * DK-07: same day, overlapping periods and at least one shared week. Meeting.weeks is a bitmask
 * (bit 0 = week 1), so an odd/even (cách tuần) pair with no common bit never conflicts.
 * A section with no meeting (HT2 / SE121) never conflicts (requirements.md DK-07).
 */
export function findScheduleClash<T extends ClashMeeting>(
  candidate: ClashSection<T>,
  others: readonly ClashSection<T>[],
): ScheduleClash | null {
  for (const other of others) {
    for (const left of candidate.meetings) {
      for (const right of other.meetings) {
        if (
          left.dayOfWeek !== right.dayOfWeek ||
          left.startSlot > right.endSlot ||
          right.startSlot > left.endSlot ||
          (left.weeks & right.weeks) === 0
        )
          continue
        return {
          withCode: other.code,
          dayOfWeek: left.dayOfWeek,
          startSlot: Math.max(left.startSlot, right.startSlot),
          endSlot: Math.min(left.endSlot, right.endSlot),
        }
      }
    }
  }
  return null
}
