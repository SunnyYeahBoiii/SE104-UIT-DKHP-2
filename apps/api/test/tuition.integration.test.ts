import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/14'

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { Clock } from '../src/academics/clock'
import { ReceivingAccountService } from '../src/finance/receiving-account.service'
import {
  AttemptType,
  EnrollmentStatus,
  LedgerDirection,
  LedgerEntryType,
  Role,
  TermPhase,
  TermType,
} from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { RegistrationClock, RegistrationService } from '../src/registration/registration.service'
import { RegistrationIdempotency } from '../src/registration/idempotency'
import { TermPhaseService } from '../src/term-phases/term-phase.service'
import { TuitionRegistrationHook } from '../src/tuition/tuition-registration.hook'
import { TuitionService } from '../src/tuition/tuition.service'
import { clearRegistrationRateLimits } from './fixtures/rate-limit'

const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)
const suffix = randomUUID().slice(0, 6).toUpperCase()
const START_YEAR = 8000 + (Date.now() % 999)
const CODE = (n: number) => `${START_YEAR + n}1`

class MutableClock extends Clock {
  current = vn('2026-08-01', '08:00')
  override now(): Date {
    return this.current
  }
  set(date: Date): void {
    this.current = date
  }
}

class FixtureClock extends RegistrationClock {
  override now(): Date {
    return vn('2026-09-03', '10:00')
  }
}

type Milestone = {
  registrationStartAt: Date
  registrationEndAt: Date
  adjustmentStartAt: Date
  adjustmentEndAt: Date
  tuitionDeadline: Date
  finalExamStartAt: Date
}

const milestones = (
  start: string,
  end: string,
  adjustStart: string,
  adjustEnd: string,
): Milestone => ({
  registrationStartAt: vn(start, '08:00'),
  registrationEndAt: vn(end, '17:00'),
  adjustmentStartAt: vn(adjustStart, '08:00'),
  adjustmentEndAt: vn(adjustEnd, '17:00'),
  tuitionDeadline: vn('2026-11-30', '17:00'),
  finalExamStartAt: vn('2026-12-30', '07:00'),
})

// ── A.7: BM7 is always recomputed from ledger rows, never stored. ──
describe('BM7 from the ledger — A.7 sample students', () => {
  let prisma: PrismaService
  let tuition: TuitionService

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    tuition = new TuitionService(prisma, new ReceivingAccountService(prisma))
  })

  afterAll(async () => {
    await prisma.onModuleDestroy()
  })

  const cases = [
    {
      code: '24520001',
      term: '20262',
      gross: 15_000_000,
      net: 15_000_000,
      paid: 0,
      due: 15_000_000,
    },
    { code: '24520002', term: '20262', gross: 15_000_000, net: 3_000_000, paid: 3_000_000, due: 0 },
    { code: '24520004', term: '20262', gross: 15_000_000, net: 4_500_000, paid: 4_500_000, due: 0 },
    {
      code: '24520005',
      term: '20262',
      gross: 15_000_000,
      net: 15_000_000,
      paid: 500_000,
      due: 14_500_000,
    },
    // Cancelled IT002.P21's 81k surcharge is reversed, so it is neither a charge nor a payment.
    {
      code: '24520009',
      term: '20262',
      gross: 15_081_000,
      net: 15_081_000,
      paid: 0,
      due: 15_081_000,
    },
    { code: '24520010', term: '20263', gross: 81_000, net: 81_000, paid: 0, due: 81_000 },
    {
      code: '23520003',
      term: '20262',
      gross: 14_581_000,
      net: 14_581_000,
      paid: 0,
      due: 14_581_000,
    },
  ]

  for (const testCase of cases) {
    it(`${testCase.code} · ${testCase.term}: gross/discount/net/paid/outstanding`, async () => {
      const student = await prisma.student.findUniqueOrThrow({
        where: { studentCode: testCase.code },
      })
      const term = await prisma.term.findUniqueOrThrow({ where: { termCode: testCase.term } })
      const bm7 = await tuition.bm7(prisma, student.id, term.id)
      expect(bm7.grossAmount).toBe(testCase.gross)
      expect(bm7.netAmount).toBe(testCase.net)
      expect(bm7.paidAmount).toBe(testCase.paid)
      expect(bm7.outstandingAmount).toBe(testCase.due)
      expect(bm7.grossAmount - bm7.discountAmount).toBe(bm7.netAmount)
      expect(bm7.netAmount).toBeLessThanOrEqual(bm7.grossAmount)
    })
  }

  it('HP-02: a summer term has no fixed tuition, only the surcharge line', async () => {
    const student = await prisma.student.findUniqueOrThrow({
      where: { studentCode: '24520010' },
    })
    const summer = await prisma.term.findUniqueOrThrow({ where: { termCode: '20263' } })
    const rows = await prisma.ledgerEntry.findMany({
      where: { studentId: student.id, termId: summer.id },
    })
    expect(rows.some((row) => row.type === LedgerEntryType.BASE_TUITION)).toBe(false)
    expect(rows.some((row) => row.type === LedgerEntryType.SURCHARGE)).toBe(true)
  })

  it('HP-05: a cancelled line keeps its original debit and adds a reversal', async () => {
    const student = await prisma.student.findUniqueOrThrow({
      where: { studentCode: '24520009' },
    })
    const term = await prisma.term.findUniqueOrThrow({ where: { termCode: '20262' } })
    const rows = await prisma.ledgerEntry.findMany({
      where: { studentId: student.id, termId: term.id },
    })
    const surcharges = rows.filter((row) => row.type === LedgerEntryType.SURCHARGE)
    const reversals = rows.filter((row) => row.type === LedgerEntryType.SURCHARGE_REVERSAL)
    expect(surcharges).toHaveLength(2)
    expect(reversals).toHaveLength(1)
    expect(reversals[0]!.relatedEntryId).toBe(surcharges[0]!.id)
    expect(reversals[0]!.amount).toBe(surcharges[0]!.amount)
    expect(reversals[0]!.direction).toBe(LedgerDirection.CREDIT)
  })

  it('B.4.4: the read model defaults to the nearest unpaid term and orders the ledger newest first', async () => {
    const student = await prisma.student.findUniqueOrThrow({
      where: { studentCode: '24520001' },
    })
    const view = await tuition.overview(student.userId)
    expect(view.selected?.code).toBe('20262')
    expect(view.selected?.paymentCode).toBe('HP2452000120262')
    expect(view.selected?.bm7.outstandingAmount).toBe(15_000_000)
    expect(view.selected?.ledger[0]?.label).toContain('Học phí cố định')
    const dates = view.selected!.ledger.map((row) => Date.parse(row.date))
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
    expect(view.selected?.payment.accountNumber).toBe('0000000000')
  })
})

// ── Write path: one transaction per phase change, frozen rates, append-only reversals. ──
describe('tuition writes (integration: Postgres dkhp_w51, isolated fixtures)', () => {
  let prisma: PrismaService
  let clock: MutableClock
  let service: TermPhaseService
  let hook: TuitionRegistrationHook
  let tuition: TuitionService
  let registration: RegistrationService
  let idempotency: RegistrationIdempotency
  let redis: Redis
  let prevTermId: number
  let mainTermId: number
  let summerTermId: number
  let blockedTermId: number
  const academicYearIds: number[] = []
  let termIds: number[] = []
  const userIds: number[] = []
  const studentIds: number[] = []
  const courseIds: number[] = []
  const offeredIds: number[] = []
  const sectionIds: number[] = []
  const slotIds: number[] = []
  let feeScheduleId: number | null = null
  let parked: { id: number; phase: TermPhase }[] = []
  let keySequence = 0
  const key = () => `tuition-${suffix}-${++keySequence}`

  const makeStudent = async (code: string, name: string, groupCodes: string[] = []) => {
    const user = await prisma.user.create({
      data: {
        username: `${code}-${suffix}`,
        passwordHash: 'not-used',
        fullName: name,
        roles: [Role.STUDENT],
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    const k19 = await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })
    const cqui = await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CQUI' } })
    const student = await prisma.student.create({
      data: {
        studentCode: code,
        userId: user.id,
        fullName: name,
        cohortId: k19.id,
        trainingSystemId: cqui.id,
        priorityGroups: {
          create: await Promise.all(
            groupCodes.map(async (groupCode) => ({
              priorityGroupId: (
                await prisma.priorityGroup.findUniqueOrThrow({ where: { code: groupCode } })
              ).id,
            })),
          ),
        },
      },
    })
    studentIds.push(student.id)
    return { user, student }
  }

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    clock = new MutableClock()
    tuition = new TuitionService(prisma, new ReceivingAccountService(prisma))
    hook = new TuitionRegistrationHook(tuition)
    service = new TermPhaseService(prisma, clock, hook)
    idempotency = new RegistrationIdempotency()
    await clearRegistrationRateLimits()
    redis = new Redis('redis://localhost:6379/14', { maxRetriesPerRequest: 1 })
    registration = new RegistrationService(prisma, new FixtureClock(), idempotency, tuition)

    // HK-04: only one window may be open while fixtures walk their own timeline.
    parked = await prisma.term.findMany({
      where: { phase: { in: ['REGISTRATION', 'ADJUSTMENT'] } },
      select: { id: true, phase: true },
    })
    for (const open of parked)
      await prisma.term.update({ where: { id: open.id }, data: { phase: TermPhase.CLOSED } })

    const academicYear = await prisma.academicYear.create({ data: { startYear: START_YEAR } })
    academicYearIds.push(academicYear.id)
    const blockedYear = await prisma.academicYear.create({ data: { startYear: START_YEAR + 1 } })
    academicYearIds.push(blockedYear.id)

    const terms: { code: string; type: TermType; phase: TermPhase; m: Milestone; year: number }[] =
      [
        {
          code: CODE(0),
          type: TermType.FIRST,
          phase: TermPhase.CLOSED,
          m: milestones('2026-08-20', '2026-08-24', '2026-08-25', '2026-08-28'),
          year: academicYear.id,
        },
        {
          code: `${START_YEAR}2`,
          type: TermType.SECOND,
          phase: TermPhase.PREPARATION,
          m: milestones('2026-09-01', '2026-09-05', '2026-09-20', '2026-09-25'),
          year: academicYear.id,
        },
        {
          code: `${START_YEAR}3`,
          type: TermType.SUMMER,
          phase: TermPhase.PREPARATION,
          m: milestones('2026-10-01', '2026-10-05', '2026-10-20', '2026-10-25'),
          year: academicYear.id,
        },
        {
          code: CODE(1),
          type: TermType.SECOND,
          phase: TermPhase.PREPARATION,
          m: milestones('2026-09-01', '2026-09-05', '2026-09-20', '2026-09-25'),
          year: blockedYear.id,
        },
      ]
    const created: number[] = []
    for (const spec of terms) {
      const term = await prisma.term.create({
        data: {
          academicYearId: spec.year,
          termCode: spec.code,
          type: spec.type,
          phase: spec.phase,
          startDate: vn('2026-09-07'),
          ...spec.m,
          minCredits: 0,
          maxCredits: 24,
        },
      })
      created.push(term.id)
    }
    ;[prevTermId, mainTermId, summerTermId, blockedTermId] = created as [
      number,
      number,
      number,
      number,
    ]
    termIds = created

    // A student with an unused credit balance in the previous term.
    const carry = await makeStudent(`90${suffix}01`, 'Sinh viên dư tiền')
    await prisma.ledgerEntry.create({
      data: {
        studentId: carry.student.id,
        termId: prevTermId,
        type: LedgerEntryType.BALANCE_CARRY_IN,
        direction: LedgerDirection.CREDIT,
        amount: 500_000n,
        description: 'Số dư có kỳ trước (fixture)',
      },
    })

    // A retake line: the failed attempt makes attemptType RETAKE, and LIET_SI freezes an 80% discount.
    const debt = await makeStudent(`90${suffix}02`, 'Sinh viên học lại', ['LIET_SI'])
    const course = await prisma.course.create({
      data: {
        code: `ZZ${suffix}`,
        name: 'Môn thử nghiệm học phí',
        type: 'THEORY',
        totalPeriods: 45,
        credits: 3,
      },
    })
    courseIds.push(course.id)
    const offered = await prisma.offeredCourse.create({
      data: { termId: mainTermId, courseId: course.id, credits: 3 },
    })
    offeredIds.push(offered.id)
    const section = await prisma.courseSection.create({
      data: {
        offeredCourseId: offered.id,
        trainingSystemId: (
          await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CQUI' } })
        ).id,
        code: `${course.code}.P1`,
        capacity: 10,
      },
    })
    sectionIds.push(section.id)
    await prisma.takenCourse.create({
      data: {
        studentId: debt.student.id,
        courseId: course.id,
        termId: prevTermId,
        courseScore: '3.0',
      },
    })
    const slot = await prisma.registrationSlot.create({
      data: {
        termId: mainTermId,
        name: 'Khoá 19',
        startAt: vn('2026-09-01', '08:00'),
        endAt: vn('2026-09-05', '17:00'),
        cohorts: {
          create: {
            cohortId: (await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })).id,
          },
        },
      },
    })
    slotIds.push(slot.id)
    await redis.del(`dkhp:rate:registration:${debt.user.id}`)
  })

  afterAll(async () => {
    if (feeScheduleId !== null)
      await prisma.feeSchedule.delete({ where: { id: feeScheduleId } }).catch(() => undefined)
    // The seeded append-only trigger blocks DELETE; lift it only for these fixture terms.
    await prisma.$executeRawUnsafe(
      'ALTER TABLE ledger_entry DISABLE TRIGGER ledger_entry_append_only',
    )
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE ledger_entry SET related_entry_id = NULL WHERE term_id IN (${termIds.join(',')})`,
      )
      await prisma.ledgerEntry.deleteMany({ where: { termId: { in: termIds } } })
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE ledger_entry ENABLE TRIGGER ledger_entry_append_only',
      )
    }
    await prisma.enrollment.deleteMany({ where: { sectionId: { in: sectionIds } } })
    await prisma.registrationForm.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.takenCourse.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.registrationSlotCohort.deleteMany({
      where: { registrationSlotId: { in: slotIds } },
    })
    await prisma.registrationSlot.deleteMany({ where: { id: { in: slotIds } } })
    await prisma.courseSection.deleteMany({ where: { id: { in: sectionIds } } })
    await prisma.offeredCourse.deleteMany({ where: { id: { in: offeredIds } } })
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    for (const termId of termIds)
      await prisma.term.delete({ where: { id: termId } }).catch(() => undefined)
    for (const year of academicYearIds)
      await prisma.academicYear.delete({ where: { id: year } }).catch(() => undefined)
    for (const open of parked)
      await prisma.term
        .update({ where: { id: open.id }, data: { phase: open.phase } })
        .catch(() => undefined)
    await redis.quit()
    await idempotency.onModuleDestroy()
    await prisma.onModuleDestroy()
  })

  it('HP-01: a missing fee schedule fails the whole transition and keeps the term in PREPARATION', async () => {
    clock.set(vn('2026-09-03', '10:00'))
    let warning = ''
    try {
      await service.advance({ termId: blockedTermId })
    } catch (error) {
      warning = (error as Error).message
    }
    expect(warning).toContain('Thiếu bảng phí')
    const blocked = await prisma.term.findUniqueOrThrow({ where: { id: blockedTermId } })
    expect(blocked.phase).toBe(TermPhase.PREPARATION)
    expect(
      await prisma.ledgerEntry.count({
        where: { termId: blockedTermId, type: LedgerEntryType.BASE_TUITION },
      }),
    ).toBe(0)
  })

  it('HP-02/HP-11: fixed debt in the transition transaction, none in summer, carried balance pair', async () => {
    const k20 = await prisma.cohort.findUniqueOrThrow({ where: { code: 'K20' } })
    const clc = await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CLC' } })
    const schedule = await prisma.feeSchedule.create({
      data: {
        cohortId: k20.id,
        trainingSystemId: clc.id,
        baseTuition: 15_500_000n,
      },
    })
    feeScheduleId = schedule.id

    clock.set(vn('2026-10-03', '10:00'))
    const summer = await service.advance({ termId: summerTermId })
    expect(summer.transitions).toEqual([
      { termCode: `${START_YEAR}3`, from: 'PREPARATION', to: 'REGISTRATION' },
    ])
    expect(
      await prisma.ledgerEntry.count({
        where: { termId: summerTermId, type: LedgerEntryType.BASE_TUITION },
      }),
    ).toBe(0)
    await prisma.term.update({ where: { id: summerTermId }, data: { phase: TermPhase.CLOSED } })

    clock.set(vn('2026-09-03', '10:00'))
    const main = await service.advance({ termId: mainTermId })
    expect(main.transitions).toEqual([
      { termCode: `${START_YEAR}2`, from: 'PREPARATION', to: 'REGISTRATION' },
    ])
    const students = await prisma.student.count()
    expect(
      await prisma.ledgerEntry.count({
        where: { termId: mainTermId, type: LedgerEntryType.BASE_TUITION },
      }),
    ).toBe(students)
    expect(
      await prisma.ledgerEntry.count({
        where: { termId: mainTermId, type: LedgerEntryType.DISCOUNT },
      }),
    ).toBeGreaterThanOrEqual(3) // 24520002, 24520004 and the 80% fixture student

    const carryStudent = await prisma.student.findUniqueOrThrow({
      where: { studentCode: `90${suffix}01` },
    })
    const out = await prisma.ledgerEntry.findFirstOrThrow({
      where: {
        studentId: carryStudent.id,
        termId: prevTermId,
        type: LedgerEntryType.BALANCE_CARRY_OUT,
      },
    })
    const incoming = await prisma.ledgerEntry.findFirstOrThrow({
      where: {
        studentId: carryStudent.id,
        termId: mainTermId,
        type: LedgerEntryType.BALANCE_CARRY_IN,
      },
    })
    expect(out.amount).toBe(500_000n)
    expect(incoming.amount).toBe(out.amount)
    expect(incoming.relatedEntryId).toBe(out.id)
    expect(out.direction).toBe(LedgerDirection.DEBIT)
    expect(incoming.direction).toBe(LedgerDirection.CREDIT)
  })

  it('HP-03/04/06/05: frozen credits and rate, surcharge + discount, then append-only reversals', async () => {
    const debt = await prisma.student.findUniqueOrThrow({
      where: { studentCode: `90${suffix}02` },
    })
    const result = await registration.register(debt.userId, key(), {
      sectionIds: [sectionIds[0]!],
    })
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[0]?.attemptType).toBe(AttemptType.RETAKE)
    const enrollmentId = result.results[0]!.enrollmentId!
    const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })
    expect([enrollment.credits, enrollment.creditRate, enrollment.surcharge]).toEqual([
      3,
      27_000n,
      81_000n,
    ])
    expect(enrollment.status).toBe(EnrollmentStatus.REGISTERED)

    const debit = await prisma.ledgerEntry.findFirstOrThrow({
      where: { enrollmentId, type: LedgerEntryType.SURCHARGE },
    })
    const discount = await prisma.ledgerEntry.findFirstOrThrow({
      where: { relatedEntryId: debit.id, type: LedgerEntryType.DISCOUNT },
    })
    expect(debit.amount).toBe(81_000n)
    expect(discount.amount).toBe(64_800n)
    expect(discount.discountRate).toBe(80)

    // HP-04: later fee-table edits cannot touch a frozen line or its ledger rows.
    const schedule = await prisma.feeSchedule.findUniqueOrThrow({ where: { id: feeScheduleId! } })
    await prisma.feeSchedule.update({
      where: { id: schedule.id },
      data: { theoryCreditRate: 99_000n },
    })
    const frozen = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } })
    expect([frozen.credits, frozen.creditRate, frozen.surcharge]).toEqual([3, 27_000n, 81_000n])

    await registration.cancel(debt.userId, key(), enrollmentId)
    const reversal = await prisma.ledgerEntry.findFirstOrThrow({
      where: { enrollmentId, type: LedgerEntryType.SURCHARGE_REVERSAL },
    })
    const discountReversal = await prisma.ledgerEntry.findFirstOrThrow({
      where: { relatedEntryId: discount.id, type: LedgerEntryType.DISCOUNT_REVERSAL },
    })
    expect(reversal.amount).toBe(debit.amount)
    expect(reversal.relatedEntryId).toBe(debit.id)
    expect(discountReversal.amount).toBe(discount.amount)
    expect(discountReversal.direction).toBe(LedgerDirection.DEBIT)

    const stillThere = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: debit.id } })
    expect(stillThere.amount).toBe(81_000n)
    const afterFirst = await prisma.ledgerEntry.count({ where: { enrollmentId } })
    await tuition.reverseSurcharge(prisma, {
      enrollmentId,
      studentId: debt.id,
      termId: mainTermId,
      sectionCode: `${suffix}`,
      at: vn('2026-09-04', '10:00'),
    })
    expect(await prisma.ledgerEntry.count({ where: { enrollmentId } })).toBe(afterFirst)

    const bm7 = await tuition.bm7(prisma, debt.id, mainTermId)
    expect(bm7.outstandingAmount).toBe(3_000_000) // base after 80% discount; surcharge and discount cancel out
  })
})
