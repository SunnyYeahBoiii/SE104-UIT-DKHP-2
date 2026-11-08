import {
  AttemptType,
  CourseType,
  EnrollmentStatus,
  GradebookStatus,
  PracticeMode,
  PrerequisiteType,
  TermPhase,
  TermType,
} from '../../src/generated/prisma/enums'
import type { Catalog, CourseInfo } from './catalog'
import { addDays, addHours, createRng, type Db, must, range, toScore, weeksMask } from './lib'
import type { People, StaffUsers, StudentInfo } from './people'
import { AMENDMENT, DEMO, FORCED_SCORES } from './scenarios'
import { ACTIVE_TERMS, OPEN_TERM, type TermInfo } from './terms'

// ───────────────────────────── What students take ─────────────────────────────

const K19_HISTORY = {
  '20251': ['IT002', 'IT002TH', 'IT003', 'IT003TH', 'IT004', 'IT004TH'],
  '20252': ['IT005', 'IT005TH', 'IT007', 'IT007TH', 'SS003'],
}

/** Regular study plan per (cohort, major) for the past and in-progress terms. */
const COHORT_PLANS: { cohort: string; major: string; terms: Record<string, string[]> }[] = [
  {
    cohort: 'K18',
    major: 'KTPM',
    terms: {
      '20251': ['IT007', 'IT007TH', 'SE104', 'SE104TH', 'SS003'],
      '20252': ['SE100', 'SE100TH', 'SE113', 'SE113TH'],
      '20261': ['SE121', 'SE121TH', 'CS106'],
    },
  },
  { cohort: 'K19', major: 'KTPM', terms: { ...K19_HISTORY, '20261': ['SE104', 'SE104TH'] } },
  {
    cohort: 'K19',
    major: 'KHMT',
    terms: { ...K19_HISTORY, '20261': ['CS106', 'SE104', 'SE104TH'] },
  },
  {
    cohort: 'K20',
    major: 'KTPM',
    terms: {
      '20251': ['IT001', 'IT001TH', 'MA003', 'ENG01'],
      '20252': ['IT002', 'IT002TH', 'MA006', 'SS003'],
      '20261': ['IT003', 'IT003TH', 'IT004', 'IT004TH'],
    },
  },
]

/** Summer only runs what someone retakes. */
const SUMMER_PLAN: Record<string, string[]> = { [DEMO.summerRetake]: ['IT003'] }

/** Everything opened for registration in the open term. */
const OPEN_TERM_OFFERINGS = [
  'SE100',
  'SE100TH',
  'SE113',
  'SE113TH',
  'IT002',
  'IT002TH',
  'IT005',
  'IT005TH',
  'CS106',
  'MA006',
  'SE121',
  'SE121TH',
]

/** DT-11: these theory sections run their practice as HT2 (one self-scheduled group); the rest use HT1. */
const SELF_SCHEDULED = new Set(['SE121'])

/** Extra theory sections beyond the first. */
const EXTRA_SECTIONS: Record<string, number> = { [`${OPEN_TERM}:IT002`]: 1 }

/** Deliberately tiny sections, to show a full class (DK-09). */
const CAPACITY_OVERRIDES: Record<string, number> = { [`${OPEN_TERM}:CS106`]: 1 }

/** Registrations already made in the open term, by section code. `cancelled` lines were cancelled before the
 * student registered another section, since there is no switch (DK-13). */
const OPEN_TERM_REGISTRATIONS: { student: string; sections: string[]; cancelled?: string[] }[] = [
  { student: DEMO.student, sections: ['MA006.P21'] },
  {
    student: DEMO.pendingPrerequisite,
    sections: ['SE100.P21', 'SE100.P21.1', 'SE113.P21', 'SE113.P21.2', 'CS106.P21'],
  },
  { student: DEMO.improvement, sections: ['SE113.P21', 'SE113.P21.1'] },
  { student: DEMO.retakeReregistered, sections: ['IT002.P22'], cancelled: ['IT002.P21'] },
]

/** Whether the student studies in the term at all (HS-06). Shared with the tuition step. */
export function studiesIn(student: StudentInfo, termCode: string) {
  if (student.code === DEMO.withdrawn) return termCode < '20252'
  if (student.code === DEMO.onLeave) return termCode !== OPEN_TERM
  return true
}

// ───────────────────────────── Sections & schedule ─────────────────────────────

// HP-04: every seeded cohort keeps the default fee schedule rates.
const THEORY_CREDIT_RATE = 27_000n
const PRACTICE_CREDIT_RATE = 37_000n

const THEORY_ROOMS = ['B1.14', 'B3.06', 'C2.12', 'C3.14', 'E3.1', 'A2.08']
const LAB_ROOMS = ['B4.02', 'B4.04', 'B4.06', 'C1.08']

type MeetingSeed = {
  dayOfWeek: number
  startSlot: number
  endSlot: number
  room: string
  weeks: number
}

type SectionInfo = {
  id: number
  code: string
  course: CourseInfo
  lecturerUserId: number
  meetings: MeetingSeed[]
  children: SectionInfo[]
}

/**
 * Courses with practice groups take the first six indexes, one weekday each: theory in the morning
 * (slots 1–3), practice groups in the afternoon (6–10) on alternating weeks. Other courses fill morning
 * slots 4–5. Seeded students therefore never clash; `assertNoConflicts` double-checks.
 */
function theoryMeeting(term: TermInfo, courseIndex: number, sectionNumber: number): MeetingSeed {
  const day = 2 + ((courseIndex + (sectionNumber - 1) * 3) % 6)
  const room = THEORY_ROOMS[courseIndex % THEORY_ROOMS.length]!
  if (term.type === TermType.SUMMER)
    return { dayOfWeek: day, startSlot: 1, endSlot: 5, room, weeks: weeksMask(range(1, 8)) }
  const [startSlot, endSlot] = courseIndex < 6 ? [1, 3] : [4, 5]
  return { dayOfWeek: day, startSlot, endSlot, room, weeks: weeksMask(range(1, 15)) }
}

function practiceMeeting(courseIndex: number, sectionNumber: number, group: number): MeetingSeed {
  const firstWeek = group % 2 === 1 ? 1 : 2
  return {
    dayOfWeek: 2 + ((courseIndex + (sectionNumber - 1) * 3) % 6),
    startSlot: 6,
    endSlot: 10,
    room: LAB_ROOMS[(courseIndex + group) % LAB_ROOMS.length]!,
    weeks: weeksMask(range(0, 5).map((i) => firstWeek + 2 * i)),
  }
}

async function seedOfferings(
  db: Db,
  catalog: Catalog,
  people: People,
  term: TermInfo,
  courseCodes: Set<string>,
) {
  const lecturers = people.lecturers
  let nextLecturer = term.number
  const takeLecturer = () => lecturers[nextLecturer++ % lecturers.length]!

  const offered = new Map<string, number>()
  for (const code of courseCodes) {
    const row = await db.offeredCourse.create({
      data: { termId: term.id, courseId: must(catalog.courses, code).id },
    })
    offered.set(code, row.id)
  }

  const hasPractice = (c: CourseInfo) => courseCodes.has(`${c.code}TH`)
  const schedulable = [...courseCodes]
    .map((code) => must(catalog.courses, code))
    .filter((c) => c.type === CourseType.THEORY)
    .sort(
      (a, b) =>
        Number(hasPractice(b)) - Number(hasPractice(a)) ||
        Number(b.type === CourseType.THEORY) - Number(a.type === CourseType.THEORY),
    )

  const sections = new Map<string, SectionInfo>()
  for (const [courseIndex, course] of schedulable.entries()) {
    const sectionCount = 1 + (EXTRA_SECTIONS[`${term.code}:${course.code}`] ?? 0)
    for (let sectionNumber = 1; sectionNumber <= sectionCount; sectionNumber++) {
      const code = `${course.code}.P${term.number}${sectionNumber}`
      const lecturer = takeLecturer()
      const meetings = [theoryMeeting(term, courseIndex, sectionNumber)]
      const capacity = CAPACITY_OVERRIDES[`${term.code}:${course.code}`] ?? 80
      const practiceMode = !hasPractice(course)
        ? null
        : SELF_SCHEDULED.has(course.code)
          ? PracticeMode.SELF_SCHEDULED
          : PracticeMode.SCHEDULED
      const row = await db.courseSection.create({
        data: {
          offeredCourseId: must(offered, course.code),
          code,
          lecturerId: lecturer.id,
          capacity,
          practiceMode,
          meetings: { create: meetings },
        },
      })
      const section: SectionInfo = {
        id: row.id,
        code,
        course,
        lecturerUserId: lecturer.userId,
        meetings,
        children: [],
      }

      if (hasPractice(course)) {
        const practiceCourse = must(catalog.courses, `${course.code}TH`)
        // HT1: two groups on alternating weeks. HT2: one group, no meetings, as large as the theory section.
        const selfScheduled = practiceMode === PracticeMode.SELF_SCHEDULED
        for (const group of selfScheduled ? [1] : [1, 2]) {
          const childLecturer = takeLecturer()
          const childMeetings = selfScheduled
            ? []
            : [practiceMeeting(courseIndex, sectionNumber, group)]
          const child = await db.courseSection.create({
            data: {
              offeredCourseId: must(offered, practiceCourse.code),
              code: `${code}.${group}`,
              lecturerId: childLecturer.id,
              capacity: selfScheduled ? capacity : 40,
              parentSectionId: row.id,
              meetings: { create: childMeetings },
            },
          })
          const childInfo = {
            id: child.id,
            code: `${code}.${group}`,
            course: practiceCourse,
            lecturerUserId: childLecturer.userId,
            meetings: childMeetings,
            children: [],
          }
          section.children.push(childInfo)
          sections.set(childInfo.code, childInfo)
        }
      }
      sections.set(code, section)
    }
  }
  return sections
}

/** DK-07: same weekday, overlapping slots and at least one shared week. */
function assertNoConflicts(studentCode: string, termCode: string, chosen: SectionInfo[]) {
  const meetings = chosen.flatMap((s) => s.meetings.map((m) => ({ ...m, section: s.code })))
  for (const [i, a] of meetings.entries()) {
    for (const b of meetings.slice(i + 1)) {
      if (
        a.dayOfWeek === b.dayOfWeek &&
        a.startSlot <= b.endSlot &&
        b.startSlot <= a.endSlot &&
        (a.weeks & b.weeks) !== 0
      ) {
        throw new Error(
          `Seed schedule conflict for ${studentCode} in ${termCode}: ${a.section} × ${b.section}`,
        )
      }
    }
  }
}

// ───────────────────────────── Grades ─────────────────────────────

type ComponentSeed = { name: string; weight: number; isFinal: boolean }

function componentsFor(course: CourseInfo): ComponentSeed[] {
  // A self-scheduled project (SE121TH) is graded on its report alone.
  if (
    course.type === CourseType.PRACTICE &&
    course.companion &&
    SELF_SCHEDULED.has(course.companion)
  )
    return [{ name: 'Báo cáo đồ án', weight: 100, isFinal: true }]
  if (course.type === CourseType.PRACTICE) {
    return [
      { name: 'Bài tập thực hành', weight: 50, isFinal: false },
      { name: 'Thi thực hành', weight: 50, isFinal: true },
    ]
  }
  return [
    { name: 'Quá trình', weight: 20, isFinal: false },
    { name: 'Giữa kỳ', weight: 30, isFinal: false },
    { name: 'Cuối kỳ', weight: 50, isFinal: true },
  ]
}

const courseScoreOf = (scores: { weight: number; tenths: number }[]) =>
  Math.round(scores.reduce((sum, s) => sum + s.weight * s.tenths, 0) / 100)

// ───────────────────────────── Orchestration ─────────────────────────────

export type EnrollmentRecord = {
  id: number
  student: StudentInfo
  termCode: string
  courseCode: string
  attemptType: AttemptType
  status: EnrollmentStatus
  surcharge: bigint
  registeredAt: Date
  cancelledAt: Date | null
}

type Request = { student: StudentInfo; section: SectionInfo; cancelled: boolean }

export async function seedAcademics(
  db: Db,
  catalog: Catalog,
  people: People,
  terms: Map<string, TermInfo>,
  now: Date,
): Promise<EnrollmentRecord[]> {
  const rng = createRng(2026)
  const ability = new Map(people.students.map((s) => [s.id, 65 + Math.floor(rng() * 24)]))
  const byCode = new Map(people.students.map((s) => [s.code, s]))
  /** KQ-07 effective result per student and course: the latest pass if any, else the latest attempt. */
  const results = new Map<number, Map<string, { passed: boolean }>>()
  const records: EnrollmentRecord[] = []

  for (const termCode of ACTIVE_TERMS) {
    const term = must(terms, termCode)
    const active = people.students.filter((s) => studiesIn(s, termCode))

    // 1. What is requested, then what must be offered.
    const planned = new Map<StudentInfo, string[]>()
    if (termCode === OPEN_TERM) {
      // Explicit section codes below.
    } else if (term.type === TermType.SUMMER) {
      for (const [code, courses] of Object.entries(SUMMER_PLAN))
        planned.set(must(byCode, code), courses)
    } else {
      for (const student of active) {
        const plan = COHORT_PLANS.find(
          (p) => p.cohort === student.cohort && p.major === student.major,
        )
        planned.set(student, plan?.terms[termCode] ?? [])
      }
    }
    const courseCodes = new Set(
      termCode === OPEN_TERM ? OPEN_TERM_OFFERINGS : [...planned.values()].flat(),
    )
    const sections = await seedOfferings(db, catalog, people, term, courseCodes)

    // 2. Resolve requests to sections.
    const requests: Request[] = []
    if (termCode === OPEN_TERM) {
      for (const r of OPEN_TERM_REGISTRATIONS) {
        const student = must(byCode, r.student)
        for (const code of r.cancelled ?? [])
          requests.push({ student, section: must(sections, code), cancelled: true })
        for (const code of r.sections)
          requests.push({ student, section: must(sections, code), cancelled: false })
      }
    } else {
      for (const [student, courses] of planned) {
        for (const code of courses) {
          const course = must(catalog.courses, code)
          const own = (c: string) =>
            [...sections.values()].find((s) => s.course.code === c && !s.code.match(/\.\d+$/))
          let section: SectionInfo | undefined
          if (course.type === CourseType.PRACTICE) {
            const parent = own(course.companion ?? '')
            section = parent?.children[student.index % parent.children.length]
          } else {
            section = own(code)
          }
          if (!section) throw new Error(`No section of ${code} in ${termCode}`)
          requests.push({ student, section, cancelled: false })
        }
      }
    }

    // 3. Forms and enrollments.
    const inProgress = new Map<number, Set<string>>()
    for (const r of records.filter(
      (r) => r.termCode === '20261' && r.status === EnrollmentStatus.FINALIZED,
    )) {
      inProgress.set(r.student.id, (inProgress.get(r.student.id) ?? new Set()).add(r.courseCode))
    }

    const forms = new Map<number, number>()
    const isOpen = termCode === OPEN_TERM
    for (const student of new Set(requests.map((r) => r.student))) {
      assertNoConflicts(
        student.code,
        termCode,
        requests.filter((r) => r.student === student && !r.cancelled).map((r) => r.section),
      )
      const form = await db.registrationForm.create({
        data: {
          studentId: student.id,
          termId: term.id,
          finalizedAt: isOpen ? null : term.adjustmentEndAt,
        },
      })
      forms.set(student.id, form.id)
    }

    const rows = requests.map(({ student, section, cancelled }) => {
      const course = section.course
      const previous = results.get(student.id)?.get(course.code)
      const inCurriculum = must(
        catalog.curriculumCourses,
        `${student.major}:${student.cohort}`,
      ).has(course.code)
      // DK-16
      const attemptType = !inCurriculum
        ? AttemptType.FREE_ELECTIVE
        : previous
          ? previous.passed
            ? AttemptType.IMPROVEMENT
            : AttemptType.RETAKE
          : AttemptType.FIRST
      // HP-03
      const surchargeable =
        term.type === TermType.SUMMER
          ? attemptType !== AttemptType.FREE_ELECTIVE
          : attemptType === AttemptType.RETAKE || attemptType === AttemptType.IMPROVEMENT
      const creditRate =
        course.type === CourseType.THEORY ? THEORY_CREDIT_RATE : PRACTICE_CREDIT_RATE
      // DK-05: a prerequisite still in progress last term makes the line conditional.
      const pendingPrerequisite = (catalog.prerequisites.get(course.code) ?? []).some(
        (p) =>
          !(p.type === PrerequisiteType.REQUIRED_PASS
            ? results.get(student.id)?.get(p.prerequisite)?.passed
            : results.get(student.id)?.has(p.prerequisite)) &&
          isOpen &&
          (inProgress.get(student.id)?.has(p.prerequisite) ?? false),
      )

      let registeredAt = addHours(term.registrationStartAt, 2 + (student.index % 20))
      if (isOpen)
        registeredAt =
          student.cohort === 'K18'
            ? addHours(term.registrationStartAt, 2)
            : addHours(now, cancelled ? -22 : -20)
      const cancelledAt = cancelled ? addHours(now, -20) : null

      return {
        student,
        section,
        data: {
          formId: must(forms, student.id),
          sectionId: section.id,
          courseId: course.id,
          status: cancelled
            ? EnrollmentStatus.CANCELLED
            : isOpen
              ? EnrollmentStatus.REGISTERED
              : EnrollmentStatus.FINALIZED,
          attemptType,
          pendingPrerequisite,
          credits: course.credits,
          creditRate,
          surcharge: surchargeable ? BigInt(course.credits) * creditRate : 0n,
          registeredAt,
          cancelledAt,
          finalizedAt: isOpen ? null : term.adjustmentEndAt,
        },
      }
    })

    const created = await db.enrollment.createManyAndReturn({ data: rows.map((r) => r.data) })
    const idOf = new Map(created.map((e) => [`${e.formId}:${e.sectionId}`, e.id]))
    const enrollments = rows.map((r) => ({
      ...r,
      id: must(idOf, `${r.data.formId}:${r.data.sectionId}`),
    }))

    for (const e of enrollments) {
      records.push({
        id: e.id,
        student: e.student,
        termCode,
        courseCode: e.section.course.code,
        attemptType: e.data.attemptType,
        status: e.data.status,
        surcharge: e.data.surcharge,
        registeredAt: e.data.registeredAt,
        cancelledAt: e.data.cancelledAt,
      })
    }

    // 4. Gradebooks once classes have started.
    if (term.phase === TermPhase.CLOSED || term.phase === TermPhase.IN_PROGRESS) {
      await seedGrades(db, people.staff, term, enrollments, { rng, ability, results })
    }
  }

  await seedAmendment(db, people.staff, catalog, byCode, terms)
  // ADR-0005 keeps the counter in step with the seats taken; the seed sets it once at the end.
  await db.$executeRaw`
    UPDATE course_section s
    SET enrolled_count = (SELECT count(*)::int FROM enrollment e WHERE e.section_id = s.id AND e.status <> 'CANCELLED')`
  return records
}

type GradeState = {
  rng: () => number
  ability: Map<number, number>
  results: Map<number, Map<string, { passed: boolean }>>
}

async function seedGrades(
  db: Db,
  staff: StaffUsers,
  term: TermInfo,
  enrollments: { id: number; student: StudentInfo; section: SectionInfo }[],
  state: GradeState,
) {
  const locked = term.phase === TermPhase.CLOSED
  const submittedAt = addDays(term.tuitionDeadline, 75)
  const scoreRows: { enrollmentId: number; componentId: number; score: string }[] = []
  const courseScores: { id: number; tenths: number }[] = []

  for (const section of new Set(enrollments.map((e) => e.section))) {
    const gradebook = await db.gradebook.create({
      data: {
        sectionId: section.id,
        status: locked ? GradebookStatus.LOCKED : GradebookStatus.DRAFT,
        submittedAt: locked ? submittedAt : null,
        submittedById: locked ? section.lecturerUserId : null,
        lockedAt: locked ? addDays(submittedAt, 3) : null,
        lockedById: locked ? staff.academicOffice : null,
        components: {
          create: componentsFor(section.course).map((c, sortOrder) => ({ ...c, sortOrder })),
        },
      },
      include: { components: { orderBy: { sortOrder: 'asc' } } },
    })

    for (const e of enrollments.filter((e) => e.section === section)) {
      const forced = FORCED_SCORES[`${e.student.code}:${term.code}:${section.course.code}`]
      const target = forced ?? must(state.ability, e.student.id) + Math.floor(state.rng() * 17) - 8
      // CT-03: a banned student's final exam is 0.
      const banned = e.student.code === DEMO.examBanned && term.code === '20252'
      const scored = gradebook.components.map((c) => ({
        componentId: c.id,
        weight: c.weight,
        tenths:
          banned && c.isFinal
            ? 0
            : Math.min(100, Math.max(0, target + Math.floor(state.rng() * 11) - 5)),
      }))
      // An in-progress term only has the first component entered so far.
      for (const s of locked ? scored : scored.slice(0, 1)) {
        scoreRows.push({ enrollmentId: e.id, componentId: s.componentId, score: toScore(s.tenths) })
      }
      if (locked) {
        const tenths = courseScoreOf(scored)
        courseScores.push({ id: e.id, tenths })
        const results = state.results.get(e.student.id) ?? new Map<string, { passed: boolean }>()
        // KQ-07: a later failure never hides an earlier pass.
        if (!results.get(section.course.code)?.passed)
          results.set(section.course.code, { passed: tenths >= 50 })
        state.results.set(e.student.id, results)
      }
    }
  }

  await db.componentScore.createMany({ data: scoreRows })
  await db.$transaction(
    courseScores.map((s) =>
      db.enrollment.update({ where: { id: s.id }, data: { courseScore: toScore(s.tenths) } }),
    ),
  )
}

/** KQ-06: one post-lock change with its reason; the course score is recomputed. */
async function seedAmendment(
  db: Db,
  staff: StaffUsers,
  catalog: Catalog,
  byCode: Map<string, StudentInfo>,
  terms: Map<string, TermInfo>,
) {
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: {
      courseId: must(catalog.courses, AMENDMENT.courseCode).id,
      form: {
        studentId: must(byCode, AMENDMENT.student).id,
        termId: must(terms, AMENDMENT.termCode).id,
      },
    },
    include: {
      componentScores: { include: { component: true } },
      section: { include: { gradebook: true } },
    },
  })
  const final = enrollment.componentScores.find((s) => s.component.isFinal)
  if (!final) throw new Error('amendment target has no final score')

  const oldTenths = Math.round(Number(final.score) * 10)
  const newTenths = Math.min(100, oldTenths + 10)
  await db.componentScore.update({
    where: {
      enrollmentId_componentId: { enrollmentId: enrollment.id, componentId: final.componentId },
    },
    data: { score: toScore(newTenths) },
  })
  const scores = enrollment.componentScores.map((s) => ({
    weight: s.component.weight,
    tenths: s === final ? newTenths : Math.round(Number(s.score) * 10),
  }))
  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { courseScore: toScore(courseScoreOf(scores)) },
  })
  await db.gradeAmendment.create({
    data: {
      enrollmentId: enrollment.id,
      componentId: final.componentId,
      oldScore: toScore(oldTenths),
      newScore: toScore(newTenths),
      reason: AMENDMENT.reason,
      amendedById: staff.academicOffice,
      createdAt: addDays(enrollment.section.gradebook?.lockedAt ?? new Date(), 14),
    },
  })
}
