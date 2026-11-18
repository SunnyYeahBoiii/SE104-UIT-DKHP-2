import {
  AttemptType,
  CourseType,
  EnrollmentStatus,
  PracticeMode,
} from '../../src/generated/prisma/enums'
import type { Catalog, CourseInfo } from './catalog'
import { type Db, must, range, toScore, vn, weeksMask } from './lib'
import type { People } from './people'
import { DEMO } from './scenarios'
import { IN_PROGRESS_TERM, OPEN_TERM, SUMMER_TERM, type TermInfo } from './terms'
import { TermType } from '../../src/generated/prisma/enums'

// HP-01 default rates (A.7): 27.000đ theory, 37.000đ practice. Frozen on each line at registration.
const THEORY_RATE = 27_000n
const PRACTICE_RATE = 37_000n

type MeetingSeed = {
  dayOfWeek: number
  startSlot: number
  endSlot: number
  room: string
  weeks: number
}

const weekly = (day: number, from: number, to: number, room: string, count = 15): MeetingSeed => ({
  dayOfWeek: day,
  startSlot: from,
  endSlot: to,
  room,
  weeks: weeksMask(range(1, count)),
})

const biweekly = (
  day: number,
  from: number,
  to: number,
  room: string,
  firstWeek: number,
): MeetingSeed => ({
  dayOfWeek: day,
  startSlot: from,
  endSlot: to,
  room,
  weeks: weeksMask(range(0, 8).map((i) => firstWeek + 2 * i)),
})

type SectionSeed = {
  term: string
  course: string
  code: string
  system: string
  capacity: number
  lecturer?: string
  language?: string
  parent?: string
  practiceMode?: PracticeMode
  meetings?: MeetingSeed[]
}

/** A.7 classes. Parent sections come before their practice groups. */
const SECTIONS: SectionSeed[] = [
  // 20261 — the in-progress term: SE104 is being taken with no result yet (DK-05).
  {
    term: IN_PROGRESS_TERM,
    course: 'SE104',
    code: 'SE104.P11',
    system: 'CQUI',
    capacity: 80,
    lecturer: 'GV001',
    meetings: [weekly(3, 1, 3, 'B1.14')],
  },
  // 20262 — registration is open.
  {
    term: OPEN_TERM,
    course: 'SE104',
    code: 'SE104.P21',
    system: 'CQUI',
    capacity: 80,
    lecturer: 'GV001',
    practiceMode: PracticeMode.SCHEDULED,
    meetings: [weekly(2, 1, 3, 'B1.14')],
  },
  {
    term: OPEN_TERM,
    course: 'SE104TH',
    code: 'SE104.P21.1',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV002',
    parent: 'SE104.P21',
    meetings: [biweekly(2, 6, 10, 'B4.02', 1)],
  },
  {
    term: OPEN_TERM,
    course: 'SE104TH',
    code: 'SE104.P21.2',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV003',
    parent: 'SE104.P21',
    meetings: [biweekly(2, 6, 10, 'B4.02', 2)],
  },
  {
    term: OPEN_TERM,
    course: 'SE104',
    code: 'SE104.P23',
    system: 'CLC',
    capacity: 50,
    lecturer: 'GV004',
    language: 'EN',
    practiceMode: PracticeMode.SCHEDULED,
    meetings: [weekly(4, 6, 8, 'C3.12')],
  },
  {
    term: OPEN_TERM,
    course: 'SE104TH',
    code: 'SE104.P23.1',
    system: 'CLC',
    capacity: 40,
    lecturer: 'GV005',
    parent: 'SE104.P23',
    meetings: [weekly(5, 6, 10, 'B4.04')],
  },
  {
    term: OPEN_TERM,
    course: 'IT004',
    code: 'IT004.P21',
    system: 'CQUI',
    capacity: 80,
    lecturer: 'GV003',
    practiceMode: PracticeMode.SELF_SCHEDULED,
    meetings: [weekly(3, 1, 3, 'B3.06')],
  },
  {
    term: OPEN_TERM,
    course: 'IT004TH',
    code: 'IT004.P21.1',
    system: 'CQUI',
    capacity: 80,
    parent: 'IT004.P21',
  },
  {
    term: OPEN_TERM,
    course: 'IT002',
    code: 'IT002.P21',
    system: 'CQUI',
    capacity: 80,
    lecturer: 'GV002',
    practiceMode: PracticeMode.SCHEDULED,
    meetings: [weekly(5, 1, 3, 'B3.06')],
  },
  {
    term: OPEN_TERM,
    course: 'IT002TH',
    code: 'IT002.P21.1',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV004',
    parent: 'IT002.P21',
    meetings: [biweekly(5, 6, 10, 'B4.02', 1)],
  },
  {
    term: OPEN_TERM,
    course: 'IT002',
    code: 'IT002.P22',
    system: 'CQUI',
    capacity: 80,
    practiceMode: PracticeMode.SCHEDULED,
    meetings: [weekly(6, 1, 3, 'C2.12')],
  },
  {
    term: OPEN_TERM,
    course: 'IT002TH',
    code: 'IT002.P22.1',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV006',
    parent: 'IT002.P22',
    meetings: [biweekly(6, 6, 10, 'B4.04', 1)],
  },
  {
    term: OPEN_TERM,
    course: 'SE100',
    code: 'SE100.P21',
    system: 'CQUI',
    capacity: 80,
    lecturer: 'GV004',
    practiceMode: PracticeMode.SCHEDULED,
    meetings: [weekly(3, 4, 5, 'C3.14')],
  },
  {
    term: OPEN_TERM,
    course: 'SE100TH',
    code: 'SE100.P21.1',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV006',
    parent: 'SE100.P21',
    meetings: [biweekly(3, 6, 10, 'B4.06', 1)],
  },
  {
    term: OPEN_TERM,
    course: 'SE113',
    code: 'SE113.P21',
    system: 'CQUI',
    capacity: 80,
    lecturer: 'GV005',
    practiceMode: PracticeMode.SCHEDULED,
    meetings: [weekly(4, 1, 3, 'A2.08')],
  },
  {
    term: OPEN_TERM,
    course: 'SE113TH',
    code: 'SE113.P21.1',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV001',
    parent: 'SE113.P21',
    meetings: [biweekly(4, 6, 10, 'B4.06', 1)],
  },
  {
    term: OPEN_TERM,
    course: 'CS106',
    code: 'CS106.P21',
    system: 'CQUI',
    capacity: 1,
    lecturer: 'GV006',
    meetings: [weekly(6, 4, 5, 'E3.1')],
  },
  {
    term: OPEN_TERM,
    course: 'SE121',
    code: 'SE121.P21',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV003',
  },
  {
    term: OPEN_TERM,
    course: 'CE119',
    code: 'CE119.P21.1',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV005',
    meetings: [weekly(2, 4, 5, 'C1.08')],
  },
  // 20263 — summer retake, no fixed tuition.
  {
    term: SUMMER_TERM,
    course: 'IT003',
    code: 'IT003.P31',
    system: 'CQUI',
    capacity: 40,
    lecturer: 'GV003',
    meetings: [weekly(2, 1, 5, 'B3.06', 8)],
  },
]

type SectionInfo = { id: number; code: string; course: CourseInfo }

type RegistrationSeed = {
  student: string
  sectionCode: string
  attempt: AttemptType
  registeredAt: Date
  status?: EnrollmentStatus
  finalizedAt?: Date
  cancelledAt?: Date
  pendingPrerequisite?: boolean
}

const at = (date: string, hour: number) => vn(date, `${String(hour).padStart(2, '0')}:00`)

/** A.7 registrations. K18's window was 05/01; K19 registered on 06/01, the current day. */
function registrations(terms: Map<string, TermInfo>): RegistrationSeed[] {
  const inProgress = must(terms, IN_PROGRESS_TERM)
  return [
    {
      student: DEMO.pendingPrerequisite,
      sectionCode: 'SE104.P11',
      attempt: AttemptType.FIRST,
      registeredAt: at('2026-08-18', 8),
      status: EnrollmentStatus.FINALIZED,
      finalizedAt: inProgress.adjustmentEndAt,
    },
    {
      student: DEMO.student,
      sectionCode: 'SE104.P21',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 8),
    },
    {
      student: DEMO.student,
      sectionCode: 'SE104.P21.1',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 8),
    },
    {
      student: DEMO.pendingPrerequisite,
      sectionCode: 'SE100.P21',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 9),
      pendingPrerequisite: true,
    },
    {
      student: DEMO.pendingPrerequisite,
      sectionCode: 'SE100.P21.1',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 9),
      pendingPrerequisite: true,
    },
    {
      student: DEMO.pendingPrerequisite,
      sectionCode: 'SE113.P21',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 9),
      pendingPrerequisite: true,
    },
    {
      student: DEMO.pendingPrerequisite,
      sectionCode: 'SE113.P21.1',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 9),
      pendingPrerequisite: true,
    },
    {
      student: DEMO.improvement,
      sectionCode: 'SE113.P21',
      attempt: AttemptType.IMPROVEMENT,
      registeredAt: at('2027-01-05', 9),
    },
    {
      student: DEMO.retakeReregistered,
      sectionCode: 'IT002.P21',
      attempt: AttemptType.RETAKE,
      registeredAt: at('2027-01-06', 8),
      status: EnrollmentStatus.CANCELLED,
      cancelledAt: at('2027-01-06', 9),
    },
    {
      student: DEMO.retakeReregistered,
      sectionCode: 'IT002.P22',
      attempt: AttemptType.RETAKE,
      registeredAt: at('2027-01-06', 10),
    },
    {
      student: DEMO.fullClass,
      sectionCode: 'CS106.P21',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 8),
    },
    {
      student: DEMO.clcStudent,
      sectionCode: 'SE104.P23',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 8),
    },
    {
      student: DEMO.clcStudent,
      sectionCode: 'SE104.P23.1',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 8),
    },
    {
      student: DEMO.recalculated,
      sectionCode: 'SE121.P21',
      attempt: AttemptType.FIRST,
      registeredAt: at('2027-01-06', 8),
    },
    {
      student: DEMO.summerRetake,
      sectionCode: 'IT003.P31',
      attempt: AttemptType.RETAKE,
      registeredAt: at('2027-06-14', 9),
    },
  ]
}

export type EnrollmentRecord = {
  id: number
  studentCode: string
  termCode: string
  courseCode: string
  attemptType: AttemptType
  surcharge: bigint
  registeredAt: Date
  cancelledAt: Date | null
}

const rateOf = (course: CourseInfo) =>
  course.type === CourseType.THEORY ? THEORY_RATE : PRACTICE_RATE

const surchargeOf = (term: TermInfo, course: CourseInfo, attempt: AttemptType) =>
  term.type === TermType.SUMMER || attempt !== AttemptType.FIRST
    ? BigInt(course.credits) * rateOf(course)
    : 0n

export async function seedAcademics(
  db: Db,
  catalog: Catalog,
  people: People,
  terms: Map<string, TermInfo>,
): Promise<EnrollmentRecord[]> {
  const sections = new Map<string, SectionInfo>()
  const offered = new Map<string, number>()

  for (const seed of SECTIONS) {
    const term = must(terms, seed.term)
    const course = must(catalog.courses, seed.course)
    const offeringKey = `${seed.term}:${seed.course}`
    let offeredCourseId = offered.get(offeringKey)
    if (offeredCourseId === undefined) {
      const created = await db.offeredCourse.create({
        data: { termId: term.id, courseId: course.id, credits: course.credits },
      })
      offeredCourseId = created.id
      offered.set(offeringKey, offeredCourseId)
    }
    const parent = seed.parent ? sections.get(seed.parent) : undefined
    if (seed.parent && !parent)
      throw new Error(`Seed section ${seed.code}: parent ${seed.parent} missing`)
    const created = await db.courseSection.create({
      data: {
        offeredCourseId,
        trainingSystemId: must(catalog.systems, seed.system),
        code: seed.code,
        lecturerId: seed.lecturer ? must(people.lecturers, seed.lecturer) : null,
        language: seed.language ?? null,
        capacity: seed.capacity,
        parentSectionId: parent?.id ?? null,
        practiceMode: seed.practiceMode ?? null,
        meetings: { create: seed.meetings ?? [] },
      },
    })
    sections.set(seed.code, { id: created.id, code: seed.code, course })
  }

  const forms = new Map<string, number>()
  const formKey = (studentCode: string, termCode: string) => `${studentCode}:${termCode}`
  const rows: (Omit<RegistrationSeed, 'sectionCode'> & {
    termCode: string
    section: SectionInfo
  })[] = []
  const seedRegistrations = registrations(terms)
  for (const reg of seedRegistrations) {
    const section = must(sections, reg.sectionCode)
    const seed = SECTIONS.find((s) => s.code === reg.sectionCode)
    if (!seed) throw new Error(`Seed registration: section ${reg.sectionCode} missing`)
    const termCode = seed.term
    const student = must(people.students, reg.student)
    const key = formKey(reg.student, termCode)
    let formId = forms.get(key)
    if (formId === undefined) {
      const term = must(terms, termCode)
      const form = await db.registrationForm.create({
        data: { studentId: student.id, termId: term.id, finalizedAt: reg.finalizedAt ?? null },
      })
      formId = form.id
      forms.set(key, formId)
    }
    rows.push({ ...reg, termCode, section })
  }

  const createdRows = await db.enrollment.createManyAndReturn({
    data: rows.map((reg) => {
      const term = must(terms, reg.termCode)
      return {
        formId: must(forms, formKey(reg.student, reg.termCode)),
        sectionId: reg.section.id,
        courseId: reg.section.course.id,
        status: reg.status ?? EnrollmentStatus.REGISTERED,
        attemptType: reg.attempt,
        pendingPrerequisite: reg.pendingPrerequisite ?? false,
        credits: reg.section.course.credits,
        creditRate: rateOf(reg.section.course),
        surcharge: surchargeOf(term, reg.section.course, reg.attempt),
        registeredAt: reg.registeredAt,
        cancelledAt: reg.cancelledAt ?? null,
        finalizedAt: reg.finalizedAt ?? null,
      }
    }),
  })

  const records: EnrollmentRecord[] = rows.map((reg, index) => ({
    id: createdRows[index]!.id,
    studentCode: reg.student,
    termCode: reg.termCode,
    courseCode: reg.section.course.code,
    attemptType: reg.attempt,
    surcharge: surchargeOf(must(terms, reg.termCode), reg.section.course, reg.attempt),
    registeredAt: reg.registeredAt,
    cancelledAt: reg.cancelledAt ?? null,
  }))

  // KQ-01/ADR-0018: past attempts and scores arrive from the university's grading system as seed data.
  const attemptSeeds: [student: string, termCode: string, course: string, tenths: number][] = [
    [DEMO.retakeReregistered, '20251', 'IT002', 40],
    [DEMO.retakeReregistered, '20252', 'IT002TH', 80],
    [DEMO.summerRetake, '20251', 'IT003', 40],
    [DEMO.improvement, '20252', 'SE113', 70],
  ]
  await db.takenCourse.createMany({
    data: attemptSeeds.map(([studentCode, termCode, courseCode, tenths]) => ({
      studentId: must(people.students, studentCode).id,
      courseId: must(catalog.courses, courseCode).id,
      termId: must(terms, termCode).id,
      courseScore: toScore(tenths),
    })),
  })

  // ADR-0005 keeps the counter in step with the seats taken; the seed sets it once at the end.
  await db.$executeRaw`
    UPDATE course_section s
    SET enrolled_count = (SELECT count(*)::int FROM enrollment e WHERE e.section_id = s.id AND e.status <> 'CANCELLED')`
  return records
}
