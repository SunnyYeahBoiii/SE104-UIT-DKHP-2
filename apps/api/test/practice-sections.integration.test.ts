import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/15'

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { AttemptType } from '../src/generated/prisma/enums'
import { RegistrationIdempotency } from '../src/registration/idempotency'
import { RegistrationClock, RegistrationService } from '../src/registration/registration.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { DEMO_NOW } from '../prisma/seed/scenarios'
import { ReceivingAccountService } from '../src/finance/receiving-account.service'
import { TuitionService } from '../src/tuition/tuition.service'
import { clearRegistrationRateLimits } from './fixtures/rate-limit'

class FakeClock extends RegistrationClock {
  override now(): Date {
    return DEMO_NOW
  }
}

const suffix = randomUUID().slice(0, 6)
const code = `ZY${suffix}`
const numberBase = 42000000 + (parseInt(suffix, 16) % 1000000) * 10

describe('practice sections and retake split (integration: Postgres dkhp_w47 + Redis 15)', () => {
  let prisma: PrismaService
  let service: RegistrationService
  let idempotency: RegistrationIdempotency
  let redis: Redis
  let termId: number
  let userIds: number[] = []
  let studentIds: number[] = []
  let fullParentId: number
  let fullChildId: number
  let fullChildId2: number
  let freeParentId: number
  let freeChildId: number
  let theoryCourseId: number
  let practiceCourseId: number
  let theoryOfferedId: number
  let practiceOfferedId: number
  let seedSectionIds: number[] = []
  let keySequence = 0
  const key = () => `ps-${suffix}-${++keySequence}`
  const sectionId = async (sectionCode: string) =>
    (
      await prisma.courseSection.findFirstOrThrow({
        where: { code: sectionCode, offeredCourse: { termId } },
      })
    ).id
  const seats = async (id: number) =>
    (await prisma.courseSection.findUniqueOrThrow({ where: { id } })).enrolledCount

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    idempotency = new RegistrationIdempotency()
    await clearRegistrationRateLimits()
    redis = new Redis('redis://localhost:6379/15', { maxRetriesPerRequest: 1 })
    service = new RegistrationService(
      prisma,
      new FakeClock(),
      idempotency,
      new TuitionService(prisma, new ReceivingAccountService(prisma)),
    )
    termId = (await prisma.term.findUniqueOrThrow({ where: { termCode: '20262' } })).id
    const cqui = await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CQUI' } })
    const k19 = await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })

    const users = await prisma.user.createManyAndReturn({
      data: Array.from({ length: 5 }, (_, index) => ({
        username: `ps${suffix}${index}`,
        passwordHash: 'not-used',
        fullName: `Sinh viên thử nghiệm ${index}`,
        roles: ['STUDENT'],
        mustChangePassword: false,
      })),
    })
    userIds = users.map((user) => user.id)
    const students = await prisma.student.createManyAndReturn({
      data: users.map((user, index) => ({
        userId: user.id,
        studentCode: String(numberBase + index),
        fullName: user.fullName,
        cohortId: k19.id,
        trainingSystemId: cqui.id,
      })),
    })
    studentIds = students.map((student) => student.id)

    const theory = await prisma.course.create({
      data: { code, name: 'LT thử nghiệm nhóm', type: 'THEORY', totalPeriods: 45, credits: 3 },
    })
    const practice = await prisma.course.create({
      data: {
        code: `${code}TH`,
        name: 'TH thử nghiệm nhóm',
        type: 'PRACTICE',
        totalPeriods: 30,
        credits: 1,
        companionTheoryCourseId: theory.id,
      },
    })
    theoryCourseId = theory.id
    practiceCourseId = practice.id
    theoryOfferedId = (
      await prisma.offeredCourse.create({ data: { termId, courseId: theory.id, credits: 3 } })
    ).id
    practiceOfferedId = (
      await prisma.offeredCourse.create({ data: { termId, courseId: practice.id, credits: 1 } })
    ).id
    fullParentId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: theoryOfferedId,
          trainingSystemId: cqui.id,
          code: `${code}.P`,
          capacity: 1,
          practiceMode: 'SCHEDULED',
        },
      })
    ).id
    fullChildId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: practiceOfferedId,
          trainingSystemId: cqui.id,
          code: `${code}.P.1`,
          capacity: 5,
          parentSectionId: fullParentId,
        },
      })
    ).id
    fullChildId2 = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: practiceOfferedId,
          trainingSystemId: cqui.id,
          code: `${code}.P.2`,
          capacity: 1,
          parentSectionId: fullParentId,
        },
      })
    ).id
    freeParentId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: theoryOfferedId,
          trainingSystemId: cqui.id,
          code: `${code}.Q`,
          capacity: 5,
          practiceMode: 'SELF_SCHEDULED',
        },
      })
    ).id
    freeChildId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: practiceOfferedId,
          trainingSystemId: cqui.id,
          code: `${code}.Q.1`,
          capacity: 5,
          parentSectionId: freeParentId,
        },
      })
    ).id

    const fillerForm = await prisma.registrationForm.create({
      data: { studentId: studentIds[4]!, termId },
    })
    await prisma.enrollment.createMany({
      data: [
        {
          formId: fillerForm.id,
          sectionId: fullParentId,
          courseId: theory.id,
          status: 'REGISTERED',
          attemptType: AttemptType.FIRST,
          credits: 3,
          creditRate: 27000n,
        },
        {
          formId: fillerForm.id,
          sectionId: fullChildId2,
          courseId: practice.id,
          status: 'REGISTERED',
          attemptType: AttemptType.FIRST,
          credits: 1,
          creditRate: 37000n,
        },
      ],
    })
    await prisma.$executeRaw`UPDATE course_section SET enrolled_count = 1 WHERE id IN (${fullParentId}, ${fullChildId2})`

    const past = await prisma.term.findUniqueOrThrow({ where: { termCode: '20251' } })
    const past2 = await prisma.term.findUniqueOrThrow({ where: { termCode: '20252' } })
    const se004 = await prisma.course.findUniqueOrThrow({ where: { code: 'SE004' } })
    const it002 = await prisma.course.findUniqueOrThrow({ where: { code: 'IT002' } })
    const it002th = await prisma.course.findUniqueOrThrow({ where: { code: 'IT002TH' } })
    await prisma.takenCourse.createMany({
      data: [
        { studentId: studentIds[1]!, courseId: se004.id, termId: past.id, courseScore: 8 },
        { studentId: studentIds[2]!, courseId: it002.id, termId: past.id, courseScore: 4 },
        { studentId: studentIds[2]!, courseId: it002th.id, termId: past2.id, courseScore: 8 },
      ],
    })
    seedSectionIds = await Promise.all([
      sectionId('SE104.P21.2'),
      sectionId('IT002.P21'),
      sectionId('CE119.P21.1'),
    ])
  })

  afterAll(async () => {
    const forms = await prisma.registrationForm.findMany({
      where: { studentId: { in: studentIds } },
      select: { id: true },
    })
    // #51 posts surcharges on register; the ledger is append-only (ADR-0004), so the fixture
    // cleanup lifts the trigger the same way the tuition suite does.
    if (studentIds.length > 0) {
      const ids = studentIds.join(',')
      await prisma.$executeRawUnsafe(
        'ALTER TABLE ledger_entry DISABLE TRIGGER ledger_entry_append_only',
      )
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE ledger_entry SET related_entry_id = NULL WHERE student_id IN (${ids})`,
        )
        await prisma.ledgerEntry.deleteMany({ where: { studentId: { in: studentIds } } })
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE ledger_entry ENABLE TRIGGER ledger_entry_append_only',
        )
      }
    }
    await prisma.enrollment.deleteMany({
      where: { formId: { in: forms.map((form) => form.id) } },
    })
    await prisma.enrollment.deleteMany({
      where: { sectionId: { in: [fullParentId, fullChildId2] } },
    })
    await prisma.registrationForm.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.takenCourse.deleteMany({ where: { studentId: { in: studentIds } } })
    await prisma.courseSection.deleteMany({
      where: { id: { in: [fullParentId, fullChildId, fullChildId2, freeParentId, freeChildId] } },
    })
    await prisma.offeredCourse.deleteMany({
      where: { id: { in: [theoryOfferedId, practiceOfferedId] } },
    })
    await prisma.course.deleteMany({ where: { id: { in: [theoryCourseId, practiceCourseId] } } })
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    for (const id of seedSectionIds)
      await prisma.$executeRaw`
        UPDATE course_section SET enrolled_count =
          (SELECT count(*)::int FROM enrollment WHERE section_id = ${id} AND status <> 'CANCELLED')
        WHERE id = ${id}`
    await redis.quit()
    await idempotency.onModuleDestroy()
    await prisma.onModuleDestroy()
  })

  it('DK-11: a group outside the form and the batch is refused, before the full-seat rule', async () => {
    const result = await service.register(userIds[0]!, key(), { sectionIds: [fullChildId] })
    expect(result.results[0]?.code).toBe('DK-11')
    expect(result.results[0]?.exit).toBe('Chọn nhóm của lớp LT trong phiếu')
    expect(result.form.rows).toHaveLength(0)

    const full = await service.register(userIds[0]!, key(), { sectionIds: [fullChildId2] })
    expect(full.results[0]?.code).toBe('DK-11')
    expect(await seats(fullChildId2)).toBe(1)
  })

  it('DK-11/DK-18: a failed theory parent makes its same-batch group fail with the parent reason', async () => {
    const result = await service.register(userIds[0]!, key(), {
      sectionIds: [fullChildId, fullParentId],
    })
    expect(result.results[0]?.code).toBe('DK-11')
    expect(result.results[0]?.message).toContain('Lớp LT cha không đăng ký được')
    expect(result.results[0]?.exit).toBe('Đăng ký lại lớp LT cha')
    expect(result.results[1]?.code).toBe('DK-09')
    expect(result.form.rows).toHaveLength(0)
    expect(await seats(fullChildId)).toBe(0)
  })

  it('DK-11/DK-18: the same-batch group succeeds child-first and takes one seat per row', async () => {
    const result = await service.register(userIds[0]!, key(), {
      sectionIds: [freeChildId, freeParentId],
    })
    expect(result.results.map((item) => item.ok)).toEqual([true, true])
    expect(result.form.rows.map((row) => row.sectionCode)).toEqual([`${code}.Q`, `${code}.Q.1`])
    expect(await seats(freeParentId)).toBe(1)
    expect(await seats(freeChildId)).toBe(1)
  })

  it('DK-14/DK-11: cancelling the group cancels its parent and returns both seats', async () => {
    const form = await prisma.registrationForm.findUniqueOrThrow({
      where: { studentId_termId: { studentId: studentIds[0]!, termId } },
    })
    const child = await prisma.enrollment.findFirstOrThrow({
      where: { formId: form.id, sectionId: freeChildId, status: 'REGISTERED' },
    })
    const result = await service.cancel(userIds[0]!, key(), child.id)
    expect(result.cancelledEnrollments).toHaveLength(2)
    expect(result.cancelledEnrollments.map((row) => row.sectionCode).sort()).toEqual(
      [`${code}.Q`, `${code}.Q.1`].sort(),
    )
    const view = await service.overview(userIds[0]!, {})
    expect(view.form.rows).toHaveLength(0)
    expect(view.form.cancelled).toHaveLength(2)
    expect(await seats(freeParentId)).toBe(0)
    expect(await seats(freeChildId)).toBe(0)
  })

  it('DK-11/DK-14: cancelling the parent cancels its group in the same transaction', async () => {
    const registered = await service.register(userIds[3]!, key(), {
      sectionIds: [freeParentId, freeChildId],
    })
    expect(registered.results.every((item) => item.ok)).toBe(true)
    const parent = await prisma.enrollment.findFirstOrThrow({
      where: { sectionId: freeParentId, status: 'REGISTERED', form: { studentId: studentIds[3]! } },
    })
    const result = await service.cancel(userIds[3]!, key(), parent.id)
    expect(result.cancelledEnrollments).toHaveLength(2)
    expect(await seats(freeParentId)).toBe(0)
    expect(await seats(freeChildId)).toBe(0)
    expect(
      await prisma.enrollment.count({
        where: { sectionId: { in: [freeParentId, freeChildId] }, status: 'REGISTERED' },
      }),
    ).toBe(0)
  })

  it('DK-12: a passed equivalent theory course allows any theory section’s group', async () => {
    const group = await sectionId('SE104.P21.2')
    const result = await service.register(userIds[1]!, key(), { sectionIds: [group] })
    expect(result.results[0]?.ok).toBe(true)
    expect(result.form.rows.map((row) => row.sectionCode)).toEqual(['SE104.P21.2'])
  })

  it('DK-12: a passed practice part leaves the theory registration independent', async () => {
    const theory = await sectionId('IT002.P21')
    const result = await service.register(userIds[2]!, key(), { sectionIds: [theory] })
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[0]?.attemptType).toBe(AttemptType.RETAKE)
    expect(result.form.rows.map((row) => row.sectionCode)).toEqual(['IT002.P21'])
  })

  it('DK-11: a standalone practice course registers as an ordinary section', async () => {
    const standalone = await sectionId('CE119.P21.1')
    const result = await service.register(userIds[3]!, key(), { sectionIds: [standalone] })
    expect(result.results[0]?.ok).toBe(true)
    expect(result.form.rows.map((row) => row.sectionCode)).toEqual(['CE119.P21.1'])
  })
})
