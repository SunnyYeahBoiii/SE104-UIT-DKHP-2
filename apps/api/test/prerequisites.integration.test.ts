import 'reflect-metadata'

process.env.REGISTRATION_REDIS_URL = 'redis://localhost:6379/14'

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { Clock } from '../src/academics/clock'
import { PrismaService } from '../src/prisma/prisma.service'
import { RegistrationIdempotency } from '../src/registration/idempotency'
import {
  PrerequisiteReviewService,
  type ReviewResult,
} from '../src/registration/prerequisite-review.service'
import { RegistrationClock, RegistrationService } from '../src/registration/registration.service'
import { DEMO_NOW } from '../prisma/seed/scenarios'

const suffix = randomUUID().slice(0, 6)
const vn = (date: string, time = '00:00') => new Date(`${date}T${time}:00+07:00`)

class FakeClock extends RegistrationClock {
  override now(): Date {
    return DEMO_NOW
  }
}

class FakeBaseClock extends Clock {
  override now(): Date {
    return DEMO_NOW
  }
}

describe('prerequisites & conditional registration (integration: dkhp_w48 + Redis 14)', () => {
  let prisma: PrismaService
  let service: RegistrationService
  let review: PrerequisiteReviewService
  let redis: Redis
  let idempotency: RegistrationIdempotency
  let openTermId: number
  let closedTermId: number
  let se104Id: number
  let closedSe104SectionId: number
  let se100SectionId: number
  let se100PracticeId: number
  let se113SectionId: number
  let cquiId: number
  let k19Id: number
  const students: {
    label: string
    userId: number
    studentId: number
    pastEnrollmentId: number | null
  }[] = []
  const touchedSections: number[] = []
  let keySequence = 0
  const key = () => `prereq-${suffix}-${++keySequence}`

  /** `score === undefined` means no attempt at all; `null` means an attempt with no grade yet. */
  async function makeStudent(label: string, score: string | null | undefined) {
    const user = await prisma.user.create({
      data: {
        username: `pq${suffix}${students.length}`,
        passwordHash: 'not-used',
        fullName: `SV thử nghiệm ${label}`,
        roles: ['STUDENT'],
        mustChangePassword: false,
      },
    })
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        studentCode: `9${suffix}${students.length}`,
        fullName: user.fullName,
        cohortId: k19Id,
        trainingSystemId: cquiId,
      },
    })
    let pastEnrollmentId: number | null = null
    if (score !== undefined) {
      const form = await prisma.registrationForm.create({
        data: {
          studentId: student.id,
          termId: closedTermId,
          finalizedAt: vn('2026-09-18', '17:00'),
        },
      })
      const past = await prisma.enrollment.create({
        data: {
          formId: form.id,
          sectionId: closedSe104SectionId,
          courseId: se104Id,
          status: 'FINALIZED',
          attemptType: 'FIRST',
          credits: 3,
          creditRate: 27_000n,
          surcharge: 0n,
          courseScore: score,
          finalizedAt: vn('2026-09-18', '17:00'),
        },
      })
      pastEnrollmentId = past.id
    }
    const fixture = { label, userId: user.id, studentId: student.id, pastEnrollmentId }
    students.push(fixture)
    return fixture
  }

  const setScore = (student: (typeof students)[number], score: string) =>
    prisma.enrollment.update({
      where: { id: student.pastEnrollmentId! },
      data: { courseScore: score },
    })

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    idempotency = new RegistrationIdempotency()
    redis = new Redis('redis://localhost:6379/14', { maxRetriesPerRequest: 1 })
    service = new RegistrationService(prisma, new FakeClock(), idempotency)
    review = new PrerequisiteReviewService(prisma, new FakeBaseClock(), service)
    openTermId = (await prisma.term.findUniqueOrThrow({ where: { termCode: '20262' } })).id
    closedTermId = (await prisma.term.findUniqueOrThrow({ where: { termCode: '20261' } })).id
    cquiId = (await prisma.trainingSystem.findUniqueOrThrow({ where: { code: 'CQUI' } })).id
    k19Id = (await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })).id
    se104Id = (await prisma.course.findUniqueOrThrow({ where: { code: 'SE104' } })).id
    const sectionCode = async (code: string) =>
      prisma.courseSection.findFirstOrThrow({
        where: { code, offeredCourse: { termId: openTermId } },
      })
    se100SectionId = (await sectionCode('SE100.P21')).id
    se100PracticeId = (await sectionCode('SE100.P21.1')).id
    se113SectionId = (await sectionCode('SE113.P21')).id
    closedSe104SectionId = (
      await prisma.courseSection.findFirstOrThrow({
        where: { code: 'SE104.P11', offeredCourse: { termId: closedTermId } },
      })
    ).id
    touchedSections.push(se100SectionId, se100PracticeId, se113SectionId)
  })

  afterAll(async () => {
    for (const sectionId of touchedSections)
      await prisma.$executeRaw`
        UPDATE course_section s SET enrolled_count = (
          SELECT count(*)::int FROM enrollment e
          WHERE e.section_id = s.id AND e.status <> 'CANCELLED')
        WHERE s.id = ${sectionId}`
    await redis.quit()
    await idempotency.onModuleDestroy()
    await prisma.onModuleDestroy()
  })

  it('DK-05: a missing prerequisite is rejected at its DK-10 position with the right reason', async () => {
    const student = await makeStudent('thiếu', undefined)
    const missingPass = await service.register(student.userId, key(), {
      sectionIds: [se100SectionId],
    })
    expect(missingPass.results[0]?.code).toBe('DK-05')
    expect(missingPass.results[0]?.message).toContain('Cần Đạt SE104')
    expect(missingPass.results[0]?.exit).toBe('Liên hệ Phòng Đào tạo')
    const missingAttempt = await service.register(student.userId, key(), {
      sectionIds: [se113SectionId],
    })
    expect(missingAttempt.results[0]?.message).toContain('Cần học trước SE104')
    expect(missingAttempt.results[0]?.ok).toBe(false)
    const view = await service.overview(student.userId, {})
    expect(view.sections.find((s) => s.id === se100SectionId)?.prerequisite).toEqual({
      state: 'MISSING',
      message: 'Cần Đạt SE104',
    })
    expect(view.sections.find((s) => s.id === se113SectionId)?.prerequisite).toEqual({
      state: 'MISSING',
      message: 'Cần học trước SE104',
    })
  })

  it('KQ-02/DK-05: a passed prerequisite is accepted as a normal line', async () => {
    const student = await makeStudent('đạt', '8.0')
    const result = await service.register(student.userId, key(), {
      sectionIds: [se100SectionId],
    })
    expect(result.results[0]?.ok).toBe(true)
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { id: result.results[0]!.enrollmentId! },
    })
    expect(row.pendingPrerequisite).toBe(false)
    const view = await service.overview(student.userId, {})
    expect(view.sections.find((s) => s.id === se100SectionId)?.prerequisite).toEqual({
      state: 'OK',
      message: null,
    })
  })

  it('DK-05: no grade yet is accepted conditionally and surfaced on the card and the form', async () => {
    const student = await makeStudent('chưa có điểm', null)
    const result = await service.register(student.userId, key(), {
      sectionIds: [se100SectionId, se100PracticeId],
    })
    expect(result.results.map((item) => item.ok)).toEqual([true, true])
    expect(result.form.rows.filter((row) => row.pendingPrerequisite)).toHaveLength(1)
    const view = await service.overview(student.userId, {})
    expect(view.sections.find((s) => s.id === se100SectionId)?.prerequisite).toEqual({
      state: 'CONDITIONAL',
      message: 'Đăng ký có điều kiện: SE104 đang học, chưa có điểm',
    })

    const untouched = await review.review()
    expect(untouched.cancelled).toBe(0)
    expect(
      (await prisma.enrollment.findUniqueOrThrow({ where: { id: result.form.rows[0]!.id } }))
        .pendingPrerequisite,
    ).toBe(true)

    await setScore(student, '8.0')
    const afterGrade = await review.review()
    expect(afterGrade.cleared).toBeGreaterThanOrEqual(1)
    for (const row of result.form.rows) {
      const fresh = await prisma.enrollment.findUniqueOrThrow({ where: { id: row.id } })
      expect(fresh.pendingPrerequisite).toBe(false)
      expect(fresh.status).toBe('REGISTERED')
    }
  })

  it('KQ-04/DK-05: a graded Học trước condition is satisfied even when it is a fail', async () => {
    const student = await makeStudent('học trước', null)
    const result = await service.register(student.userId, key(), {
      sectionIds: [se113SectionId],
    })
    expect(result.results[0]?.ok).toBe(true)
    expect(result.form.rows[0]?.pendingPrerequisite).toBe(true)
    await setScore(student, '4.0')
    const afterGrade = await review.review()
    expect(afterGrade.cleared).toBeGreaterThanOrEqual(1)
    const fresh = await prisma.enrollment.findUniqueOrThrow({
      where: { id: result.results[0]!.enrollmentId! },
    })
    expect(fresh.pendingPrerequisite).toBe(false)
    expect(fresh.status).toBe('REGISTERED')
  })

  it('DK-06: a failed prerequisite auto-cancels both ways, reverses fees and is safe to re-run', async () => {
    const student = await makeStudent('trượt', null)
    const result = await service.register(student.userId, key(), {
      sectionIds: [se100SectionId, se100PracticeId],
    })
    expect(result.results.map((item) => item.ok)).toEqual([true, true])
    const [theory, practice] = result.form.rows
    const before = await prisma.courseSection.findMany({
      where: { id: { in: [se100SectionId, se100PracticeId] } },
    })

    const surcharge = await prisma.ledgerEntry.create({
      data: {
        studentId: student.studentId,
        termId: openTermId,
        type: 'SURCHARGE',
        direction: 'DEBIT',
        amount: 81_000n,
        enrollmentId: theory!.id,
        description: 'Phụ thu thử nghiệm',
      },
    })
    const discount = await prisma.ledgerEntry.create({
      data: {
        studentId: student.studentId,
        termId: openTermId,
        type: 'DISCOUNT',
        direction: 'CREDIT',
        amount: 8_100n,
        discountRate: 10,
        enrollmentId: theory!.id,
        relatedEntryId: surcharge.id,
      },
    })
    const outboxBefore = await prisma.outboxEvent.count()

    await setScore(student, '4.0')
    const first: ReviewResult = await review.review()
    expect(first.cancelled).toBeGreaterThanOrEqual(1)
    for (const row of [theory!, practice!]) {
      const fresh = await prisma.enrollment.findUniqueOrThrow({ where: { id: row.id } })
      expect(fresh.status).toBe('CANCELLED')
      expect(fresh.cancellationReason).toBe('Tự huỷ: SE104 Không đạt')
    }
    for (const section of before) {
      const fresh = await prisma.courseSection.findUniqueOrThrow({ where: { id: section.id } })
      expect(fresh.enrolledCount).toBe(section.enrolledCount - 1)
    }
    const reversals = await prisma.ledgerEntry.findMany({
      where: {
        enrollmentId: theory!.id,
        type: { in: ['SURCHARGE_REVERSAL', 'DISCOUNT_REVERSAL'] },
      },
    })
    expect(reversals.map((item) => item.type).sort()).toEqual([
      'DISCOUNT_REVERSAL',
      'SURCHARGE_REVERSAL',
    ])
    expect(reversals.find((item) => item.type === 'SURCHARGE_REVERSAL')?.relatedEntryId).toBe(
      surcharge.id,
    )
    expect(reversals.find((item) => item.type === 'DISCOUNT_REVERSAL')?.relatedEntryId).toBe(
      discount.id,
    )
    expect(await prisma.outboxEvent.count()).toBe(outboxBefore)

    const second = await review.review()
    expect(second.cancelled).toBe(0)
    const afterSecond = await prisma.enrollment.findUniqueOrThrow({ where: { id: theory!.id } })
    expect(afterSecond.status).toBe('CANCELLED')
  })

  it('DK-06: a finalized form keeps the conditional line even when the grade is a fail', async () => {
    const student = await makeStudent('đã chốt', null)
    const result = await service.register(student.userId, key(), {
      sectionIds: [se100SectionId],
    })
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { id: result.results[0]!.enrollmentId! },
    })
    await prisma.registrationForm.update({
      where: { id: row.formId },
      data: { finalizedAt: DEMO_NOW },
    })
    await setScore(student, '4.0')
    await review.review()
    const fresh = await prisma.enrollment.findUniqueOrThrow({ where: { id: row.id } })
    expect(fresh.status).toBe('REGISTERED')
    expect(fresh.pendingPrerequisite).toBe(true)
    expect(fresh.cancellationReason).toBeNull()
  })
})
