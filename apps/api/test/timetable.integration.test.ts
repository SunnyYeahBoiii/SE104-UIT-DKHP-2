import 'reflect-metadata'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'

import type { Actor } from '../src/academics/academics.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { TimetableService } from '../src/timetable/timetable.service'

const FIXTURE = new URL('./fixtures/tkb_hk2_2027.xlsx', import.meta.url)
const actor: Actor = { userId: 1, requestId: 'test-timetable', ip: '203.0.113.12' }
const TEST_TERM = '20991'

type Failure = {
  code?: string
  message?: string
  existing?: { sections: number }
  errors?: unknown[]
}

const failureOf = async (promise: Promise<unknown>): Promise<Failure> => {
  try {
    await promise
  } catch (error) {
    const response = (error as { response?: Failure }).response
    if (response && typeof response === 'object') return response
  }
  throw new Error('Expected the command to be rejected')
}

async function mutate(change: (sheet: ExcelJS.Worksheet) => void): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load((await readFile(FIXTURE)) as never)
  change(workbook.worksheets[0]!)
  return Buffer.from(new Uint8Array(await workbook.xlsx.writeBuffer())).toString('base64')
}

describe('timetable import (integration: Postgres dkhp_w44, real .xlsx fixture)', () => {
  let prisma: PrismaService
  let service: TimetableService
  let fileBase64: string
  let termId: number
  let academicYearId: number

  const counts = async () => ({
    offered: await prisma.offeredCourse.count({ where: { termId } }),
    sections: await prisma.courseSection.count({
      where: { offeredCourse: { termId } },
    }),
    meetings: await prisma.meeting.count({
      where: { section: { offeredCourse: { termId } } },
    }),
    groups: await prisma.courseSection.count({
      where: { offeredCourse: { termId }, parentSectionId: { not: null } },
    }),
  })

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    service = new TimetableService(prisma)
    fileBase64 = (await readFile(FIXTURE)).toString('base64')
    academicYearId = (await prisma.academicYear.create({ data: { startYear: 2099 } })).id
    termId = (
      await prisma.term.create({
        data: {
          academicYearId,
          type: 'FIRST',
          termCode: TEST_TERM,
          phase: 'PREPARATION',
          startDate: new Date('2027-01-11T00:00:00.000Z'),
          registrationStartAt: new Date('2026-12-20T01:00:00.000Z'),
          registrationEndAt: new Date('2026-12-25T10:00:00.000Z'),
          adjustmentStartAt: new Date('2027-01-11T01:00:00.000Z'),
          adjustmentEndAt: new Date('2027-01-20T10:00:00.000Z'),
          tuitionDeadline: new Date('2027-03-10T10:00:00.000Z'),
          finalExamStartAt: new Date('2027-05-17T00:00:00.000Z'),
          minCredits: 0,
          maxCredits: 24,
        },
      })
    ).id
  })

  afterAll(async () => {
    const ids = (
      await prisma.courseSection.findMany({
        where: { offeredCourse: { termId } },
        select: { id: true },
      })
    ).map((item) => item.id)
    if (ids.length > 0)
      await prisma.courseSection.updateMany({
        where: { id: { in: ids } },
        data: { parentSectionId: null },
      })
    await prisma.courseSection.deleteMany({ where: { offeredCourse: { termId } } })
    await prisma.offeredCourse.deleteMany({ where: { termId } })
    await prisma.term.delete({ where: { id: termId } })
    await prisma.academicYear.delete({ where: { id: academicYearId } })
    await prisma.onModuleDestroy()
  })

  it('TKB-02: refuses import when the term is not in PREPARATION', async () => {
    const response = await failureOf(service.import('20262', { fileBase64 }, actor))
    expect(response.code).toBe('TERM_NOT_IMPORTABLE')
    expect(response.message).toContain('Chuẩn bị')
  })

  it('TKB-02: preview of a non-preparation term explains why the button is disabled', async () => {
    const preview = await service.preview('20262', { fileBase64 })
    expect(preview.canImport).toBe(false)
    expect(preview.reason).toContain('Chuẩn bị')
  })

  it('TKB-03/05/06: one bad cell blocks the entire import and the report names row × column', async () => {
    const broken = await mutate((sheet) => {
      sheet.getCell(4, 2).value = 'IT999'
      sheet.getCell(5, 4).value = '4'
      sheet.getCell(6, 9).value = '12'
    })
    const preview = await service.preview(TEST_TERM, { fileBase64: broken })
    const errorCodes = preview.errors.map((error) => error.code)
    const errorColumns = preview.errors.map((error) => error.column)
    const errorRows = preview.errors.map((error) => error.row)
    for (const code of ['COURSE_UNKNOWN', 'CREDITS_INCONSISTENT', 'SLOTS_INVALID'])
      expect(errorCodes).toContain(code)
    for (const column of ['MÃ MH', 'TỐ TC', 'TIẾT']) expect(errorColumns).toContain(column)
    for (const errorRow of [4, 6, 7]) expect(errorRows).toContain(errorRow)

    const response = await failureOf(service.import(TEST_TERM, { fileBase64: broken }, actor))
    expect(response.code).toBe('IMPORT_VALIDATION_FAILED')
    expect(response.errors).toHaveLength(preview.errors.length)
    expect(await counts()).toEqual({ offered: 0, sections: 0, meetings: 0, groups: 0 })
  })

  it('rejects an empty or corrupted file without touching the term', async () => {
    const empty = await mutate((sheet) => {
      for (let index = sheet.rowCount; index >= 4; index--) sheet.spliceRows(index, 1)
    })
    const emptyPreview = await service.preview(TEST_TERM, { fileBase64: empty })
    expect(emptyPreview.errors[0]!.code).toBe('EMPTY_FILE')

    const corrupted = await failureOf(
      service.import(
        TEST_TERM,
        { fileBase64: Buffer.from('not an xlsx').toString('base64') },
        actor,
      ),
    )
    expect(corrupted.code).toBe('FILE_INVALID')
    expect(await counts()).toEqual({ offered: 0, sections: 0, meetings: 0, groups: 0 })
  })

  it('TKB-01/04/05/07: imports the real sample file into one atomic set', async () => {
    const preview = await service.preview(TEST_TERM, { fileBase64 })
    expect(preview.errors).toEqual([])
    expect(preview.rowCount).toBe(9)
    expect(preview.summary).toEqual({
      offeredCourses: 7,
      sections: 9,
      practiceGroups: 3,
      meetings: 7,
    })

    const result = await service.import(TEST_TERM, { fileBase64 }, actor)
    expect(result.counts).toEqual(preview.summary!)
    expect(await counts()).toEqual({
      offered: 7,
      sections: 9,
      meetings: 7,
      groups: 3,
    })
    const se104th = await prisma.offeredCourse.findFirstOrThrow({
      where: { termId, course: { code: 'SE104TH' } },
    })
    expect(se104th.credits).toBe(3)
    const ht2 = await prisma.courseSection.findFirstOrThrow({
      where: { offeredCourse: { termId }, code: 'IT001.P21.1' },
      include: { meetings: true },
    })
    expect(ht2.meetings).toEqual([])
    const theory = await prisma.courseSection.findFirstOrThrow({
      where: { offeredCourse: { termId }, code: 'SE104.P21' },
    })
    expect(theory.practiceMode).toBe('SCHEDULED')
    const zero = await prisma.offeredCourse.findFirstOrThrow({
      where: { termId, course: { code: 'MA003' } },
    })
    expect(zero.credits).toBe(0)
  })

  it('TKB-02: re-import requires confirmation and replaces every old row', async () => {
    const denied = await failureOf(service.import(TEST_TERM, { fileBase64 }, actor))
    expect(denied.code).toBe('REPLACE_CONFIRMATION_REQUIRED')
    expect(denied.existing!.sections).toBe(9)

    const result = await service.import(TEST_TERM, { fileBase64, confirmReplace: true }, actor)
    expect(result.counts.sections).toBe(9)
    expect(await counts()).toEqual({
      offered: 7,
      sections: 9,
      meetings: 7,
      groups: 3,
    })
    const audit = await prisma.auditLog.findMany({
      where: { entityType: 'term', entityId: String(termId), action: 'TIMETABLE_IMPORTED' },
    })
    expect(audit).toHaveLength(2)
  })

  it('DT-10: clash warnings are separate, non-blocking and visible in the overview', async () => {
    const clashing = await mutate((sheet) => {
      sheet.getCell(7, 8).value = '2'
    })
    const result = await service.import(
      TEST_TERM,
      { fileBase64: clashing, confirmReplace: true },
      actor,
    )
    const warningCodes = result.warnings.map((warning) => warning.code)
    expect(warningCodes).toContain('ROOM_CLASH')
    expect(warningCodes).toContain('LECTURER_CLASH')
    const overview = await service.overview(TEST_TERM)
    expect(overview.warnings.length).toBeGreaterThan(0)
    expect(overview.sections.filter((section) => section.hasWarning).length).toBeGreaterThan(0)
    expect(overview.offeredCourses).toHaveLength(7)
    expect(overview.offeredCourses.find((item) => item.code === 'MA003')!.defaultCredits).toBe(3)
    expect(overview.sections.find((item) => item.code === 'SE104.P21')!.reservedAdmissionYear).toBe(
      2021,
    )
  })
})
