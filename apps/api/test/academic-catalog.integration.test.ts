import 'reflect-metadata'

// The auth suite owns Redis DB 7; these catalog tests use the reserved DB 9 (compose.dev.yml).
process.env.REDIS_URL = 'redis://localhost:6379/9'

import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'

import { AppModule } from '../src/app.module'
import { Role } from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'

type PriorityGroupRow = {
  id: number
  code: string
  name: string
  discountRate: number
  priority: number
  studentCount: number
  duplicatePriority: boolean
}
type CohortRow = {
  id: number
  code: string
  admissionYear: number
  studentCount: number
  feeScheduleCount: number
  registrationSlotCount: number
}
type Catalog = { priorityGroups: PriorityGroupRow[]; cohorts: CohortRow[] }
type ApiErrorBody = { code?: string; message?: string; reasons?: string[] }

const PASSWORD = 'Dkhp@2026'
const cookieFrom = (response: Response) =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

describe('academic catalog (integration: Postgres + Redis)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let cookie: string
  let sequence = 0
  const suffix = randomUUID().slice(0, 8)
  const ids = {
    priorityGroups: [] as number[],
    cohorts: [] as number[],
    students: [] as number[],
    users: [] as number[],
    feeSchedules: [] as number[],
    slots: [] as number[],
  }
  const key = () => `${suffix}${++sequence}`

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'pdt.hang', password: PASSWORD }),
    })
    expect(login.status).toBe(200)
    cookie = cookieFrom(login)
  })

  afterAll(async () => {
    await prisma.studentPriorityGroup.deleteMany({
      where: { studentId: { in: ids.students } },
    })
    await prisma.registrationSlot.deleteMany({ where: { id: { in: ids.slots } } })
    await prisma.feeSchedule.deleteMany({ where: { id: { in: ids.feeSchedules } } })
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } })
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } })
    await prisma.cohort.deleteMany({ where: { id: { in: ids.cohorts } } })
    await prisma.priorityGroup.deleteMany({ where: { id: { in: ids.priorityGroups } } })
    await app.close()
  })

  const send = (method: string, path: string, body?: unknown, withCookie = true) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(withCookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const createGroup = async (priority: number, discountRate = 10) => {
    const response = await send('POST', '/academic-catalog/priority-groups', {
      code: `W41PG${key()}`,
      name: `Nhóm thử ${priority}`,
      discountRate,
      priority,
    })
    expect(response.status).toBe(201)
    const group = (await response.json()) as PriorityGroupRow
    ids.priorityGroups.push(group.id)
    return group
  }

  const createCohortRow = async () => {
    const response = await send('POST', '/academic-catalog/cohorts', {
      code: `W41C${key()}`,
      // admissionYear is unique, so each temporary cohort needs its own year.
      admissionYear: 2100 + sequence,
    })
    expect(response.status).toBe(201)
    const cohort = (await response.json()) as CohortRow
    ids.cohorts.push(cohort.id)
    return cohort
  }

  const makeStudent = async (cohortId: number) => {
    const tag = key()
    const system = await prisma.trainingSystem.findFirstOrThrow({ where: { code: 'CQUI' } })
    const user = await prisma.user.create({
      data: {
        username: `w41u${tag}`,
        passwordHash: 'unused',
        fullName: 'Sinh viên thử W41',
        roles: [Role.STUDENT],
        mustChangePassword: false,
      },
    })
    ids.users.push(user.id)
    const student = await prisma.student.create({
      data: {
        studentCode: `W41S${tag}`,
        userId: user.id,
        fullName: 'Sinh viên thử W41',
        cohortId,
        trainingSystemId: system.id,
      },
    })
    ids.students.push(student.id)
    return student
  }

  it('HS-02/QV-01: integer rate bounds, student count and a non-blocking duplicate-priority warning', async () => {
    const group = await createGroup(10, 100)
    const student = await makeStudent((await createCohortRow()).id)
    await prisma.studentPriorityGroup.create({
      data: { studentId: student.id, priorityGroupId: group.id },
    })

    const list = await send('GET', '/academic-catalog')
    expect(list.status).toBe(200)
    const catalog = (await list.json()) as Catalog
    const row = catalog.priorityGroups.find((item) => item.id === group.id)!
    expect(row.studentCount).toBe(1)
    expect(row.discountRate).toBe(100)
    expect(row.duplicatePriority).toBe(true)
    expect(catalog.priorityGroups.find((item) => item.code === 'HO_NGHEO')?.duplicatePriority).toBe(
      true,
    )

    const bad = await send('POST', '/academic-catalog/priority-groups', {
      code: `W41BAD${key()}`,
      name: 'Sai tỉ lệ',
      discountRate: 100.5,
      priority: 1,
    })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as ApiErrorBody).code).toBe('INVALID_DISCOUNT_RATE')
    const zero = await send('POST', '/academic-catalog/priority-groups', {
      code: `W41ZERO${key()}`,
      name: 'Giảm 0%',
      discountRate: 0,
      priority: 1,
    })
    expect(zero.status).toBe(201)
    ids.priorityGroups.push(((await zero.json()) as PriorityGroupRow).id)

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'PriorityGroup', entityId: String(group.id) },
    })
    expect(logs.some((log) => log.action === 'PRIORITY_GROUP_CREATE')).toBe(true)
  })

  it('HS-02: a group with students cannot be deleted; a rate edit does not rewrite old debt', async () => {
    const group = await createGroup(11)
    const student = await makeStudent((await createCohortRow()).id)
    await prisma.studentPriorityGroup.create({
      data: { studentId: student.id, priorityGroupId: group.id },
    })

    const blocked = await send('DELETE', `/academic-catalog/priority-groups/${group.id}`)
    expect(blocked.status).toBe(409)
    const error = (await blocked.json()) as ApiErrorBody
    expect(error.code).toBe('PRIORITY_GROUP_IN_USE')
    expect(error.message).toContain('1 sinh viên')

    await prisma.studentPriorityGroup.delete({
      where: { studentId_priorityGroupId: { studentId: student.id, priorityGroupId: group.id } },
    })
    expect((await send('DELETE', `/academic-catalog/priority-groups/${group.id}`)).status).toBe(200)
    expect(
      await prisma.auditLog.findFirst({
        where: {
          entityType: 'PriorityGroup',
          entityId: String(group.id),
          action: 'PRIORITY_GROUP_DELETE',
        },
      }),
    ).not.toBeNull()

    const lietSi = await prisma.priorityGroup.findUniqueOrThrow({ where: { code: 'LIET_SI' } })
    const before = await prisma.ledgerEntry.findFirstOrThrow({
      where: { type: 'DISCOUNT', discountRate: 80 },
    })
    const edited = await send('PATCH', `/academic-catalog/priority-groups/${lietSi.id}`, {
      code: lietSi.code,
      name: lietSi.name,
      discountRate: 79,
      priority: lietSi.priority,
    })
    expect(edited.status).toBe(200)
    try {
      const after = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: before.id } })
      expect(after.discountRate).toBe(80)
      expect(after.amount).toBe(before.amount)
      expect(
        await prisma.auditLog.findFirst({
          where: {
            entityType: 'PriorityGroup',
            entityId: String(lietSi.id),
            action: 'PRIORITY_GROUP_UPDATE',
          },
        }),
      ).not.toBeNull()
    } finally {
      await send('PATCH', `/academic-catalog/priority-groups/${lietSi.id}`, {
        code: lietSi.code,
        name: lietSi.name,
        discountRate: lietSi.discountRate,
        priority: lietSi.priority,
      })
    }
  })

  it('HS-15: cohorts can be added/edited and cannot be deleted while students, fees or slots exist', async () => {
    const cohort = await createCohortRow()
    const edited = await send('PATCH', `/academic-catalog/cohorts/${cohort.id}`, {
      code: `${cohort.code}M`,
      admissionYear: 2027,
    })
    expect(edited.status).toBe(200)
    expect(((await edited.json()) as CohortRow).admissionYear).toBe(2027)
    expect((await send('DELETE', `/academic-catalog/cohorts/${cohort.id}`)).status).toBe(200)

    const withStudent = await createCohortRow()
    await makeStudent(withStudent.id)
    const blockedByStudent = await send('DELETE', `/academic-catalog/cohorts/${withStudent.id}`)
    expect(blockedByStudent.status).toBe(409)
    expect(((await blockedByStudent.json()) as ApiErrorBody).reasons).toContain('có 1 sinh viên')

    const withFee = await createCohortRow()
    const system = await prisma.trainingSystem.findFirstOrThrow({ where: { code: 'CQUI' } })
    const fee = await prisma.feeSchedule.create({
      data: {
        cohortId: withFee.id,
        trainingSystemId: system.id,
        baseTuition: 15_000_000,
      },
    })
    ids.feeSchedules.push(fee.id)
    const blockedByFee = await send('DELETE', `/academic-catalog/cohorts/${withFee.id}`)
    expect(blockedByFee.status).toBe(409)
    expect(((await blockedByFee.json()) as ApiErrorBody).reasons).toContain('có 1 bảng phí')

    const withSlot = await createCohortRow()
    const term = await prisma.term.findFirstOrThrow({ where: { termCode: '20262' } })
    const slot = await prisma.registrationSlot.create({
      data: {
        termId: term.id,
        name: 'W41 slot',
        startAt: term.registrationStartAt,
        endAt: term.registrationEndAt,
        cohorts: { create: { cohortId: withSlot.id } },
      },
    })
    ids.slots.push(slot.id)
    const blockedBySlot = await send('DELETE', `/academic-catalog/cohorts/${withSlot.id}`)
    expect(blockedBySlot.status).toBe(409)
    expect(((await blockedBySlot.json()) as ApiErrorBody).reasons).toContain('có 1 khung giờ')

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Cohort', entityId: String(cohort.id) },
    })
    expect(logs.map((log) => log.action).sort()).toEqual([
      'COHORT_CREATE',
      'COHORT_DELETE',
      'COHORT_UPDATE',
    ])
  })

  it('QV-01: a student session cannot change the catalog', async () => {
    const studentLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: '24520001', password: PASSWORD }),
    })
    const studentCookie = cookieFrom(studentLogin)
    const denied = await fetch(`${baseUrl}/academic-catalog/cohorts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: studentCookie },
      body: JSON.stringify({ code: `W41DENY${key()}`, admissionYear: 2026 }),
    })
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as ApiErrorBody).code).toBe('FORBIDDEN')
  })
})
