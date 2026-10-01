import { CourseType, KnowledgeBlockType, PrerequisiteType } from '../../src/generated/prisma/enums'
import { type Db, must } from './lib'

// Pre-2025 administrative units: the assignment's QĐ1 models hometowns as district + province.
const PROVINCES: {
  code: string
  name: string
  districts: [code: string, name: string, isRemote: boolean][]
}[] = [
  {
    code: 'HCM',
    name: 'Thành phố Hồ Chí Minh',
    districts: [
      ['HCM.Q1', 'Quận 1', false],
      ['HCM.TD', 'Thành phố Thủ Đức', false],
      ['HCM.BC', 'Huyện Bình Chánh', false],
      ['HCM.CG', 'Huyện Cần Giờ', false],
    ],
  },
  {
    code: 'DNA',
    name: 'Đồng Nai',
    districts: [
      ['DNA.BH', 'Thành phố Biên Hòa', false],
      ['DNA.LT', 'Huyện Long Thành', false],
      ['DNA.TP', 'Huyện Tân Phú', false],
    ],
  },
  {
    code: 'LDG',
    name: 'Lâm Đồng',
    districts: [
      ['LDG.DL', 'Thành phố Đà Lạt', false],
      ['LDG.BL', 'Thành phố Bảo Lộc', false],
      ['LDG.DR', 'Huyện Đam Rông', true],
    ],
  },
  {
    code: 'HGG',
    name: 'Hà Giang',
    districts: [
      ['HGG.HG', 'Thành phố Hà Giang', false],
      ['HGG.DV', 'Huyện Đồng Văn', true],
      ['HGG.MV', 'Huyện Mèo Vạc', true],
    ],
  },
  {
    code: 'BDH',
    name: 'Bình Định',
    districts: [
      ['BDH.QN', 'Thành phố Quy Nhơn', false],
      ['BDH.AL', 'Huyện An Lão', true],
    ],
  },
  {
    code: 'STG',
    name: 'Sóc Trăng',
    districts: [
      ['STG.ST', 'Thành phố Sóc Trăng', false],
      ['STG.CLD', 'Huyện Cù Lao Dung', true],
    ],
  },
]

const FACULTIES = [
  {
    code: 'CNPM',
    name: 'Khoa Công nghệ Phần mềm',
    majors: [{ code: 'KTPM', name: 'Kỹ thuật Phần mềm' }],
  },
  {
    code: 'KHMT',
    name: 'Khoa Khoa học Máy tính',
    majors: [{ code: 'KHMT', name: 'Khoa học Máy tính' }],
  },
]

/** Cohort code, admission year and base tuition per main term (HP-01). */
export const COHORTS: [code: string, admissionYear: number, baseTuition: bigint][] = [
  ['K17', 2022, 13_500_000n],
  ['K18', 2023, 14_000_000n],
  ['K19', 2024, 15_000_000n],
  ['K20', 2025, 16_500_000n],
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
  faculty?: string
  companion?: string
}

const theoryWithPractice = (code: string, name: string, faculty: string): CourseSeed[] => [
  { code, name, type: CourseType.THEORY, periods: 45, faculty },
  {
    code: `${code}TH`,
    name: `${name} - Thực hành`,
    type: CourseType.PRACTICE,
    periods: 30,
    faculty,
    companion: code,
  },
]

/** DT-01: a course with both parts is two courses; practice codes carry a TH suffix. */
const COURSES: CourseSeed[] = [
  { code: 'MA003', name: 'Đại số tuyến tính', type: CourseType.THEORY, periods: 45 },
  { code: 'MA006', name: 'Giải tích', type: CourseType.THEORY, periods: 60 },
  { code: 'ENG01', name: 'Anh văn 1', type: CourseType.THEORY, periods: 60 },
  { code: 'SS003', name: 'Tư tưởng Hồ Chí Minh', type: CourseType.THEORY, periods: 30 },
  ...theoryWithPractice('IT001', 'Nhập môn lập trình', 'KHMT'),
  ...theoryWithPractice('IT002', 'Lập trình hướng đối tượng', 'CNPM'),
  ...theoryWithPractice('IT003', 'Cấu trúc dữ liệu và giải thuật', 'KHMT'),
  ...theoryWithPractice('IT004', 'Cơ sở dữ liệu', 'KHMT'),
  ...theoryWithPractice('IT005', 'Nhập môn mạng máy tính', 'KHMT'),
  ...theoryWithPractice('IT007', 'Hệ điều hành', 'KHMT'),
  ...theoryWithPractice('SE104', 'Nhập môn công nghệ phần mềm', 'CNPM'),
  ...theoryWithPractice('SE100', 'Phương pháp phát triển phần mềm hướng đối tượng', 'CNPM'),
  ...theoryWithPractice('SE113', 'Kiểm chứng phần mềm', 'CNPM'),
  { code: 'SE121', name: 'Đồ án 1', type: CourseType.PRACTICE, periods: 60, faculty: 'CNPM' },
  {
    code: 'CS106',
    name: 'Trí tuệ nhân tạo',
    type: CourseType.THEORY,
    periods: 45,
    faculty: 'KHMT',
  },
  // Retired code kept for old transcripts; equivalent to SE104.
  {
    code: 'SE004',
    name: 'Nhập môn công nghệ phần mềm (mã cũ)',
    type: CourseType.THEORY,
    periods: 45,
    faculty: 'CNPM',
  },
]

const EQUIVALENCES = [{ name: 'Nhập môn công nghệ phần mềm', courses: ['SE104', 'SE004'] }]

const { REQUIRED_PASS, REQUIRED_ATTEMPT } = PrerequisiteType
const PREREQUISITES: [course: string, prerequisite: string, type: PrerequisiteType][] = [
  ['IT002', 'IT001', REQUIRED_ATTEMPT],
  ['IT003', 'IT001', REQUIRED_PASS],
  ['IT004', 'IT001', REQUIRED_ATTEMPT],
  ['IT007', 'IT003', REQUIRED_ATTEMPT],
  ['SE104', 'IT002', REQUIRED_ATTEMPT],
  ['SE104', 'IT004', REQUIRED_ATTEMPT],
  ['SE100', 'SE104', REQUIRED_PASS],
  ['SE113', 'SE104', REQUIRED_ATTEMPT],
  ['SE121', 'SE104', REQUIRED_PASS],
  ['CS106', 'IT003', REQUIRED_ATTEMPT],
]

type BlockSeed = {
  name: string
  type: KnowledgeBlockType
  minCredits?: number
  courses: [code: string, suggestedTerm: number][]
}

const pair = (code: string, term: number): [string, number][] => [
  [code, term],
  [`${code}TH`, term],
]

const GENERAL_EDUCATION: BlockSeed = {
  name: 'Giáo dục đại cương',
  type: KnowledgeBlockType.REQUIRED,
  courses: [['MA003', 1], ['MA006', 1], ['ENG01', 1], ['SS003', 4], ...pair('IT001', 1)],
}

const FOUNDATION: BlockSeed = {
  name: 'Cơ sở ngành',
  type: KnowledgeBlockType.REQUIRED,
  courses: [
    ...pair('IT002', 2),
    ...pair('IT003', 3),
    ...pair('IT004', 3),
    ...pair('IT005', 4),
    ...pair('IT007', 4),
  ],
}

/** BM3 per major; the same plan is used for every cohort of that major. */
const CURRICULA: Record<string, { minTotalCredits: number; blocks: BlockSeed[] }> = {
  KTPM: {
    minTotalCredits: 125,
    blocks: [
      GENERAL_EDUCATION,
      FOUNDATION,
      {
        name: 'Chuyên ngành bắt buộc',
        type: KnowledgeBlockType.REQUIRED,
        courses: [...pair('SE104', 5), ['SE121', 6]],
      },
      {
        name: 'Chuyên ngành tự chọn',
        type: KnowledgeBlockType.ELECTIVE,
        minCredits: 4,
        courses: [...pair('SE100', 6), ...pair('SE113', 6)],
      },
    ],
  },
  KHMT: {
    minTotalCredits: 126,
    blocks: [
      GENERAL_EDUCATION,
      FOUNDATION,
      { name: 'Chuyên ngành bắt buộc', type: KnowledgeBlockType.REQUIRED, courses: [['CS106', 5]] },
      {
        name: 'Chuyên ngành tự chọn',
        type: KnowledgeBlockType.ELECTIVE,
        minCredits: 4,
        courses: [...pair('SE104', 5), ...pair('SE113', 6)],
      },
    ],
  },
}

const CURRICULUM_COHORTS: Record<string, string[]> = { KTPM: ['K18', 'K19', 'K20'], KHMT: ['K19'] }

export type CourseInfo = {
  id: number
  code: string
  type: CourseType
  credits: number
  companion?: string
}

export type Catalog = {
  districts: { id: number; code: string; isRemote: boolean }[]
  faculties: Map<string, number>
  majors: Map<string, number>
  cohorts: Map<string, { id: number; admissionYear: number; baseTuition: bigint }>
  priorityGroups: Map<string, { id: number; discountRate: number; priority: number }>
  courses: Map<string, CourseInfo>
  courseById: Map<number, CourseInfo>
  prerequisites: Map<string, { prerequisite: string; type: PrerequisiteType }[]>
  /** Course codes in the curriculum of `${major}:${cohort}`. */
  curriculumCourses: Map<string, Set<string>>
}

export async function seedCatalog(db: Db): Promise<Catalog> {
  const districts: Catalog['districts'] = []
  for (const province of PROVINCES) {
    const created = await db.province.create({
      data: {
        code: province.code,
        name: province.name,
        districts: {
          create: province.districts.map(([code, name, isRemote]) => ({ code, name, isRemote })),
        },
      },
      include: { districts: true },
    })
    districts.push(...created.districts)
  }

  const faculties = new Map<string, number>()
  const majors = new Map<string, number>()
  for (const faculty of FACULTIES) {
    const created = await db.faculty.create({
      data: { code: faculty.code, name: faculty.name, majors: { create: faculty.majors } },
      include: { majors: true },
    })
    faculties.set(created.code, created.id)
    for (const major of created.majors) majors.set(major.code, major.id)
  }

  const cohorts: Catalog['cohorts'] = new Map()
  for (const [code, admissionYear, baseTuition] of COHORTS) {
    // Credit rates use the column defaults: 27.000đ theory, 37.000đ practice (QĐ5).
    const cohort = await db.cohort.create({
      data: { code, admissionYear, feeSchedule: { create: { baseTuition } } },
    })
    cohorts.set(code, { id: cohort.id, admissionYear, baseTuition })
  }

  const priorityGroups: Catalog['priorityGroups'] = new Map()
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
    const created = await db.course.create({
      data: {
        code: course.code,
        name: course.name,
        type: course.type,
        totalPeriods: course.periods,
        credits,
        facultyId: course.faculty ? must(faculties, course.faculty) : null,
        companionTheoryCourseId: course.companion ? must(courses, course.companion).id : null,
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

  const prerequisites: Catalog['prerequisites'] = new Map()
  await db.prerequisite.createMany({
    data: PREREQUISITES.map(([course, prerequisite, type]) => {
      prerequisites.set(course, [...(prerequisites.get(course) ?? []), { prerequisite, type }])
      return {
        courseId: must(courses, course).id,
        prerequisiteCourseId: must(courses, prerequisite).id,
        type,
      }
    }),
  })

  const curriculumCourses = new Map<string, Set<string>>()
  for (const [major, plan] of Object.entries(CURRICULA)) {
    for (const cohortCode of CURRICULUM_COHORTS[major] ?? []) {
      await db.curriculum.create({
        data: {
          majorId: must(majors, major),
          cohortId: must(cohorts, cohortCode).id,
          minTotalCredits: plan.minTotalCredits,
          knowledgeBlocks: {
            create: plan.blocks.map((block, sortOrder) => ({
              name: block.name,
              type: block.type,
              minCredits: block.minCredits ?? null,
              sortOrder,
              courses: {
                create: block.courses.map(([code, suggestedTerm]) => ({
                  courseId: must(courses, code).id,
                  suggestedTerm,
                })),
              },
            })),
          },
        },
      })
      curriculumCourses.set(
        `${major}:${cohortCode}`,
        new Set(plan.blocks.flatMap((b) => b.courses.map(([code]) => code))),
      )
    }
  }

  const courseById = new Map([...courses.values()].map((c) => [c.id, c]))
  return {
    districts,
    faculties,
    majors,
    cohorts,
    priorityGroups,
    courses,
    courseById,
    prerequisites,
    curriculumCourses,
  }
}
