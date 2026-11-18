const DAY_MS = 86_400_000

/** Week 1 is the Monday of the term; bit 0 of Meeting.weeks is that week (TKB-06). */
export function meetingDates(termStart: Date, dayOfWeek: number, weeks: number): string[] {
  const monday = Date.UTC(
    termStart.getUTCFullYear(),
    termStart.getUTCMonth(),
    termStart.getUTCDate(),
  )
  const dates: string[] = []
  for (let bit = 0; bit < 31; bit++) {
    if ((weeks & (1 << bit)) === 0) continue
    const date = monday + (dayOfWeek - 2) * DAY_MS + bit * 7 * DAY_MS
    dates.push(new Date(date).toISOString().slice(0, 10))
  }
  return dates.sort()
}
