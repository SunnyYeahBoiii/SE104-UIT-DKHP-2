import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../../src/generated/prisma/client'

export function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export type Db = ReturnType<typeof createClient>

/** Map lookup that fails loudly; seed data is static, so a miss is always a typo in this folder. */
export function must<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new Error(`Seed lookup failed: ${String(key)}`)
  return value
}

// ── Dates. The university runs on Vietnam time (UTC+7, no DST). ──

/** A wall-clock moment in Vietnam, e.g. vn('2027-01-06', '08:00'). */
export const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)
export const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000)

/** Vietnam calendar date of a moment, as YYYY-MM-DD. */
export const vnDate = (moment: Date) => addHours(moment, 7).toISOString().slice(0, 10)

// ── Domain encodings ──

export const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** Meeting.weeks bitmask: bit 0 is week 1. */
export function weeksMask(weeks: Iterable<number>): number {
  let mask = 0
  for (const week of weeks) mask |= 1 << (week - 1)
  return mask
}

/** HP-06: discounts round down to the dong. BigInt division truncates, which is floor for amounts ≥ 0. */
export const percentOf = (amount: bigint, rate: number) => (amount * BigInt(rate)) / 100n

/** Scores are handled as integer tenths and written as DECIMAL(3,1) strings (KQ-02). */
export const toScore = (tenths: number) => (tenths / 10).toFixed(1)
