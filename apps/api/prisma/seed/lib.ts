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

// ── Deterministic randomness, so every run produces the same names, scores and schedules ──

export type Rng = () => number

/** mulberry32: tiny seeded PRNG returning floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randInt = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1))

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)]
  if (item === undefined) throw new Error('pick() from an empty list')
  return item
}

// ── Dates. The university runs on Vietnam time (UTC+7, no DST). ──

/** A wall-clock moment in Vietnam, e.g. vn('2025-09-08', '07:30'). */
export const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)
export const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000)

/** The calendar date (YYYY-MM-DD) of the first Monday on or after `date`. */
export function mondayOnOrAfter(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7))
  return d.toISOString().slice(0, 10)
}

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
