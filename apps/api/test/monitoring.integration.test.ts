import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import ExcelJS from 'exceljs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { DEV_PASSWORD } from '../prisma/seed/scenarios'
import { PrismaService } from '../src/prisma/prisma.service'
import { ROSTER_HEADERS, UNDER_CREDIT_HEADERS } from '../src/monitoring/excel'

const cookieFrom = (response: Response) =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

async function rowsOf(buffer: ArrayBuffer): Promise<string[][]> {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer)
  const sheet = book.worksheets[0]!
  const rows: string[][] = []
  for (let index = 1; index <= sheet.rowCount; index++) {
    const row: string[] = []
    for (let column = 1; column <= sheet.columnCount; column++) {
      const value = sheet.getRow(index).getCell(column).value
      row.push(typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    }
    rows.push(row)
  }
  return rows
}

describe('staff monitoring (integration: seeded Postgres + Redis)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let cookie: string
  let fullSectionId: number

  const request = (method: string, path: string, body?: unknown, withCookie = true) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.7',
        ...(withCookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)

    const login = await request('POST', '/auth/login', {
      username: 'pdt.hang',
      password: DEV_PASSWORD,
    })
    expect(login.status).toBe(200)
    cookie = cookieFrom(login)
    fullSectionId = (
      await prisma.courseSection.findFirstOrThrow({
        where: { code: 'CS106.P21' },
        select: { id: true },
      })
    ).id
  })

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE audit_log RESTART IDENTITY`
  })

  afterAll(async () => {
    await prisma.courseSection.update({ where: { id: fullSectionId }, data: { capacity: 1 } })
    await prisma.$executeRaw`TRUNCATE TABLE audit_log RESTART IDENTITY`
    await app.close()
  })

  it('exposes the live class table with everything the filters need', async () => {
    const response = await request('GET', '/monitor/20262/sections')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      now: string
      pollIntervalSeconds: number
      sections: {
        code: string
        courseCode: string
        systemCode: string
        capacity: number
        enrolledCount: number
        fillPercent: number
      }[]
    }
    expect(body.pollIntervalSeconds).toBe(5)
    expect(Number.isNaN(Date.parse(body.now))).toBe(false)
    const section = body.sections.find((item) => item.code === 'SE104.P21')!
    expect(section.courseCode).toBe('SE104')
    expect(section.systemCode).toBe('CQUI')
    expect(section.fillPercent).toBe(1)
    expect(body.sections.find((item) => item.code === 'CS106.P21')).toMatchObject({
      capacity: 1,
      enrolledCount: 1,
      fillPercent: 100,
    })
    expect(body.sections.some((item) => item.enrolledCount < 10)).toBe(true)
  })

  it('rejects a capacity below the number already registered, at the cell', async () => {
    const rejected = await request('PATCH', `/monitor/20262/sections/${fullSectionId}/capacity`, {
      capacity: 0,
    })
    expect(rejected.status).toBe(400)
    const error = (await rejected.json()) as {
      code: string
      fieldErrors: { capacity: string }
    }
    expect(error.code).toBe('CAPACITY_BELOW_ENROLLED')
    expect(error.fieldErrors.capacity).toContain('1')
    expect(
      (await prisma.courseSection.findUniqueOrThrow({ where: { id: fullSectionId } })).capacity,
    ).toBe(1)

    const accepted = await request('PATCH', `/monitor/20262/sections/${fullSectionId}/capacity`, {
      capacity: 2,
    })
    expect(accepted.status).toBe(200)
    const acceptedBody = (await accepted.json()) as Record<string, unknown>
    expect(acceptedBody).toMatchObject({ capacity: 2, enrolledCount: 1 })
    expect(await prisma.auditLog.count({ where: { action: 'section.update_capacity' } })).toBe(1)
    await prisma.courseSection.update({ where: { id: fullSectionId }, data: { capacity: 1 } })
  })

  it('hides cancelled BB01 rows by default and exports the exact columns on seed', async () => {
    const visible = (await (await request('GET', '/monitor/20262/roster/SE104.P21')).json()) as {
      rows: { studentCode: string; attemptType: string; status: string }[]
    }
    expect(visible.rows).toHaveLength(1)
    expect(visible.rows[0]).toMatchObject({
      studentCode: '24520001',
      attemptType: 'FIRST',
      status: 'REGISTERED',
    })

    const withCancelled = (await (
      await request('GET', '/monitor/20262/roster/IT002.P21?includeCancelled=true')
    ).json()) as { rows: { studentCode: string; status: string }[] }
    expect(withCancelled.rows.map((row) => row.studentCode)).toEqual(['24520009'])
    expect(withCancelled.rows[0]!.status).toBe('CANCELLED')
    const defaultRows = (await (
      await request('GET', '/monitor/20262/roster/IT002.P21')
    ).json()) as { rows: unknown[] }
    expect(defaultRows.rows).toHaveLength(0)

    const download = await request('GET', '/monitor/20262/roster/SE104.P21/export')
    expect(download.status).toBe(200)
    expect(download.headers.get('content-disposition')).toContain('BB01_SE104.P21.xlsx')
    const [headers, ...data] = await rowsOf(await download.arrayBuffer())
    expect(headers).toEqual([...ROSTER_HEADERS])
    expect(data[0]).toEqual([
      '1',
      '24520001',
      'Nguyễn Minh An',
      'K19',
      'CQUI',
      'Lần đầu',
      'Đang đăng ký',
    ])
  })

  it('exports the students below the minimum credits after chốt', async () => {
    const response = await request('GET', '/monitor/20261/under-credits')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      rows: { studentCode: string; credits: number; minCredits: number }[]
    }
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0]).toMatchObject({ studentCode: '24520003', credits: 3, minCredits: 14 })

    const download = await request('GET', '/monitor/20261/under-credits/export')
    expect(download.status).toBe(200)
    const [headers, ...data] = await rowsOf(await download.arrayBuffer())
    expect(headers).toEqual([...UNDER_CREDIT_HEADERS])
    expect(data[0]).toEqual(['1', '24520003', 'Lê Quốc Khoa', 'K19', '3'])
  })

  it('collects the academic office todo list from the seed', async () => {
    const response = await request('GET', '/monitor/overview')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      focusTerm: { code: string; phase: string }
      stats: { fullSections: number; underCredits: number; studentsWithForm: number }
      todos: { type: string; title: string; count: number }[]
    }
    expect(body.focusTerm).toMatchObject({ code: '20262', phase: 'REGISTRATION' })
    expect(body.stats.fullSections).toBe(1)
    expect(body.stats.underCredits).toBe(1)
    expect(body.todos.find((todo) => todo.type === 'MISSING_FEE_SCHEDULE')).toMatchObject({
      title: 'Khoá 20 · CLC chưa có bảng phí',
      count: 1,
    })
    expect(body.todos.find((todo) => todo.type === 'FULL_SECTION')?.count).toBe(1)
  })

  it('detects a preparation term without a timetable and a room clash', async () => {
    const startYear = 9000 + (Date.now() % 900)
    const academicYear = await prisma.academicYear.create({ data: { startYear } })
    const missingTerm = await prisma.term.create({
      data: {
        academicYearId: academicYear.id,
        type: 'FIRST',
        termCode: `${startYear}1`,
        phase: 'PREPARATION',
        startDate: new Date('2035-01-01T00:00:00Z'),
        registrationStartAt: new Date('2035-01-05T01:00:00Z'),
        registrationEndAt: new Date('2035-01-08T01:00:00Z'),
        adjustmentStartAt: new Date('2035-01-18T01:00:00Z'),
        adjustmentEndAt: new Date('2035-01-22T01:00:00Z'),
        tuitionDeadline: new Date('2035-02-28T01:00:00Z'),
        finalExamStartAt: new Date('2035-05-17T01:00:00Z'),
        minCredits: 14,
        maxCredits: 24,
      },
    })
    const [first, second] = await prisma.courseSection.findMany({
      where: { code: { in: ['SE104.P21', 'SE104.P23'] } },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    const clashes = await prisma.meeting.createManyAndReturn({
      data: [first!, second!].map((section) => ({
        sectionId: section.id,
        dayOfWeek: 6,
        startSlot: 1,
        endSlot: 3,
        room: 'A1.01',
        weeks: 1,
      })),
    })
    try {
      const body = (await (await request('GET', '/monitor/overview')).json()) as {
        stats: { clashes: number }
        todos: { type: string; title: string }[]
      }
      expect(body.stats.clashes).toBeGreaterThan(0)
      expect(body.todos.some((todo) => todo.type === 'SCHEDULE_CLASH')).toBe(true)
      expect(body.todos.some((todo) => todo.type === 'MISSING_TIMETABLE')).toBe(true)
      expect(body.todos.find((todo) => todo.type === 'MISSING_TIMETABLE')?.title).toContain(
        missingTerm.termCode,
      )
    } finally {
      await prisma.meeting.deleteMany({ where: { id: { in: clashes.map((row) => row.id) } } })
      await prisma.term.delete({ where: { id: missingTerm.id } })
      await prisma.academicYear.delete({ where: { id: academicYear.id } })
    }
  })

  it('requires an academic-office session', async () => {
    expect((await request('GET', '/monitor/overview', undefined, false)).status).toBe(401)
  })
})
