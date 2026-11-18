import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/14'

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Test } from '@nestjs/testing'
import Redis from 'ioredis'
import type { INestApplication } from '@nestjs/common'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { RegistrationClock, RegistrationService } from '../src/registration/registration.service'
import { RegistrationIdempotency } from '../src/registration/idempotency'
import { PrismaService } from '../src/prisma/prisma.service'
import { DEMO_NOW } from '../prisma/seed/scenarios'

const PASSWORD = 'Dkhp@2026'
const suffix = randomUUID().slice(0, 6)
const codeBase = 40000000 + (parseInt(suffix, 16) % 1000000)

class FakeClock extends RegistrationClock {
  override now(): Date {
    return DEMO_NOW
  }
}

class EarlyClock extends RegistrationClock {
  override now(): Date {
    return new Date('2027-01-06T00:00:00.000Z')
  }
}

type Failure = { response?: { code?: string; message?: string } }
const failureOf = async (promise: Promise<unknown>): Promise<Failure> => {
  try {
    await promise
  } catch (error) {
    const response = (error as Failure).response
    if (response) return { response }
  }
  throw new Error('Expected the command to be rejected')
}

const vn = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`)

describe('registration (integration: Postgres dkhp_w46 + Redis 14, demo clock 06/01/2027 10:00)', () => {
  let prisma: PrismaService
  let service: RegistrationService
  let early: RegistrationService
  let idempotency: RegistrationIdempotency
  let redis: Redis
  let termId: number
  let cquiId: number
  let k19Id: number
  let raceSectionId: number
  let batchSectionId: number
  let reservedSectionId: number
  let k19AdmissionYear: number
  let testCourseId: number
  let offeredId: number
  let mainUser: number
  let clcUser: number
  let k20User: number
  let k18User: number
  const raceUsers: number[] = []
  const createdUserIds: number[] = []
  const createdStudentIds: number[] = []
  let keySequence = 0
  const key = () => `it-${suffix}-${++keySequence}`
  const section = (term: number, code: string) =>
    prisma.courseSection.findFirstOrThrow({ where: { code, offeredCourse: { termId: term } } })

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    idempotency = new RegistrationIdempotency()
    redis = new Redis('redis://localhost:6379/14', { maxRetriesPerRequest: 1 })
    service = new RegistrationService(prisma, new FakeClock(), idempotency)
    early = new RegistrationService(prisma, new EarlyClock(), idempotency)
    termId = (await prisma.term.findUniqueOrThrow({ where: { termCode: '20262' } })).id
    cquiId = (await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CQUI' } })).id
    const k19 = await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })
    k19Id = k19.id
    k19AdmissionYear = k19.admissionYear

    const course = await prisma.course.create({
      data: {
        code: `ZZ${suffix}`,
        name: 'Môn thử nghiệm đăng ký',
        type: 'THEORY',
        totalPeriods: 45,
        credits: 3,
      },
    })
    testCourseId = course.id
    const offered = await prisma.offeredCourse.create({
      data: { termId, courseId: course.id, credits: 3 },
    })
    offeredId = offered.id
    raceSectionId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: offered.id,
          trainingSystemId: cquiId,
          code: `${course.code}.R`,
          capacity: 50,
        },
      })
    ).id
    batchSectionId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: offered.id,
          trainingSystemId: cquiId,
          code: `${course.code}.B`,
          capacity: 5,
        },
      })
    ).id
    reservedSectionId = (
      await prisma.courseSection.create({
        data: {
          offeredCourseId: offered.id,
          trainingSystemId: cquiId,
          code: `${course.code}.K`,
          capacity: 3,
          reservedAdmissionYear: k19AdmissionYear,
        },
      })
    ).id

    const mains = ['24520001', '24520014', '25520010', '23520003']
    for (const studentCode of mains) {
      const student = await prisma.student.findUniqueOrThrow({ where: { studentCode } })
      if (studentCode === '24520001') mainUser = student.userId
      if (studentCode === '24520014') clcUser = student.userId
      if (studentCode === '25520010') k20User = student.userId
      if (studentCode === '23520003') k18User = student.userId
    }
    for (const userId of [mainUser, clcUser, k20User, k18User])
      await redis.del(`dkhp:rate:registration:${userId}`)

    const users = await prisma.user.createManyAndReturn({
      data: Array.from({ length: 200 }, (_, index) => ({
        username: `w${suffix}${index}`,
        passwordHash: 'not-used',
        fullName: `Thí sinh ${index}`,
        roles: ['STUDENT'],
        mustChangePassword: false,
      })),
    })
    const students = await prisma.student.createManyAndReturn({
      data: users.map((user, index) => ({
        userId: user.id,
        studentCode: String(codeBase + index),
        fullName: user.fullName,
        cohortId: k19Id,
        trainingSystemId: cquiId,
      })),
    })
    raceUsers.push(...students.map((student) => student.userId))
    createdUserIds.push(...users.map((user) => user.id))
    createdStudentIds.push(...students.map((student) => student.id))
  })

  afterAll(async () => {
    const sectionIds = [raceSectionId, batchSectionId, reservedSectionId]
    await prisma.enrollment.deleteMany({ where: { sectionId: { in: sectionIds } } })
    await prisma.registrationForm.deleteMany({ where: { studentId: { in: createdStudentIds } } })
    await prisma.courseSection.deleteMany({ where: { id: { in: sectionIds } } })
    await prisma.offeredCourse.delete({ where: { id: offeredId } })
    await prisma.course.delete({ where: { id: testCourseId } })
    await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    await redis.quit()
    await idempotency.onModuleDestroy()
    await prisma.onModuleDestroy()
  })

  it('DK-02: outside the cohort slot the list is still readable with a countdown, but a write is refused', async () => {
    const view = await early.overview(k20User, {})
    expect(view.sections.length).toBeGreaterThan(0)
    expect(view.permission.state).toBe('BEFORE_SLOT')
    expect(view.permission.countdownTo).toBe(vn('2027-01-07', '08:00').toISOString())
    const denied = await early.register(k20User, key(), { sectionIds: [batchSectionId] })
    expect(denied.results[0]?.code).toBe('DK-02')
    expect(denied.results[0]?.exit).toBeTruthy()
    const pastSlot = await early.overview(k18User, {})
    expect(pastSlot.permission.state).toBe('OUTSIDE_SLOT')
    expect(pastSlot.sections.length).toBeGreaterThan(0)
    const k19 = await service.overview(mainUser, {})
    expect(k19.permission.state).toBe('OPEN')
    expect(k19.permission.message).toContain('17:00')
  })

  it('DK-19/catalogue: only the student system is listed and every filter narrows the list', async () => {
    const all = await service.overview(mainUser, {})
    expect(all.student.trainingSystemCode).toBe('CQUI')
    expect(all.sections.some((item) => ['SE104.P23', 'SE104.P23.1'].includes(item.code))).toBe(
      false,
    )

    const q = await service.overview(mainUser, { q: `ZZ${suffix}` })
    expect(q.sections.length).toBe(3)
    expect(q.sections.every((item) => item.courseCode === `ZZ${suffix}`)).toBe(true)

    const available = await service.overview(mainUser, { available: true })
    expect(available.sections.some((item) => item.code === 'CS106.P21')).toBe(false)

    const day = await service.overview(mainUser, { day: 2 })
    expect(day.sections.some((item) => item.code === 'SE104.P21')).toBe(true)
    expect(day.sections.every((item) => item.days.includes(2))).toBe(true)

    const practice = await service.overview(mainUser, { courseType: 'PRACTICE' })
    expect(practice.sections.length).toBeGreaterThan(0)
    expect(practice.sections.every((item) => item.courseType === 'PRACTICE')).toBe(true)

    const reserved = await service.overview(mainUser, { reserved: true })
    expect(reserved.sections.map((item) => item.id)).toEqual([reservedSectionId])
  })

  it('DK-03/DK-19/DK-04/DK-09: each class returns its first failing rule with a way out', async () => {
    const summerTermId = (await prisma.term.findUniqueOrThrow({ where: { termCode: '20263' } })).id
    const summer = await section(summerTermId, 'IT003.P31')
    const otherSystem = await section(termId, 'SE104.P23')
    const duplicate = await section(termId, 'SE104.P21.2')
    const full = await section(termId, 'CS106.P21')

    const results = await service.register(mainUser, key(), {
      sectionIds: [summer.id, otherSystem.id, duplicate.id, full.id],
    })
    const byCode = new Map(results.results.map((result) => [result.code, result]))
    expect(byCode.get('DK-03')?.exit).toBeTruthy()
    expect(byCode.get('DK-19')?.exit).toBe('Chọn lớp cùng hệ đào tạo')
    expect(byCode.get('DK-04')?.exit).toBe('Mở phiếu để huỷ dòng cũ')
    expect(byCode.get('DK-09')?.exit).toBe('Chọn lớp khác còn chỗ')
    for (const result of results.results) {
      expect(result.ok).toBe(false)
      expect(result.message?.length).toBeGreaterThan(20)
    }
    const clc = await service.register(clcUser, key(), { sectionIds: [full.id] })
    expect(clc.results[0]?.code).toBe('DK-19')
  })

  it('DK-01/DK-18: the form appears on the first success and failing siblings do not roll it back', async () => {
    const before = await prisma.registrationForm.count({
      where: { studentId: { in: raceUsers.slice(0, 1) }, termId },
    })
    expect(before).toBe(0)
    const full = await section(termId, 'CS106.P21')
    const result = await service.register(raceUsers[0]!, key(), {
      sectionIds: [batchSectionId, full.id],
    })
    expect(result.results.map((item) => item.code)).toEqual([undefined, 'DK-09'])
    expect(result.form.rows).toHaveLength(1)
    expect(result.form.rows[0]?.sectionCode).toContain('.B')
    const enrollmentCount = await prisma.enrollment.count({
      where: { sectionId: batchSectionId, status: 'REGISTERED' },
    })
    expect(enrollmentCount).toBe(1)
  })

  it('NFR-04: replaying a key returns the same result; NFR-05 limits writes per student', async () => {
    const first = await service.register(raceUsers[1]!, key(), { sectionIds: [batchSectionId] })
    const replayKey = key()
    const original = await service.register(raceUsers[2]!, replayKey, {
      sectionIds: [batchSectionId],
    })
    const replay = await service.register(raceUsers[2]!, replayKey, {
      sectionIds: [batchSectionId],
    })
    expect(replay).toEqual(original)
    expect(first.results[0]?.ok).toBe(true)

    await redis.del(`dkhp:rate:registration:${clcUser}`)
    for (let index = 0; index < 20; index++)
      await service.register(clcUser, key(), { sectionIds: [-1] })
    const limited = await failureOf(service.register(clcUser, key(), { sectionIds: [-1] }))
    expect(limited.response?.code).toBe('RATE_LIMITED')
  })

  it('DK-13/DK-14: cancel returns the seat, moves the row to Đã huỷ, and there is no change route', async () => {
    const row = await prisma.enrollment.findFirstOrThrow({
      where: {
        sectionId: batchSectionId,
        status: 'REGISTERED',
        form: { studentId: createdStudentIds[0] },
      },
    })
    const cancelKey = key()
    const cancelled = await service.cancel(raceUsers[0]!, cancelKey, row.id)
    expect(cancelled.status).toBe('CANCELLED')
    expect(await service.cancel(raceUsers[0]!, cancelKey, row.id)).toEqual(cancelled)
    expect((await failureOf(service.cancel(raceUsers[0]!, key(), row.id))).response?.code).toBe(
      'ENROLLMENT_NOT_ACTIVE',
    )
    const view = await service.overview(raceUsers[0]!, {})
    expect(view.form.cancelled.some((item) => item.id === row.id)).toBe(true)
    expect(view.form.rows.some((item) => item.id === row.id)).toBe(false)
    const section = await prisma.courseSection.findUniqueOrThrow({ where: { id: batchSectionId } })
    expect(section.enrolledCount).toBe(
      await prisma.enrollment.count({
        where: { sectionId: batchSectionId, status: 'REGISTERED' },
      }),
    )
    const mainEnrollment = await prisma.enrollment.findFirstOrThrow({
      where: {
        form: {
          studentId: (await prisma.student.findUniqueOrThrow({ where: { userId: mainUser } })).id,
          termId,
        },
        status: 'REGISTERED',
      },
    })
    const outOfWindow = await failureOf(early.cancel(mainUser, key(), mainEnrollment.id))
    expect(outOfWindow.response?.code).toBe('OUTSIDE_REGISTRATION_WINDOW')
  })

  it('NFR-03: 200 students fight for 50 seats and exactly 50 win', async () => {
    const attempt = (index: number) =>
      service.register(raceUsers[index]!, `race-${suffix}-${index}`, {
        sectionIds: [raceSectionId],
      })
    const attempts = await Promise.allSettled(raceUsers.map((_, index) => attempt(index)))
    // A transaction that timed out under contention is safely replayed with the same key (NFR-04).
    const retry = attempts.flatMap((result, index) => (result.status === 'rejected' ? [index] : []))
    if (retry.length) {
      const replayed = await Promise.allSettled(retry.map(attempt))
      for (const [position, index] of retry.entries()) attempts[index] = replayed[position]!
    }
    expect(attempts.every((result) => result.status === 'fulfilled')).toBe(true)
    const winners = attempts.filter(
      (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof service.register>>> =>
        attempt.status === 'fulfilled' && attempt.value.results[0]?.ok === true,
    ).length
    expect(winners).toBe(50)

    const rows = await prisma.enrollment.count({
      where: { sectionId: raceSectionId, status: 'REGISTERED' },
    })
    const section = await prisma.courseSection.findUniqueOrThrow({ where: { id: raceSectionId } })
    expect(rows).toBe(50)
    expect(section.enrolledCount).toBe(50)
    expect(winners).toBe(rows)
  })

  it('HTTP: a student can read the page, must send an idempotency key, and cannot change a section', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RegistrationClock)
      .useValue(new FakeClock())
      .compile()
    const app: INestApplication = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const port = (app.getHttpServer() as { address(): AddressInfo | null }).address()?.port
    const base = `http://127.0.0.1:${port}/api`
    try {
      const login = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: '24520001', password: PASSWORD }),
      })
      expect(login.status).toBe(200)
      const cookie = (login.headers.get('set-cookie') ?? '').split(/,\s*/)[0]!.split(';')[0]!
      const view = await fetch(`${base}/registration`, { headers: { cookie } })
      expect(view.status).toBe(200)
      const body = (await view.json()) as { permission: { state: string }; sections: unknown[] }
      expect(body.permission.state).toBe('OPEN')
      expect(body.sections.length).toBeGreaterThan(0)

      const withoutKey = await fetch(`${base}/registration/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ sectionIds: [batchSectionId] }),
      })
      expect(withoutKey.status).toBe(400)
      expect(withoutKey.headers.get('content-type')).toContain('json')

      const change = await fetch(`${base}/registration/enrollments/1/change`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ sectionId: raceSectionId }),
      })
      expect(change.status).toBe(404)
    } finally {
      await app.close()
    }
  })
})
