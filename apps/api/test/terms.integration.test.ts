import 'reflect-metadata'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { AcademicsService } from '../src/academics/academics.service'
import { Clock } from '../src/academics/clock'
import type { Actor } from '../src/academics/academics.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { DEMO_NOW } from '../prisma/seed/scenarios'

const actor: Actor = { userId: 1, requestId: 'test-terms', ip: '203.0.113.9' }
const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)
const iso = (date: Date) => date.toISOString()

class FakeClock extends Clock {
  override now(): Date {
    return DEMO_NOW
  }
}

const PARAM_KEYS = [
  'registration.mainTerm.minCredits',
  'registration.mainTerm.maxCredits',
  'registration.summer.maxCredits',
]

type Failure = {
  response: {
    code: string
    message?: string
    fieldErrors?: Record<string, string>
  }
}

async function failureOf(promise: Promise<unknown>): Promise<Failure> {
  try {
    await promise
  } catch (error) {
    const response = (error as { response?: unknown }).response
    if (response && typeof response === 'object')
      return { response: response as Failure['response'] }
  }
  throw new Error('Expected the command to be rejected')
}

type TermSnapshot = {
  id: number
  termCode: string
  registrationStartAt: Date
  registrationEndAt: Date
  adjustmentStartAt: Date
  adjustmentEndAt: Date
  tuitionDeadline: Date
  minCredits: number
  maxCredits: number
}

describe('terms and slots (integration: Postgres dkhp_w42, fake clock 06/01/2027 10:00)', () => {
  let prisma: PrismaService
  let academics: AcademicsService
  let terms: TermSnapshot[]
  let parameters: { key: string; value: unknown }[]
  const createdSlotIds: number[] = []

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    academics = new AcademicsService(prisma, new FakeClock())
    terms = await prisma.term.findMany({
      select: {
        id: true,
        termCode: true,
        registrationStartAt: true,
        registrationEndAt: true,
        adjustmentStartAt: true,
        adjustmentEndAt: true,
        tuitionDeadline: true,
        minCredits: true,
        maxCredits: true,
      },
    })
    parameters = await prisma.systemParameter.findMany({
      where: { key: { in: PARAM_KEYS } },
      select: { key: true, value: true },
    })
    // 20263 has no seeded slots; start clean even if an earlier run aborted mid-test.
    const summer = terms.find((term) => term.termCode === '20263')!
    await prisma.registrationSlot.deleteMany({ where: { termId: summer.id } })
  })

  afterAll(async () => {
    for (const id of createdSlotIds) await prisma.registrationSlot.deleteMany({ where: { id } })
    for (const term of terms)
      await prisma.term.update({
        where: { id: term.id },
        data: {
          registrationStartAt: term.registrationStartAt,
          registrationEndAt: term.registrationEndAt,
          adjustmentStartAt: term.adjustmentStartAt,
          adjustmentEndAt: term.adjustmentEndAt,
          tuitionDeadline: term.tuitionDeadline,
          minCredits: term.minCredits,
          maxCredits: term.maxCredits,
        },
      })
    for (const parameter of parameters)
      await prisma.systemParameter.update({
        where: { key: parameter.key },
        data: { value: parameter.value as never },
      })
    // Audit rows are append-only by design (init migration), so they stay in the dev database.
    await prisma.onModuleDestroy()
  })

  const termView = async (code: string) => {
    const list = await academics.list()
    const view = list.terms.find((term) => term.code === code)
    if (!view) throw new Error(`term ${code} missing`)
    return { list, view }
  }

  const milestones = (code: string) => {
    const term = terms.find((item) => item.termCode === code)!
    return {
      registrationStartAt: term.registrationStartAt,
      registrationEndAt: term.registrationEndAt,
      adjustmentStartAt: term.adjustmentStartAt,
      adjustmentEndAt: term.adjustmentEndAt,
      tuitionDeadline: term.tuitionDeadline,
    }
  }

  it('HK-06/HK-02: shows lock state and rejects a wrong order at the offending fields', async () => {
    const { view } = await termView('20262')
    expect(view.phase).toBe('REGISTRATION')
    expect(view.editable.registrationStartAt).toBe(false)
    expect(view.editable.registrationEndAt).toBe(true)

    const valid = {
      ...milestones('20262'),
      registrationEndAt: vn('2027-01-10', '17:00'),
    }
    // Adjustment may not start before registration ends; both new values are still in the future.
    const bad = { ...valid, adjustmentStartAt: vn('2027-01-09', '08:00') }
    const failed = await academics.previewMilestones('20262', bad)
    expect(failed.ok).toBe(false)
    expect(failed.fieldErrors.adjustmentStartAt).toBeTruthy()
    expect(failed.invalidRanges.length).toBeGreaterThan(0)
    expect((await failureOf(academics.updateMilestones('20262', bad, actor))).response.code).toBe(
      'MILESTONE_ORDER',
    )

    expect((await academics.previewMilestones('20262', valid)).ok).toBe(true)
    const updated = await academics.updateMilestones('20262', valid, actor)
    expect(updated.milestones.registrationEndAt).toBe(iso(valid.registrationEndAt))
    const log = await prisma.auditLog.findFirst({
      where: { action: 'term.update_milestones', entityId: '20262' },
    })
    expect(log?.actorId).toBe(actor.userId)
    expect(log?.payload).toMatchObject({
      after: { registrationEndAt: iso(valid.registrationEndAt) },
    })
  })

  it('HK-06: a started range refuses a changed start even when the new order is valid', async () => {
    const current = milestones('20262')
    const moved = { ...current, registrationStartAt: vn('2027-01-06', '12:00') }
    const failure = await failureOf(academics.updateMilestones('20262', moved, actor))
    expect(failure.response.code).toBe('MILESTONE_LOCKED')
    expect(failure.response.fieldErrors?.registrationStartAt).toBeTruthy()
  })

  it('HK-04: rejects a new period that overlaps another term', async () => {
    const overlapping = {
      registrationStartAt: vn('2027-01-10', '08:00'),
      registrationEndAt: vn('2027-01-12', '17:00'),
      adjustmentStartAt: vn('2027-01-20', '08:00'),
      adjustmentEndAt: vn('2027-01-25', '17:00'),
      tuitionDeadline: milestones('20263').tuitionDeadline,
    }
    const preview = await academics.previewMilestones('20263', overlapping)
    expect(preview.ok).toBe(false)
    expect(preview.issues.map((issue) => issue.code)).toContain('TERM_OVERLAP')
    const failure = await failureOf(academics.updateMilestones('20263', overlapping, actor))
    expect(failure.response.code).toBe('TERM_OVERLAP')
    expect(failure.response.message).toContain('20262')
  })

  it('HK-07: enforces registration window, cohorts and the live-slot lock', async () => {
    const { view } = await termView('20263')
    expect(view.cohortsWithoutSlots.length).toBeGreaterThan(0)

    const withoutCohort = {
      startAt: vn('2027-06-14', '08:00'),
      endAt: vn('2027-06-14', '17:00'),
      cohortIds: [],
    }
    expect(
      (await failureOf(academics.createSlot('20263', withoutCohort, actor))).response.code,
    ).toBe('SLOT_NO_COHORT')

    const outside = {
      startAt: vn('2027-06-20', '08:00'),
      endAt: vn('2027-06-20', '17:00'),
      cohortIds: [1],
    }
    expect((await failureOf(academics.createSlot('20263', outside, actor))).response.code).toBe(
      'SLOT_OUTSIDE_REGISTRATION',
    )

    const valid = { ...withoutCohort, cohortIds: [1] }
    const created = await academics.createSlot('20263', valid, actor)
    createdSlotIds.push(created.id)
    const withSlot = await termView('20263')
    expect(withSlot.view.slots.find((slot) => slot.id === created.id)?.cohortIds).toEqual([1])

    const running = withSlot.view.slots.find((slot) => slot.id === created.id)!
    expect(running.state).toBe('UPCOMING')

    const open = await termView('20262')
    const ongoing = open.view.slots.find((slot) => slot.state === 'ONGOING')!
    const past = open.view.slots.find((slot) => slot.state === 'PAST')!
    const extended = await academics.updateSlot(
      '20262',
      ongoing.id,
      {
        startAt: iso(new Date(ongoing.startAt)),
        endAt: iso(new Date(ongoing.endAt)),
        cohortIds: ongoing.cohortIds,
      },
      actor,
    )
    expect(extended).toEqual({ id: ongoing.id })
    const locked = await failureOf(
      academics.updateSlot(
        '20262',
        past.id,
        {
          startAt: iso(new Date(past.startAt)),
          endAt: vn('2027-01-06', '17:00'),
          cohortIds: past.cohortIds,
        },
        actor,
      ),
    )
    expect(locked.response.code).toBe('SLOT_LOCKED')
    expect((await failureOf(academics.deleteSlot('20262', past.id, actor))).response.code).toBe(
      'SLOT_LOCKED',
    )
  })

  it('DK-08: copies new limits only to PREPARATION terms and logs the change', async () => {
    const before = await termView('20262')
    const result = await academics.updateCreditLimits(
      { minCredits: 13, mainTermMaxCredits: 23, summerMaxCredits: 11 },
      actor,
    )
    expect(result.creditLimits).toEqual({
      minCredits: 13,
      mainTermMaxCredits: 23,
      summerMaxCredits: 11,
    })
    expect(result.appliedTo).toContain('20263')
    expect(result.appliedTo).not.toContain('20262')

    const after = await termView('20262')
    expect(after.view.minCredits).toBe(before.view.minCredits)
    expect(after.view.maxCredits).toBe(before.view.maxCredits)
    const summer = await termView('20263')
    expect(summer.view.maxCredits).toBe(11)

    const log = await prisma.auditLog.findFirst({ where: { action: 'term.update_credit_limits' } })
    const payload = log?.payload as { appliedTo?: string[] } | undefined
    expect(payload?.appliedTo).toContain('20263')
  })

  it('HK-07: rejects non-positive or inverted limits', async () => {
    const zero = await failureOf(
      academics.updateCreditLimits(
        { minCredits: 0, mainTermMaxCredits: 24, summerMaxCredits: 12 },
        actor,
      ),
    )
    expect(zero.response.code).toBe('CREDIT_LIMIT_INVALID')
    const inverted = await failureOf(
      academics.updateCreditLimits(
        { minCredits: 25, mainTermMaxCredits: 24, summerMaxCredits: 12 },
        actor,
      ),
    )
    expect(inverted.response.code).toBe('CREDIT_LIMIT_INVALID')
  })
})
