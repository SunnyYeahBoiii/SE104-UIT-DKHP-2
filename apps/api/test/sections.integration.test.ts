import 'reflect-metadata'

import { afterAll, beforeAll, describe, expect, it as bunIt } from 'bun:test'

const it = (name: string, fn: () => Promise<void>) => bunIt(name, fn, 30_000)

import type { Actor } from '../src/academics/academics.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { SectionsService } from '../src/timetable/sections.service'

const actor: Actor = { userId: 1, requestId: 'test-sections', ip: '203.0.113.44' }
const TERM = '20941'
const OPEN_TERM = '20262'
const termStart = new Date('2027-01-11T00:00:00.000Z')

const meeting = (override: Record<string, unknown> = {}) => ({
  dayOfWeek: 2,
  startSlot: 1,
  endSlot: 3,
  room: '',
  startDate: '2027-01-11',
  endDate: '2027-02-08',
  cadence: 2,
  ...override,
})

const sectionBody = (override: Record<string, unknown> = {}) => ({
  code: 'ZZ.P90',
  courseCode: 'SE104',
  systemCode: 'CQUI',
  lecturerCode: null,
  capacity: 50,
  reservedAdmissionYear: 2021,
  language: 'VN',
  note: 'Ghi chú thử nghiệm',
  practiceMode: null,
  parentCode: null,
  meetings: [meeting()],
  ...override,
})

type Failure = {
  response?: { code?: string; message?: string; fieldErrors?: Record<string, string> }
}

async function failureOf(promise: Promise<unknown>): Promise<Failure> {
  try {
    await promise
  } catch (error) {
    const response = (error as Failure).response
    if (response && typeof response === 'object') return { response }
  }
  throw new Error('Expected the command to be rejected')
}

describe('section editing (integration: Postgres dkhp_w45, phase rules LHP-01/LHP-02)', () => {
  let prisma: PrismaService
  let service: SectionsService
  let academicYearId: number
  let termId: number
  let openTermId: number
  let theoryOfferingId: number
  const createdIds: number[] = []
  const auditBaseline: Record<string, number> = {}

  const remember = (id: number) => {
    createdIds.push(id)
    return id
  }

  const section = async (code: string) =>
    prisma.courseSection.findFirstOrThrow({
      where: { code, offeredCourse: { termId: { in: [termId, openTermId] } } },
      include: {
        meetings: true,
        parentSection: true,
        practiceSections: true,
        offeredCourse: { include: { course: true } },
        lecturer: true,
      },
    })

  async function cleanup() {
    const term = await prisma.term.findUnique({ where: { termCode: TERM }, select: { id: true } })
    const open = await prisma.term.findUnique({
      where: { termCode: OPEN_TERM },
      select: { id: true },
    })
    const mine = (termId?: number, zzOnly = false) => ({
      offeredCourse: { termId: termId ?? -1 },
      ...(zzOnly ? { code: { startsWith: 'ZZ.' } } : {}),
    })
    if (open) {
      await prisma.meeting.deleteMany({ where: { section: mine(open.id, true) } })
      await prisma.courseSection.updateMany({
        where: mine(open.id, true),
        data: { parentSectionId: null },
      })
      await prisma.courseSection.deleteMany({ where: mine(open.id, true) })
    }
    if (term) {
      await prisma.meeting.deleteMany({ where: { section: mine(term.id) } })
      await prisma.courseSection.updateMany({
        where: mine(term.id),
        data: { parentSectionId: null },
      })
      await prisma.courseSection.deleteMany({ where: mine(term.id) })
      await prisma.offeredCourse.deleteMany({ where: { termId: term.id } })
      await prisma.term.delete({ where: { id: term.id } })
    }
    await prisma.academicYear.deleteMany({ where: { startYear: 2097 } })
  }

  beforeAll(async () => {
    prisma = new PrismaService()
    await prisma.onModuleInit()
    service = new SectionsService(prisma)
    await cleanup()
    academicYearId = (await prisma.academicYear.create({ data: { startYear: 2097 } })).id
    termId = (
      await prisma.term.create({
        data: {
          academicYearId,
          type: 'FIRST',
          termCode: TERM,
          phase: 'PREPARATION',
          startDate: termStart,
          registrationStartAt: new Date('2026-10-01T01:00:00.000Z'),
          registrationEndAt: new Date('2026-10-05T10:00:00.000Z'),
          adjustmentStartAt: new Date('2026-10-06T01:00:00.000Z'),
          adjustmentEndAt: new Date('2026-10-10T10:00:00.000Z'),
          tuitionDeadline: new Date('2027-03-10T10:00:00.000Z'),
          finalExamStartAt: new Date('2027-05-17T00:00:00.000Z'),
          minCredits: 0,
          maxCredits: 24,
        },
      })
    ).id
    openTermId = (await prisma.term.findUniqueOrThrow({ where: { termCode: OPEN_TERM } })).id
    for (const action of [
      'section.create',
      'section.update',
      'section.delete',
      'offered_course.update_credits',
    ])
      auditBaseline[action] = await auditCount(action)
    const courses = await prisma.course.findMany({ where: { code: { in: ['SE104', 'SE104TH'] } } })
    theoryOfferingId = (
      await prisma.offeredCourse.create({
        data: {
          termId,
          courseId: courses.find((course) => course.code === 'SE104')!.id,
          credits: 3,
        },
      })
    ).id
    await prisma.offeredCourse.create({
      data: {
        termId,
        courseId: courses.find((course) => course.code === 'SE104TH')!.id,
        credits: 1,
      },
    })
    const openOffering = await prisma.offeredCourse.findFirstOrThrow({
      where: { termId: openTermId, course: { code: 'SE104' } },
    })
    await prisma.courseSection.create({
      data: {
        offeredCourseId: openOffering.id,
        trainingSystemId: (
          await prisma.trainingSystem.findFirstOrThrow({ where: { code: 'CQUI' } })
        ).id,
        code: 'ZZ.P96',
        capacity: 50,
        reservedAdmissionYear: 2021,
        language: 'VN',
        meetings: {
          create: [{ dayOfWeek: 2, startSlot: 1, endSlot: 3, room: '', weeks: 0b10101 }],
        },
      },
    })
  })

  afterAll(async () => {
    await cleanup()
    await prisma.onModuleDestroy()
  })

  const auditCount = (action: string) =>
    prisma.auditLog.count({ where: { requestId: actor.requestId, action } })

  it('LHP-01: creates a class with every form field and a recurring meeting', async () => {
    const created = await service.create(TERM, sectionBody(), actor)
    remember(created.id)
    const row = await section(created.code)
    expect(row.code).toBe('ZZ.P90')
    expect(row.capacity).toBe(50)
    expect(row.reservedAdmissionYear).toBe(2021)
    expect(row.language).toBe('VN')
    expect(row.note).toBe('Ghi chú thử nghiệm')
    expect(row.lecturerId).toBeNull()
    expect(row.meetings).toHaveLength(1)
    expect(row.meetings[0]!.weeks).toBe(0b10101)
    expect((await auditCount('section.create')) - auditBaseline['section.create']!).toBe(1)
  })

  it('LHP-01: supports unlimited HT1 groups, each with its own meetings, and HT2 groups without any', async () => {
    const parent = await service.create(
      TERM,
      sectionBody({ code: 'ZZ.P91', practiceMode: 'SCHEDULED', meetings: [] }),
      actor,
    )
    remember(parent.id)
    for (let index = 1; index <= 3; index++) {
      const group = await service.create(
        TERM,
        sectionBody({
          code: `ZZ.P91.${index}`,
          courseCode: 'SE104TH',
          parentCode: 'ZZ.P91',
          practiceMode: 'SCHEDULED',
          meetings: [meeting({ dayOfWeek: index + 2, room: index === 1 ? '' : 'A1.01' })],
        }),
        actor,
      )
      remember(group.id)
    }
    const ht2 = await service.create(
      TERM,
      sectionBody({
        code: 'ZZ.P92',
        practiceMode: 'SELF_SCHEDULED',
        meetings: [],
      }),
      actor,
    )
    remember(ht2.id)
    const ht2Group = await service.create(
      TERM,
      sectionBody({
        code: 'ZZ.P92.1',
        courseCode: 'SE104TH',
        parentCode: 'ZZ.P92',
        practiceMode: 'SELF_SCHEDULED',
        meetings: [],
      }),
      actor,
    )
    remember(ht2Group.id)
    const editor = await service.editor(TERM)
    expect(editor.sections.filter((item) => item.parentCode === 'ZZ.P91')).toHaveLength(3)
    expect(editor.sections.find((item) => item.code === 'ZZ.P92.1')?.meetings).toEqual([])
    const failure = await failureOf(
      service.create(
        TERM,
        sectionBody({
          code: 'ZZ.P92.2',
          courseCode: 'SE104TH',
          parentCode: 'ZZ.P92',
          practiceMode: 'SELF_SCHEDULED',
          meetings: [meeting()],
        }),
        actor,
      ),
    )
    expect(failure.response?.code).toBe('HT2_HAS_MEETINGS')
  })

  it('C.4.6: copying a group schedule one week later shifts its week bitmask', async () => {
    const first = await service.create(
      TERM,
      sectionBody({
        code: 'ZZ.P93.1',
        courseCode: 'SE104TH',
        parentCode: 'ZZ.P91',
        practiceMode: 'SCHEDULED',
        meetings: [meeting({ dayOfWeek: 3, room: 'A1.01' })],
      }),
      actor,
    )
    remember(first.id)
    const copied = await service.create(
      TERM,
      sectionBody({
        code: 'ZZ.P93.2',
        courseCode: 'SE104TH',
        parentCode: 'ZZ.P91',
        practiceMode: 'SCHEDULED',
        meetings: [
          meeting({
            dayOfWeek: 3,
            room: 'A1.01',
            startDate: '2027-01-18',
            endDate: '2027-02-15',
          }),
        ],
      }),
      actor,
    )
    remember(copied.id)
    const original = await section('ZZ.P93.1')
    const shifted = await section('ZZ.P93.2')
    expect(shifted.meetings[0]!.weeks).toBe(original.meetings[0]!.weeks << 1)
  })

  it('ADR-0017/TKB-05: credits are editable in PREPARATION and zero is allowed', async () => {
    const result = await service.updateCredits(TERM, theoryOfferingId, { credits: 0 }, actor)
    expect(result.credits).toBe(0)
    const offering = await prisma.offeredCourse.findUniqueOrThrow({
      where: { id: theoryOfferingId },
    })
    expect(offering.credits).toBe(0)
    expect(
      (await auditCount('offered_course.update_credits')) -
        auditBaseline['offered_course.update_credits']!,
    ).toBe(1)
    const locked = await failureOf(
      service.updateCredits(OPEN_TERM, theoryOfferingId, { credits: 3 }, actor),
    )
    expect(locked.response?.code).toBe('CREDITS_LOCKED')
  })

  it('DT-10/QĐ12.4: clash warnings are returned inline but never block a save', async () => {
    const a = await service.create(
      TERM,
      sectionBody({
        code: 'ZZ.P94',
        lecturerCode: 'GV001',
        meetings: [meeting({ dayOfWeek: 4, startSlot: 4, endSlot: 5, room: 'B1.14' })],
      }),
      actor,
    )
    const b = await service.create(
      TERM,
      sectionBody({
        code: 'ZZ.P95',
        lecturerCode: 'GV001',
        meetings: [meeting({ dayOfWeek: 4, startSlot: 5, endSlot: 6, room: 'B1.14' })],
      }),
      actor,
    )
    remember(a.id)
    remember(b.id)
    const editor = await service.editor(TERM)
    const codes = editor.warnings.map((warning) => warning.code)
    expect(codes).toContain('ROOM_CLASH')
    expect(codes).toContain('LECTURER_CLASH')
    const warned = editor.sections.find((item) => item.code === 'ZZ.P95')!
    expect(warned.hasWarning).toBe(true)
    expect(warned.meetings[0]!.warnings.length).toBeGreaterThan(0)
    const saved = await service.update(
      TERM,
      b.id,
      sectionBody({
        code: 'ZZ.P95',
        lecturerCode: 'GV001',
        capacity: 60,
        meetings: [meeting({ dayOfWeek: 4, startSlot: 5, endSlot: 6, room: 'B1.14' })],
      }),
      actor,
    )
    expect(saved.code).toBe('ZZ.P95')
  })

  it('LHP-02: REGISTRATION refuses create, delete, credits and every locked field change', async () => {
    const created = await section('ZZ.P96')
    expect(
      (await failureOf(service.create(OPEN_TERM, sectionBody({ code: 'ZZ.P97' }), actor))).response
        ?.code,
    ).toBe('PHASE_LOCKED')
    expect((await failureOf(service.remove(OPEN_TERM, created.id, actor))).response?.code).toBe(
      'PHASE_LOCKED',
    )
    expect(
      (
        await failureOf(
          service.updateCredits(OPEN_TERM, created.offeredCourseId, { credits: 2 }, actor),
        )
      ).response?.code,
    ).toBe('CREDITS_LOCKED')

    const row = await section('ZZ.P96')
    const base = {
      code: 'ZZ.P96',
      courseCode: row.offeredCourse.course.code,
      systemCode: 'CQUI',
      lecturerCode: null,
      capacity: 50,
      reservedAdmissionYear: 2021,
      language: 'VN',
      note: null,
      practiceMode: null,
      parentCode: null,
      meetings: [meeting({ room: '', startDate: '2027-01-11', endDate: '2027-02-08', cadence: 2 })],
    }
    const changed = await failureOf(
      service.update(OPEN_TERM, created.id, { ...base, language: 'EN' }, actor),
    )
    expect(changed.response?.code).toBe('PHASE_LOCKED')
    expect(changed.response?.fieldErrors?.language).toBeTruthy()
    const moved = await failureOf(
      service.update(
        OPEN_TERM,
        created.id,
        { ...base, meetings: [meeting({ startSlot: 4, room: '' })] },
        actor,
      ),
    )
    expect(moved.response?.fieldErrors?.['meetings.0.startSlot']).toBeTruthy()
  })

  it('LHP-02: REGISTRATION allows capacity growth and filling an empty lecturer or room', async () => {
    const row = await section('ZZ.P96')
    const base = {
      code: 'ZZ.P96',
      courseCode: row.offeredCourse.course.code,
      systemCode: 'CQUI',
      lecturerCode: 'GV002',
      capacity: 80,
      reservedAdmissionYear: 2021,
      language: 'VN',
      note: null,
      practiceMode: null,
      parentCode: null,
      meetings: [meeting({ room: 'A2.08' })],
    }
    const updated = await service.update(OPEN_TERM, row.id, base, actor)
    expect(updated.code).toBe('ZZ.P96')
    const after = await section('ZZ.P96')
    expect(after.capacity).toBe(80)
    expect(after.lecturer?.lecturerCode).toBe('GV002')
    expect(after.meetings[0]!.room).toBe('A2.08')
  })

  it('LHP-02: a capacity below the already-registered count is refused', async () => {
    const row = await section('ZZ.P96')
    await prisma.courseSection.update({
      where: { id: row.id },
      data: { enrolledCount: 2 },
    })
    const base = {
      code: 'ZZ.P96',
      courseCode: row.offeredCourse.course.code,
      systemCode: 'CQUI',
      lecturerCode: 'GV002',
      capacity: 1,
      reservedAdmissionYear: 2021,
      language: 'VN',
      note: null,
      practiceMode: null,
      parentCode: null,
      meetings: [meeting({ room: 'A2.08' })],
    }
    const failure = await failureOf(service.update(OPEN_TERM, row.id, base, actor))
    expect(failure.response?.fieldErrors?.capacity).toContain('2')
    const still = await section('ZZ.P96')
    expect(still.capacity).toBe(80)
  })

  it('ADR-0002: deleting a group removes its parent and all sibling groups', async () => {
    const parent = await section('ZZ.P91')
    const child = await section('ZZ.P91.1')
    const result = await service.remove(TERM, child.id, actor)
    expect(result.deleted).toBeGreaterThanOrEqual(4)
    expect(
      await prisma.courseSection.count({
        where: { id: { in: [parent.id, child.id] } },
      }),
    ).toBe(0)
    for (const removed of [parent.id, child.id]) {
      const index = createdIds.indexOf(removed)
      if (index >= 0) createdIds.splice(index, 1)
    }
  })
})
