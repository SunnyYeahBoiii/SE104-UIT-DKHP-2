import { HttpException, Injectable, NotFoundException } from '@nestjs/common'

import type { Prisma } from '../generated/prisma/client'
import { TermType } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { Clock } from './clock'
import {
  cohortsWithoutSlots,
  editableMilestones,
  slotState,
  termPhase,
  validateCreditLimits,
  validateMilestoneChange,
  validateRegistrationOverlap,
  validateSlotWrite,
  validateSlotsInsideRegistration,
  type CreditLimits,
  type MilestoneValues,
  type PolicyIssue,
  type SlotInput,
} from './term-policy'

export type Actor = { userId: number; requestId?: string; ip?: string }

type TermRow = Prisma.TermGetPayload<{
  include: {
    academicYear: true
    registrationSlots: { include: { cohorts: true } }
  }
}>

export type SlotView = {
  id: number
  name: string
  startAt: string
  endAt: string
  cohortIds: number[]
  state: 'UPCOMING' | 'ONGOING' | 'PAST'
  /** Which parts the UI may still change; mirrors the write rules. */
  canEditStart: boolean
  canEditEnd: boolean
  canDelete: boolean
}

export type TermView = ReturnType<typeof toTermView>

const PARAM_KEYS = {
  minCredits: 'registration.mainTerm.minCredits',
  mainTermMaxCredits: 'registration.mainTerm.maxCredits',
  summerMaxCredits: 'registration.summer.maxCredits',
} as const

const toMilestones = (term: TermRow): MilestoneValues => ({
  registrationStartAt: term.registrationStartAt,
  registrationEndAt: term.registrationEndAt,
  adjustmentStartAt: term.adjustmentStartAt,
  adjustmentEndAt: term.adjustmentEndAt,
  tuitionDeadline: term.tuitionDeadline,
})

function toTermView(term: TermRow, now: Date, cohortIds: number[] = []) {
  const editable = editableMilestones(toMilestones(term), now)
  const slotRows = term.registrationSlots.map((slot) => {
    const state = slotState({ startAt: slot.startAt, endAt: slot.endAt }, now)
    return {
      id: slot.id,
      name: slot.name,
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString(),
      cohortIds: slot.cohorts.map((link) => link.cohortId),
      state,
      canEditStart: state === 'UPCOMING',
      canEditEnd: state !== 'PAST',
      canDelete: state === 'UPCOMING',
    }
  })
  return {
    id: term.id,
    code: term.termCode,
    type: term.type,
    startYear: term.academicYear.startYear,
    phase: term.phase,
    derivedPhase: termPhase(toMilestones(term), now),
    startDate: term.startDate.toISOString().slice(0, 10),
    milestones: {
      registrationStartAt: term.registrationStartAt.toISOString(),
      registrationEndAt: term.registrationEndAt.toISOString(),
      adjustmentStartAt: term.adjustmentStartAt.toISOString(),
      adjustmentEndAt: term.adjustmentEndAt.toISOString(),
      tuitionDeadline: term.tuitionDeadline.toISOString(),
    },
    finalExamStartAt: term.finalExamStartAt.toISOString(),
    minCredits: term.minCredits,
    maxCredits: term.maxCredits,
    editable,
    slots: slotRows,
    cohortsWithoutSlots: cohortsWithoutSlots(
      cohortIds,
      slotRows.flatMap((slot) => slot.cohortIds),
    ),
  }
}

function assertValid(issues: PolicyIssue[]): void {
  if (issues.length === 0) return
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) for (const field of issue.fields) fieldErrors[field] ??= issue.message
  throw new HttpException(
    {
      code: issues[0]!.code,
      message: issues.map((issue) => issue.message).join(' '),
      fieldErrors,
    },
    400,
  )
}

function dateField(body: unknown, name: string): Date {
  const value = (body as Record<string, unknown> | null)?.[name]
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value)
  throw new HttpException(
    {
      code: 'INVALID_REQUEST',
      message: `${name} phải là thời điểm hợp lệ.`,
      fieldErrors: { [name]: 'Thời điểm không hợp lệ.' },
    },
    400,
  )
}

function intField(body: unknown, name: string): number {
  const value = (body as Record<string, unknown> | null)?.[name]
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new HttpException(
      {
        code: 'INVALID_REQUEST',
        message: `${name} phải là số.`,
        fieldErrors: { [name]: 'Phải là số.' },
      },
      400,
    )
  return value
}

function milestoneBody(body: unknown): MilestoneValues {
  return {
    registrationStartAt: dateField(body, 'registrationStartAt'),
    registrationEndAt: dateField(body, 'registrationEndAt'),
    adjustmentStartAt: dateField(body, 'adjustmentStartAt'),
    adjustmentEndAt: dateField(body, 'adjustmentEndAt'),
    tuitionDeadline: dateField(body, 'tuitionDeadline'),
  }
}

function slotBody(body: unknown): SlotInput {
  const cohortIds = (body as Record<string, unknown> | null)?.cohortIds
  if (!Array.isArray(cohortIds) || cohortIds.some((id) => typeof id !== 'number'))
    throw new HttpException(
      {
        code: 'INVALID_REQUEST',
        message: 'cohortIds phải là danh sách mã khoá.',
        fieldErrors: { cohortIds: 'Danh sách khoá không hợp lệ.' },
      },
      400,
    )
  return {
    startAt: dateField(body, 'startAt'),
    endAt: dateField(body, 'endAt'),
    cohortIds: cohortIds as number[],
  }
}

function parameterNumber(rows: { key: string; value: Prisma.JsonValue }[], key: string): number {
  const value = rows.find((row) => row.key === key)?.value
  return typeof value === 'number' ? value : 0
}

/**
 * Academics owns terms, registration slots and credit limits (ADR-0007). Writes run in one Postgres
 * transaction and append an audit log in that same transaction (NFR-10); nothing here changes the
 * stored term phase — phases move on their own schedule (HK-03).
 */
@Injectable()
export class AcademicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  private async log(
    tx: Prisma.TransactionClient,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action,
        entityType,
        entityId,
        payload: payload as Prisma.InputJsonValue,
        requestId: actor.requestId,
        ip: actor.ip,
      },
    })
  }

  private termInclude = {
    academicYear: true,
    registrationSlots: { include: { cohorts: true } },
  } satisfies Prisma.TermInclude

  private async getTerm(tx: Prisma.TransactionClient, code: string): Promise<TermRow> {
    const term = await tx.term.findUnique({ where: { termCode: code }, include: this.termInclude })
    if (!term)
      throw new NotFoundException({ code: 'TERM_NOT_FOUND', message: 'Không tìm thấy học kỳ.' })
    return term
  }

  async list() {
    const [terms, parameters, cohorts] = await Promise.all([
      this.prisma.term.findMany({
        include: this.termInclude,
        orderBy: [{ academicYear: { startYear: 'asc' } }, { type: 'asc' }],
      }),
      this.prisma.systemParameter.findMany({ where: { key: { in: Object.values(PARAM_KEYS) } } }),
      this.prisma.cohort.findMany({ orderBy: { admissionYear: 'asc' } }),
    ])
    const now = this.clock.now()
    const cohortIds = cohorts.map((cohort) => cohort.id)
    return {
      now: now.toISOString(),
      creditLimits: {
        minCredits: parameterNumber(parameters, PARAM_KEYS.minCredits),
        mainTermMaxCredits: parameterNumber(parameters, PARAM_KEYS.mainTermMaxCredits),
        summerMaxCredits: parameterNumber(parameters, PARAM_KEYS.summerMaxCredits),
      },
      cohorts: cohorts.map((cohort) => ({ id: cohort.id, code: cohort.code })),
      terms: terms.map((term) => toTermView(term, now, cohortIds)),
    }
  }

  /** One validator for the preview and the write, so a red range always matches the rejection. */
  private async milestoneIssues(
    tx: Prisma.TransactionClient,
    term: TermRow,
    next: MilestoneValues,
    now: Date,
  ): Promise<PolicyIssue[]> {
    const others = await tx.term.findMany({ where: { id: { not: term.id } } })
    return [
      ...validateMilestoneChange(toMilestones(term), next, now, term.finalExamStartAt),
      ...validateSlotsInsideRegistration(
        term.registrationSlots.map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt })),
        next,
      ),
      ...validateRegistrationOverlap(
        {
          termCode: term.termCode,
          registrationStartAt: next.registrationStartAt,
          adjustmentEndAt: next.adjustmentEndAt,
        },
        others.map((other) => ({
          termCode: other.termCode,
          registrationStartAt: other.registrationStartAt,
          adjustmentEndAt: other.adjustmentEndAt,
        })),
      ),
    ]
  }

  /** TermTimeline preview: same policy as the write, so the red ranges match the server's rejection. */
  async previewMilestones(code: string, body: unknown) {
    const next = milestoneBody(body)
    const term = await this.getTerm(this.prisma, code)
    const issues = await this.milestoneIssues(this.prisma, term, next, this.clock.now())
    const fieldErrors: Record<string, string> = {}
    const invalidRanges: { startAt: string; endAt: string }[] = []
    for (const issue of issues) {
      for (const field of issue.fields) fieldErrors[field] ??= issue.message
      if (issue.code === 'MILESTONE_ORDER' || issue.code === 'SLOT_OUTSIDE_REGISTRATION')
        invalidRanges.push({
          startAt: next.registrationStartAt.toISOString(),
          endAt: next.tuitionDeadline.toISOString(),
        })
    }
    return { ok: issues.length === 0, issues, fieldErrors, invalidRanges }
  }

  async updateMilestones(code: string, body: unknown, actor: Actor) {
    const next = milestoneBody(body)
    return this.prisma.$transaction(async (tx) => {
      const term = await this.getTerm(tx, code)
      const now = this.clock.now()
      assertValid(await this.milestoneIssues(tx, term, next, now))
      const allCohorts = await tx.cohort.findMany({ select: { id: true } })
      const updated = await tx.term.update({ where: { id: term.id }, data: next })
      await this.log(tx, actor, 'term.update_milestones', 'Term', code, {
        before: Object.fromEntries(
          Object.entries(toMilestones(term)).map(([field, value]) => [field, value.toISOString()]),
        ),
        after: Object.fromEntries(
          Object.entries(next).map(([field, value]) => [field, value.toISOString()]),
        ),
      })
      return toTermView(
        { ...term, ...updated },
        now,
        allCohorts.map((cohort) => cohort.id),
      )
    })
  }

  async updateCreditLimits(body: unknown, actor: Actor) {
    const next: CreditLimits = {
      minCredits: intField(body, 'minCredits'),
      mainTermMaxCredits: intField(body, 'mainTermMaxCredits'),
      summerMaxCredits: intField(body, 'summerMaxCredits'),
    }
    return this.prisma.$transaction(async (tx) => {
      const parameters = await tx.systemParameter.findMany({
        where: { key: { in: Object.values(PARAM_KEYS) } },
      })
      const current: CreditLimits = {
        minCredits: parameterNumber(parameters, PARAM_KEYS.minCredits),
        mainTermMaxCredits: parameterNumber(parameters, PARAM_KEYS.mainTermMaxCredits),
        summerMaxCredits: parameterNumber(parameters, PARAM_KEYS.summerMaxCredits),
      }
      assertValid(validateCreditLimits(next, current))

      // Copy only into PREPARATION terms; a started term keeps the limits its students registered under.
      const preparing = await tx.term.findMany({ where: { phase: 'PREPARATION' } })
      for (const term of preparing) {
        await tx.term.update({
          where: { id: term.id },
          data:
            term.type === TermType.SUMMER
              ? { maxCredits: next.summerMaxCredits }
              : { minCredits: next.minCredits, maxCredits: next.mainTermMaxCredits },
        })
      }
      for (const [field, key] of Object.entries(PARAM_KEYS))
        await tx.systemParameter.update({
          where: { key },
          data: { value: next[field as keyof CreditLimits] },
        })

      await this.log(tx, actor, 'term.update_credit_limits', 'Term', 'credit-limits', {
        before: current,
        after: next,
        appliedTo: preparing.map((term) => term.termCode),
      })
      return { creditLimits: next, appliedTo: preparing.map((term) => term.termCode) }
    })
  }

  private async slotInput(
    tx: Prisma.TransactionClient,
    term: TermRow,
    body: unknown,
    slotId?: number,
  ) {
    const next = slotBody(body)
    const current = slotId
      ? await tx.registrationSlot.findUnique({
          where: { id: slotId },
          include: { cohorts: true },
        })
      : null
    if (slotId && (!current || current.termId !== term.id))
      throw new NotFoundException({ code: 'SLOT_NOT_FOUND', message: 'Không tìm thấy khung giờ.' })
    return {
      next,
      current: current
        ? {
            startAt: current.startAt,
            endAt: current.endAt,
            cohortIds: current.cohorts.map((link) => link.cohortId),
          }
        : null,
    }
  }

  async createSlot(code: string, body: unknown, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const term = await this.getTerm(tx, code)
      const { next } = await this.slotInput(tx, term, body)
      const known = await tx.cohort.findMany({ select: { id: true, code: true } })
      assertValid(
        validateSlotWrite({
          current: null,
          next,
          m: toMilestones(term),
          now: this.clock.now(),
          knownCohortIds: known.map((cohort) => cohort.id),
        }),
      )
      const created = await tx.registrationSlot.create({
        data: {
          termId: term.id,
          name: known
            .filter((cohort) => next.cohortIds.includes(cohort.id))
            .map((cohort) => cohort.code)
            .join(', '),
          startAt: next.startAt,
          endAt: next.endAt,
          cohorts: { create: next.cohortIds.map((cohortId) => ({ cohortId })) },
        },
      })
      await this.log(
        tx,
        actor,
        'registration_slot.create',
        'RegistrationSlot',
        String(created.id),
        {
          ...next,
          startAt: next.startAt.toISOString(),
          endAt: next.endAt.toISOString(),
        },
      )
      return { id: created.id }
    })
  }

  async updateSlot(code: string, slotId: number, body: unknown, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const term = await this.getTerm(tx, code)
      const { next, current } = await this.slotInput(tx, term, body, slotId)
      const known = await tx.cohort.findMany({ select: { id: true } })
      assertValid(
        validateSlotWrite({
          current,
          next,
          m: toMilestones(term),
          now: this.clock.now(),
          knownCohortIds: known.map((cohort) => cohort.id),
        }),
      )
      await tx.registrationSlot.update({
        where: { id: slotId },
        data: { startAt: next.startAt, endAt: next.endAt },
      })
      await tx.registrationSlotCohort.deleteMany({ where: { registrationSlotId: slotId } })
      await tx.registrationSlotCohort.createMany({
        data: next.cohortIds.map((cohortId) => ({ registrationSlotId: slotId, cohortId })),
      })
      await this.log(tx, actor, 'registration_slot.update', 'RegistrationSlot', String(slotId), {
        before: current,
        after: { ...next, startAt: next.startAt.toISOString(), endAt: next.endAt.toISOString() },
      })
      return { id: slotId }
    })
  }

  async deleteSlot(code: string, slotId: number, actor: Actor) {
    return this.prisma.$transaction(async (tx) => {
      const term = await this.getTerm(tx, code)
      const row = await tx.registrationSlot.findUnique({
        where: { id: slotId },
        include: { cohorts: true },
      })
      if (!row || row.termId !== term.id)
        throw new NotFoundException({
          code: 'SLOT_NOT_FOUND',
          message: 'Không tìm thấy khung giờ.',
        })
      const current: SlotInput = {
        startAt: row.startAt,
        endAt: row.endAt,
        cohortIds: row.cohorts.map((link) => link.cohortId),
      }
      assertValid(
        validateSlotWrite({
          current,
          next: current,
          m: toMilestones(term),
          now: this.clock.now(),
          knownCohortIds: [],
          deleting: true,
        }),
      )
      await tx.registrationSlot.delete({ where: { id: slotId } })
      await this.log(tx, actor, 'registration_slot.delete', 'RegistrationSlot', String(slotId), {
        before: current,
      })
      return { id: slotId }
    })
  }
}
