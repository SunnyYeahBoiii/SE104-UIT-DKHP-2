import { CourseType, PrerequisiteType } from '../../src/generated/prisma/enums'
import type { Db } from './lib'

/** HS-09: the catalogue is fixed reference data; only CQUI and CLC appear in the A.7 samples. */
const TRAINING_SYSTEMS: [code: string, name: string][] = [
  ['CQUI', 'Chính quy'],
  ['CTTT', 'Chương trình tiên tiến'],
  ['CLC', 'Chất lượng cao'],
  ['CNTN', 'Cử nhân tài năng'],
  ['BCU', 'Liên kết'],
  ['VB2CQ', 'Văn bằng 2'],
  ['LTĐH', 'Liên thông'],
]

/** A.7: K17 (2022), K18 (2023), K19 (2024), K20 (2025). */
export const COHORTS: [code: string, admissionYear: number][] = [
  ['K17', 2022],
  ['K18', 2023],
  ['K19', 2024],
  ['K20', 2025],
]

/** CONTEXT.md: rooms are background data. Codes used by the A.7 sections plus a few spares for import tests. */
const ROOM_CODES = [
  'A1.01',
  'A2.08',
  'B1.14',
  'B3.06',
  'B4.02',
  'B4.04',
  'B4.06',
  'C1.08',
  'C2.12',
  'C3.12',
  'C3.14',
  'E3.1',
]

const PRIORITY_GROUPS = [
  { code: 'LIET_SI', name: 'Con liệt sĩ', discountRate: 80, priority: 40 },
  { code: 'THUONG_BINH', name: 'Con thương binh, bệnh binh', discountRate: 50, priority: 30 },
  {
    code: 'DTTS_VUNG_SAU',
    name: 'Dân tộc thiểu số ở vùng sâu, vùng xa',
    discountRate: 70,
    priority: 20,
  },
  { code: 'HO_NGHEO', name: 'Thuộc hộ nghèo', discountRate: 50, priority: 10 },
]

type CourseSeed = {
  code: string
  name: string
  type: CourseType
  periods: number
  companion?: string
}

const theoryWithPractice = (code: string, name: string): CourseSeed[] => [
  { code, name, type: CourseType.THEORY, periods: 45 },
  {
    code: `${code}TH`,
    name: `${name} - Thực hành`,
    type: CourseType.PRACTICE,
    periods: 30,
    companion: code,
  },
]

/** BM2; a course with both parts is two courses (ADR-0002). CE119 is a standalone practice course. */
const COURSES: CourseSeed[] = [
  { code: 'MA003', name: 'Đại số tuyến tính', type: CourseType.THEORY, periods: 45 },
  { code: 'MA006', name: 'Giải tích', type: CourseType.THEORY, periods: 60 },
  { code: 'ENG01', name: 'Anh văn 1', type: CourseType.THEORY, periods: 60 },
  { code: 'SS003', name: 'Tư tưởng Hồ Chí Minh', type: CourseType.THEORY, periods: 30 },
  { code: 'CS106', name: 'Trí tuệ nhân tạo', type: CourseType.THEORY, periods: 45 },
  { code: 'SE121', name: 'Đồ án 1', type: CourseType.THEORY, periods: 30 },
  {
    code: 'CE119',
    name: 'Thực hành Kiến trúc máy tính',
    type: CourseType.PRACTICE,
    periods: 30,
  },
  // Retired code kept for old transcripts; equivalent to SE104 (KQ-04).
  {
    code: 'SE004',
    name: 'Nhập môn công nghệ phần mềm (mã cũ)',
    type: CourseType.THEORY,
    periods: 45,
  },
  ...theoryWithPractice('IT001', 'Nhập môn lập trình'),
  ...theoryWithPractice('IT002', 'Lập trình hướng đối tượng'),
  ...theoryWithPractice('IT003', 'Cấu trúc dữ liệu và giải thuật'),
  ...theoryWithPractice('IT004', 'Cơ sở dữ liệu'),
  ...theoryWithPractice('IT005', 'Nhập môn mạng máy tính'),
  ...theoryWithPractice('IT007', 'Hệ điều hành'),
  ...theoryWithPractice('SE104', 'Nhập môn công nghệ phần mềm'),
  ...theoryWithPractice('SE100', 'Phương pháp phát triển phần mềm hướng đối tượng'),
  ...theoryWithPractice('SE113', 'Kiểm chứng phần mềm'),
]

const EQUIVALENCES = [{ name: 'Nhập môn công nghệ phần mềm', courses: ['SE104', 'SE004'] }]

const { REQUIRED_PASS, REQUIRED_ATTEMPT } = PrerequisiteType
const PREREQUISITES: [course: string, prerequisite: string, type: PrerequisiteType][] = [
  ['SE100', 'SE104', REQUIRED_PASS],
  ['SE113', 'SE104', REQUIRED_ATTEMPT],
]

export type CourseInfo = {
  id: number
  code: string
  type: CourseType
  credits: number
  companion?: string
}

export type Catalog = {
  systems: Map<string, number>
  cohorts: Map<string, { id: number; admissionYear: number }>
  priorityGroups: Map<string, { id: number; discountRate: number; priority: number }>
  courses: Map<string, CourseInfo>
  courseById: Map<number, CourseInfo>
  prerequisites: Map<string, { prerequisite: string; type: PrerequisiteType }[]>
}

export async function seedCatalog(db: Db): Promise<Catalog> {
  const systems = new Map<string, number>()
  for (const [code, name] of TRAINING_SYSTEMS) {
    const created = await db.trainingSystem.create({ data: { code, name } })
    systems.set(code, created.id)
  }

  const cohorts = new Map<string, { id: number; admissionYear: number }>()
  for (const [code, admissionYear] of COHORTS) {
    const created = await db.cohort.create({ data: { code, admissionYear } })
    cohorts.set(code, { id: created.id, admissionYear })
  }

  for (const code of ROOM_CODES) await db.room.create({ data: { code } })

  const priorityGroups = new Map<string, { id: number; discountRate: number; priority: number }>()
  for (const group of PRIORITY_GROUPS) {
    const created = await db.priorityGroup.create({ data: group })
    priorityGroups.set(group.code, created)
  }

  const equivalenceOf = new Map<string, number>()
  for (const equivalence of EQUIVALENCES) {
    const created = await db.courseEquivalence.create({ data: { name: equivalence.name } })
    for (const code of equivalence.courses) equivalenceOf.set(code, created.id)
  }

  const courses = new Map<string, CourseInfo>()
  // Theory courses come first in COURSES, so every companion already exists when its practice course is created.
  for (const course of COURSES) {
    const credits = course.periods / (course.type === CourseType.THEORY ? 15 : 30)
    const companion = course.companion ? courses.get(course.companion) : undefined
    if (course.companion && !companion)
      throw new Error(`Seed course ${course.code}: companion ${course.companion} missing`)
    const created = await db.course.create({
      data: {
        code: course.code,
        name: course.name,
        type: course.type,
        totalPeriods: course.periods,
        credits,
        companionTheoryCourseId: companion?.id ?? null,
        equivalenceId: equivalenceOf.get(course.code) ?? null,
      },
    })
    courses.set(course.code, {
      id: created.id,
      code: course.code,
      type: course.type,
      credits,
      companion: course.companion,
    })
  }

  const prerequisites = new Map<string, { prerequisite: string; type: PrerequisiteType }[]>()
  await db.prerequisite.createMany({
    data: PREREQUISITES.map(([course, prerequisite, type]) => {
      prerequisites.set(course, [...(prerequisites.get(course) ?? []), { prerequisite, type }])
      const target = courses.get(course)
      const source = courses.get(prerequisite)
      if (!target || !source)
        throw new Error(`Seed prerequisite ${course} <- ${prerequisite}: course missing`)
      return { courseId: target.id, prerequisiteCourseId: source.id, type }
    }),
  })

  const courseById = new Map([...courses.values()].map((c) => [c.id, c]))
  return {
    systems,
    cohorts,
    priorityGroups,
    courses,
    courseById,
    prerequisites,
  }
}
