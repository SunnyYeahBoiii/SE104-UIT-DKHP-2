import { HttpException, Injectable } from '@nestjs/common'

import type { AuthRequest } from '../auth/auth.guard'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  BANK_ACCOUNT_KEY,
  ReceivingAccountService,
  type ReceivingAccount,
} from './receiving-account.service'
import {
  bankAccountInput,
  creditRateInput,
  feeScheduleInput,
  type BankAccountInput,
  type CreditRateInput,
  type FeeScheduleInput,
} from './finance.validation'

type Actor = { actorId: number; requestId?: string }
type BeforeAfter = Record<string, number | string | null>

export type FeeScheduleRow = {
  id: number
  cohortId: number
  cohortCode: string
  admissionYear: number
  trainingSystemId: number
  trainingSystemCode: string
  trainingSystemName: string
  baseTuition: number
  theoryCreditRate: number
  practiceCreditRate: number
  studentCount: number
  updatedAt: string
}

export type MissingFeeScheduleRow = {
  cohortId: number
  cohortCode: string
  admissionYear: number
  trainingSystemId: number
  trainingSystemCode: string
  trainingSystemName: string
  studentCount: number
}

export type HistoryRow = {
  id: number
  action: string
  entityType: string
  entityId: string | null
  actorName: string | null
  createdAt: string
  before: BeforeAfter | null
  after: BeforeAfter | null
}

export type FinanceSettings = {
  defaults: CreditRateInput
  feeSchedules: FeeScheduleRow[]
  missingFeeSchedules: MissingFeeScheduleRow[]
  receivingAccount: ReceivingAccount
  tuitionDeadlines: {
    id: number
    termCode: string
    type: string
    tuitionDeadline: string
  }[]
  history: HistoryRow[]
}

const THEORY_KEY = 'tuition.theoryCreditRate'
const PRACTICE_KEY = 'tuition.practiceCreditRate'
const pairKey = (cohortId: number, trainingSystemId: number) => `${cohortId}:${trainingSystemId}`

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ReceivingAccountService,
  ) {}

  actor(req: AuthRequest): Actor {
    return { actorId: req.auth!.session.userId, requestId: req.requestId }
  }

  async list(): Promise<FinanceSettings> {
    const [parameters, schedules, studentPairs, terms, logs, receivingAccount] = await Promise.all([
      this.prisma.systemParameter.findMany({
        where: { key: { in: [THEORY_KEY, PRACTICE_KEY] } },
      }),
      this.prisma.feeSchedule.findMany({
        include: {
          cohort: true,
          trainingSystem: true,
        },
        orderBy: [{ cohort: { admissionYear: 'asc' } }, { trainingSystem: { code: 'asc' } }],
      }),
      this.prisma.student.groupBy({
        by: ['cohortId', 'trainingSystemId'],
        _count: { _all: true },
      }),
      this.prisma.term.findMany({
        select: { id: true, termCode: true, type: true, tuitionDeadline: true },
        orderBy: { termCode: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: { in: ['FeeSchedule', 'SystemParameter'] } },
        include: { actor: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.accounts.current(),
    ])

    const defaults = {
      theoryCreditRate: Number(parameters.find((item) => item.key === THEORY_KEY)?.value ?? 0),
      practiceCreditRate: Number(parameters.find((item) => item.key === PRACTICE_KEY)?.value ?? 0),
    }
    const counts = new Map<string, number>()
    for (const pair of studentPairs)
      counts.set(pairKey(pair.cohortId, pair.trainingSystemId), pair._count._all)

    const feeSchedules: FeeScheduleRow[] = schedules.map((schedule) => ({
      id: schedule.id,
      cohortId: schedule.cohortId,
      cohortCode: schedule.cohort.code,
      admissionYear: schedule.cohort.admissionYear,
      trainingSystemId: schedule.trainingSystemId,
      trainingSystemCode: schedule.trainingSystem.code,
      trainingSystemName: schedule.trainingSystem.name,
      baseTuition: Number(schedule.baseTuition),
      theoryCreditRate: Number(schedule.theoryCreditRate),
      practiceCreditRate: Number(schedule.practiceCreditRate),
      studentCount: counts.get(pairKey(schedule.cohortId, schedule.trainingSystemId)) ?? 0,
      updatedAt: schedule.updatedAt.toISOString(),
    }))
    const covered = new Set(
      schedules.map((schedule) => pairKey(schedule.cohortId, schedule.trainingSystemId)),
    )
    const missingFeeSchedules: MissingFeeScheduleRow[] = []
    for (const pair of studentPairs) {
      const key = pairKey(pair.cohortId, pair.trainingSystemId)
      if (covered.has(key) || pair._count._all === 0) continue
      const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: pair.cohortId } })
      const system = await this.prisma.trainingSystem.findUniqueOrThrow({
        where: { id: pair.trainingSystemId },
      })
      missingFeeSchedules.push({
        cohortId: cohort.id,
        cohortCode: cohort.code,
        admissionYear: cohort.admissionYear,
        trainingSystemId: system.id,
        trainingSystemCode: system.code,
        trainingSystemName: system.name,
        studentCount: pair._count._all,
      })
    }
    missingFeeSchedules.sort(
      (a, b) =>
        a.admissionYear - b.admissionYear ||
        a.trainingSystemCode.localeCompare(b.trainingSystemCode),
    )

    return {
      defaults,
      feeSchedules,
      missingFeeSchedules,
      receivingAccount,
      tuitionDeadlines: terms.map((term) => ({
        id: term.id,
        termCode: term.termCode,
        type: term.type,
        tuitionDeadline: term.tuitionDeadline.toISOString(),
      })),
      history: logs.map((log) => {
        const payload = log.payload as { before?: BeforeAfter; after?: BeforeAfter } | null
        return {
          id: log.id,
          action: log.action,
          entityType: log.entityType ?? '',
          entityId: log.entityId,
          actorName: log.actor?.fullName ?? null,
          createdAt: log.createdAt.toISOString(),
          before: payload?.before ?? null,
          after: payload?.after ?? null,
        }
      }),
    }
  }

  async updateDefaultRates(body: unknown, actor: Actor): Promise<CreditRateInput> {
    const input = creditRateInput(body)
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.readDefaults(tx)
        if (
          before.theoryCreditRate === input.theoryCreditRate &&
          before.practiceCreditRate === input.practiceCreditRate
        )
          return before

        await tx.systemParameter.update({
          where: { key: THEORY_KEY },
          data: { value: input.theoryCreditRate, updatedById: actor.actorId },
        })
        await tx.systemParameter.update({
          where: { key: PRACTICE_KEY },
          data: { value: input.practiceCreditRate, updatedById: actor.actorId },
        })
        await this.audit(
          tx,
          actor,
          'DEFAULT_CREDIT_RATE_UPDATE',
          'tuition.creditRates',
          'SystemParameter',
          before,
          input,
        )
        return input
      })
    } catch (error) {
      this.handleError(error)
    }
  }

  async saveFeeSchedule(
    body: unknown,
    id: number | undefined,
    actor: Actor,
  ): Promise<FeeScheduleRow> {
    const input: FeeScheduleInput = feeScheduleInput(body)
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.cohort.findUniqueOrThrow({ where: { id: input.cohortId } })
        await tx.trainingSystem.findUniqueOrThrow({ where: { id: input.trainingSystemId } })
        const data = {
          cohortId: input.cohortId,
          trainingSystemId: input.trainingSystemId,
          baseTuition: BigInt(input.baseTuition),
          theoryCreditRate: BigInt(input.theoryCreditRate),
          practiceCreditRate: BigInt(input.practiceCreditRate),
        }
        const before = id ? await tx.feeSchedule.findUnique({ where: { id } }) : null
        if (id && !before) throw this.notFound('bảng phí')
        const saved = id
          ? await tx.feeSchedule.update({ where: { id }, data })
          : await tx.feeSchedule.create({ data })
        const snapshot = {
          cohortId: saved.cohortId,
          trainingSystemId: saved.trainingSystemId,
          baseTuition: Number(saved.baseTuition),
          theoryCreditRate: Number(saved.theoryCreditRate),
          practiceCreditRate: Number(saved.practiceCreditRate),
        }
        const previous = before
          ? {
              cohortId: before.cohortId,
              trainingSystemId: before.trainingSystemId,
              baseTuition: Number(before.baseTuition),
              theoryCreditRate: Number(before.theoryCreditRate),
              practiceCreditRate: Number(before.practiceCreditRate),
            }
          : null
        await this.audit(
          tx,
          actor,
          id ? 'FEE_SCHEDULE_UPDATE' : 'FEE_SCHEDULE_CREATE',
          saved.id,
          'FeeSchedule',
          previous,
          snapshot,
        )
        return this.feeRow(tx, saved.id)
      })
    } catch (error) {
      this.handleError(error)
    }
  }

  async updateReceivingAccount(body: unknown, actor: Actor): Promise<ReceivingAccount> {
    const input: BankAccountInput = bankAccountInput(body)
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.accounts.current(tx)
        if (
          before.gateway === input.gateway &&
          before.accountNumber === input.accountNumber &&
          before.accountName === input.accountName
        )
          return before

        await tx.systemParameter.update({
          where: { key: BANK_ACCOUNT_KEY },
          data: { value: input, updatedById: actor.actorId },
        })
        await this.audit(
          tx,
          actor,
          'RECEIVING_ACCOUNT_UPDATE',
          BANK_ACCOUNT_KEY,
          'SystemParameter',
          before,
          input,
        )
        return input
      })
    } catch (error) {
      this.handleError(error)
    }
  }

  private async readDefaults(tx: Prisma.TransactionClient): Promise<CreditRateInput> {
    const [theory, practice] = await Promise.all([
      tx.systemParameter.findUniqueOrThrow({ where: { key: THEORY_KEY } }),
      tx.systemParameter.findUniqueOrThrow({ where: { key: PRACTICE_KEY } }),
    ])
    return {
      theoryCreditRate: Number(theory.value),
      practiceCreditRate: Number(practice.value),
    }
  }

  private async feeRow(tx: Prisma.TransactionClient, id: number): Promise<FeeScheduleRow> {
    const schedule = await tx.feeSchedule.findUniqueOrThrow({
      where: { id },
      include: { cohort: true, trainingSystem: true },
    })
    const pair = await tx.student.groupBy({
      by: ['cohortId'],
      where: { cohortId: schedule.cohortId, trainingSystemId: schedule.trainingSystemId },
      _count: { _all: true },
    })
    return {
      id: schedule.id,
      cohortId: schedule.cohortId,
      cohortCode: schedule.cohort.code,
      admissionYear: schedule.cohort.admissionYear,
      trainingSystemId: schedule.trainingSystemId,
      trainingSystemCode: schedule.trainingSystem.code,
      trainingSystemName: schedule.trainingSystem.name,
      baseTuition: Number(schedule.baseTuition),
      theoryCreditRate: Number(schedule.theoryCreditRate),
      practiceCreditRate: Number(schedule.practiceCreditRate),
      studentCount: pair[0]?._count._all ?? 0,
      updatedAt: schedule.updatedAt.toISOString(),
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: Actor,
    action: string,
    entityId: string | number,
    entityType: string,
    before: BeforeAfter | null,
    after: BeforeAfter | null,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: actor.actorId,
        action,
        entityType,
        entityId: String(entityId),
        payload: { before, after },
        requestId: actor.requestId,
      },
    })
  }

  private notFound(entity: string): HttpException {
    return new HttpException({ code: 'NOT_FOUND', message: `Không tìm thấy ${entity}.` }, 404)
  }

  private handleError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new HttpException(
          {
            code: 'FEE_SCHEDULE_EXISTS',
            message: 'Bảng phí cho cặp (khoá, hệ đào tạo) này đã tồn tại.',
          },
          409,
        )
      if (error.code === 'P2025') throw this.notFound('bảng phí')
    }
    throw error instanceof Error ? error : new Error(String(error))
  }
}
