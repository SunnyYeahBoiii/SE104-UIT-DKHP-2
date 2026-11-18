import 'reflect-metadata'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { Queue } from 'bullmq'

import { Clock } from '../src/academics/clock'
import { EnrollmentStatus, Role, TermPhase, TermType } from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { TermPhaseService, type TermRegistrationHook } from '../src/term-phases/term-phase.service'
import { ADVANCE_JOB, TermPhaseScheduler } from '../src/term-phases/term-phase.worker'

const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)
const suffix = Date.now().toString(36).toUpperCase()
// HK-01: the DB check requires four year digits followed by 1, 2 or 3.
const startYear = 8000 + (Date.now() % 999)
const termCode = `${startYear}1`

const MILESTONES = {
  registrationStartAt: vn('2027-03-01', '08:00'),
  registrationEndAt: vn('2027-03-05', '17:00'),
  adjustmentStartAt: vn('2027-03-10', '08:00'),
  adjustmentEndAt: vn('2027-03-15', '17:00'),
  tuitionDeadline: vn('2027-04-30', '17:00'),
  finalExamStartAt: vn('2027-06-01', '07:00'),
}

class MutableClock extends Clock {
  current = vn('2027-02-01', '08:00')
  override now(): Date {
    return this.current
  }
  set(date: Date): void {
    this.current = date
  }
}

type HookCall = { termCode: string; phaseInsideTransaction: string }

describe('term phase job (integration: Postgres dkhp_w43, moving fake clock)', () => {
  let prisma: PrismaService
  let clock: MutableClock
  let service: TermPhaseService
  let termId: number
  let studentIds: [number, number]
  let formIds: [number, number]
  let sectionIds: [number, number]
  let offeredIds: number[]
  let userIds: number[]
  let academicYearId: number
  let ready = false
  let parked = false
  let openTerms: { id: number; phase: TermPhase }[] = []
  const hookCalls: HookCall[] = []

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    clock = new MutableClock()

    const cohort = await prisma.cohort.findFirstOrThrow()
    const system = await prisma.trainingSystem.findFirstOrThrow()
    const cs106 = await prisma.course.findUniqueOrThrow({ where: { code: 'CS106' } })
    const ss003 = await prisma.course.findUniqueOrThrow({ where: { code: 'SS003' } })
    expect([cs106.credits, ss003.credits]).toEqual([3, 2])

    // HK-04: only one term may be open at a time. Park the seeded open term(s) while this fixture
    // walks its own timeline; afterAll puts them back exactly as found.
    openTerms = await prisma.term.findMany({
      where: { phase: { in: ['REGISTRATION', 'ADJUSTMENT'] } },
      select: { id: true, phase: true },
    })
    for (const open of openTerms)
      await prisma.term.update({ where: { id: open.id }, data: { phase: 'CLOSED' } })
    parked = true

    const academicYear = await prisma.academicYear.create({ data: { startYear } })
    academicYearId = academicYear.id
    const term = await prisma.term.create({
      data: {
        academicYearId,
        type: TermType.SECOND,
        termCode,
        phase: 'PREPARATION',
        startDate: new Date('2027-03-08T00:00:00.000Z'),
        ...MILESTONES,
        minCredits: 4,
        maxCredits: 12,
      },
    })
    termId = term.id

    const hook: TermRegistrationHook = {
      async onEnterRegistration(tx, entered) {
        // The phase change and the hook must see the same uncommitted state.
        const row = await tx.term.findUniqueOrThrow({ where: { id: entered.id } })
        hookCalls.push({ termCode: entered.termCode, phaseInsideTransaction: row.phase })
      },
    }
    service = new TermPhaseService(prisma, clock, hook)

    const offeredIdsLocal: number[] = []
    const sectionIdsLocal: number[] = []
    for (const course of [cs106, ss003]) {
      const offered = await prisma.offeredCourse.create({
        data: { termId, courseId: course.id, credits: course.credits },
      })
      offeredIdsLocal.push(offered.id)
      const section = await prisma.courseSection.create({
        data: {
          offeredCourseId: offered.id,
          trainingSystemId: system.id,
          code: `T43-${course.code}`,
          capacity: 10,
        },
      })
      sectionIdsLocal.push(section.id)
    }
    offeredIds = offeredIdsLocal
    sectionIds = sectionIdsLocal as [number, number]

    const studentIdsLocal: number[] = []
    const userIdsLocal: number[] = []
    const formIdsLocal: number[] = []
    for (const label of ['A', 'B']) {
      const user = await prisma.user.create({
        data: {
          username: `t43-${suffix}-${label}`,
          passwordHash: 'not-used',
          fullName: `Term phase test ${label}`,
          roles: [Role.STUDENT],
        },
      })
      userIdsLocal.push(user.id)
      const student = await prisma.student.create({
        data: {
          studentCode: `T43${suffix}${label}`,
          userId: user.id,
          fullName: `Term phase test ${label}`,
          cohortId: cohort.id,
          trainingSystemId: system.id,
        },
      })
      studentIdsLocal.push(student.id)
      const form = await prisma.registrationForm.create({
        data: { studentId: student.id, termId },
      })
      formIdsLocal.push(form.id)
    }
    studentIds = studentIdsLocal as [number, number]
    userIds = userIdsLocal
    formIds = formIdsLocal as [number, number]

    // A: 3 + 2 = 5 ≥ minCredits 4. B: 2 < 4 → warning only.
    const enrollments = [
      { formId: formIds[0], sectionId: sectionIds[0], courseId: cs106.id, credits: cs106.credits },
      { formId: formIds[0], sectionId: sectionIds[1], courseId: ss003.id, credits: ss003.credits },
      { formId: formIds[1], sectionId: sectionIds[1], courseId: ss003.id, credits: ss003.credits },
    ]
    await prisma.enrollment.createMany({
      data: enrollments.map((row) => ({
        ...row,
        status: EnrollmentStatus.REGISTERED,
        attemptType: 'FIRST',
        creditRate: 27_000n,
      })),
    })
    ready = true
  }, 30_000)

  afterAll(async () => {
    if (!prisma) return
    if (ready) {
      await prisma.creditWarning.deleteMany({ where: { termId } })
      await prisma.enrollment.deleteMany({ where: { formId: { in: formIds } } })
      await prisma.registrationForm.deleteMany({ where: { id: { in: formIds } } })
      await prisma.courseSection.deleteMany({ where: { id: { in: sectionIds } } })
      await prisma.offeredCourse.deleteMany({ where: { id: { in: offeredIds } } })
      await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      await prisma.term.delete({ where: { id: termId } })
      await prisma.academicYear.delete({ where: { id: academicYearId } })
    }
    // Restore even when setup aborted halfway, so a failed run cannot poison the next one.
    if (parked)
      for (const open of openTerms)
        await prisma.term.update({ where: { id: open.id }, data: { phase: open.phase } })
    await prisma.onModuleDestroy()
  })

  const phase = async () => (await prisma.term.findUniqueOrThrow({ where: { id: termId } })).phase

  it('HK-03: stays in Chuẩn bị before the first milestone', async () => {
    const result = await service.advance({ termId })
    expect(result.transitions).toEqual([])
    expect(await phase()).toBe('PREPARATION')
    expect(hookCalls).toHaveLength(0)
  })

  it('HK-03: enters Đăng ký at the milestone and fires the tuition hook inside that transaction', async () => {
    clock.set(MILESTONES.registrationStartAt)
    const result = await service.advance({ termId })
    expect(result.transitions).toEqual([{ termCode, from: 'PREPARATION', to: 'REGISTRATION' }])
    expect(await phase()).toBe('REGISTRATION')
    expect(hookCalls).toEqual([{ termCode, phaseInsideTransaction: 'REGISTRATION' }])
  })

  it('HK-03: a repeat at the same instant changes nothing', async () => {
    const result = await service.advance({ termId })
    expect(result.transitions).toEqual([])
    expect(hookCalls).toHaveLength(1)
  })

  it('HK-03: walks on to Điều chỉnh, then Đang học, without ever moving backwards', async () => {
    clock.set(MILESTONES.adjustmentStartAt)
    expect((await service.advance({ termId })).transitions[0]?.to).toBe('ADJUSTMENT')
    expect(await phase()).toBe('ADJUSTMENT')

    clock.set(MILESTONES.adjustmentEndAt)
    expect((await service.advance({ termId })).transitions[0]?.to).toBe('IN_PROGRESS')
    expect(await phase()).toBe('IN_PROGRESS')

    clock.set(vn('2027-05-01'))
    expect((await service.advance({ termId })).transitions).toEqual([])
    expect(await phase()).toBe('IN_PROGRESS')
    clock.set(vn('2027-02-01', '08:00'))
    expect((await service.advance({ termId })).transitions).toEqual([])
    expect(await phase()).toBe('IN_PROGRESS')
  })

  it('DK-15: closes forms and enrollments when Điều chỉnh ends', async () => {
    const forms = await prisma.registrationForm.findMany({ where: { termId } })
    expect(forms).toHaveLength(2)
    expect(
      forms.every((form) => form.finalizedAt?.getTime() === MILESTONES.adjustmentEndAt.getTime()),
    ).toBe(true)
    const rows = await prisma.enrollment.findMany({ where: { formId: { in: formIds } } })
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.status === EnrollmentStatus.FINALIZED)).toBe(true)
    expect(
      rows.every((row) => row.finalizedAt?.getTime() === MILESTONES.adjustmentEndAt.getTime()),
    ).toBe(true)
  })

  it('DK-08: only the under-minimum form is flagged, as a warning', async () => {
    const warnings = await prisma.creditWarning.findMany({ where: { termId } })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      studentId: studentIds[1],
      credits: 2,
      minCredits: 4,
    })
  })

  it('HK-03/DK-15: two simultaneous reruns and a later rerun are exact no-ops', async () => {
    const before = {
      phase: await phase(),
      forms: await prisma.registrationForm.findMany({ where: { termId } }),
      enrollments: await prisma.enrollment.findMany({ where: { formId: { in: formIds } } }),
      warnings: await prisma.creditWarning.findMany({ where: { termId } }),
      hookCalls: [...hookCalls],
    }
    await Promise.all([service.advance({ termId }), service.advance({ termId })])
    await service.advance({ termId })

    expect({
      phase: await phase(),
      forms: await prisma.registrationForm.findMany({ where: { termId } }),
      enrollments: await prisma.enrollment.findMany({ where: { formId: { in: formIds } } }),
      warnings: await prisma.creditWarning.findMany({ where: { termId } }),
      hookCalls: [...hookCalls],
    }).toEqual(before)
    expect(hookCalls).toHaveLength(1)
  })

  it('HK-03: the conditional update is checked at the SQL level', async () => {
    const stale = await prisma.term.findUniqueOrThrow({ where: { id: termId } })
    const lost = await prisma.term.updateMany({
      where: { id: termId, phase: 'PREPARATION' },
      data: { phase: 'CLOSED' },
    })
    expect(lost.count).toBe(0)
    expect((await prisma.term.findUniqueOrThrow({ where: { id: termId } })).phase).toBe(stale.phase)
  })
})

describe('HK-03: repeatable term-phase job', () => {
  it('declares the same one-minute schedule on every boot; BullMQ dedupes it by id', async () => {
    const calls: unknown[][] = []
    const queue = {
      upsertJobScheduler(...args: unknown[]) {
        calls.push(args)
        return Promise.resolve()
      },
    } as unknown as Queue

    await new TermPhaseScheduler(queue).onApplicationBootstrap()
    await new TermPhaseScheduler(queue).onApplicationBootstrap()

    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call[0]).toBe('term-phases:every-minute')
      expect(call[1]).toEqual({ every: 60_000 })
      expect((call[2] as { name: string }).name).toBe(ADVANCE_JOB)
    }
  })
})
