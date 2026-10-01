import { Gender, Role } from '../../src/generated/prisma/enums'
import type { Catalog } from './catalog'
import { createRng, type Db, must, pick, randInt } from './lib'
import { DEMO, DEV_PASSWORD } from './scenarios'

const FAMILY_NAMES = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
]
const MIDDLE_NAMES = {
  MALE: ['Văn', 'Minh', 'Quốc', 'Đức', 'Gia', 'Hoàng'],
  FEMALE: ['Thị', 'Ngọc', 'Thanh', 'Khánh', 'Hoài', 'Mai'],
}
const GIVEN_NAMES = {
  MALE: [
    'An',
    'Bình',
    'Dũng',
    'Hải',
    'Hiếu',
    'Hùng',
    'Khoa',
    'Long',
    'Nam',
    'Phúc',
    'Quân',
    'Tuấn',
  ],
  FEMALE: [
    'Châu',
    'Giang',
    'Hà',
    'Linh',
    'Mai',
    'Ngân',
    'Nhi',
    'Thảo',
    'Trang',
    'Uyên',
    'Vy',
    'Yến',
  ],
}

const LECTURERS: [code: string, name: string, faculty: string][] = [
  ['GV001', 'Nguyễn Văn Phúc', 'CNPM'],
  ['GV002', 'Trần Thị Thanh Hà', 'CNPM'],
  ['GV003', 'Lê Minh Khoa', 'CNPM'],
  ['GV004', 'Phạm Ngọc Diệp', 'CNPM'],
  ['GV005', 'Huỳnh Quốc Bảo', 'KHMT'],
  ['GV006', 'Võ Thị Kim Ngân', 'KHMT'],
  ['GV007', 'Đặng Hoàng Long', 'KHMT'],
  ['GV008', 'Bùi Gia Huy', 'KHMT'],
]

/** Student codes: 2-digit admission year + "52" + 4-digit number, e.g. 24520001. */
const STUDENT_GROUPS = [
  { cohort: 'K18', major: 'KTPM', first: 1, count: 8 },
  { cohort: 'K19', major: 'KTPM', first: 1, count: 12 },
  { cohort: 'K19', major: 'KHMT', first: 1001, count: 6 },
  { cohort: 'K20', major: 'KTPM', first: 1, count: 10 },
]

const PRIORITY_MEMBERSHIPS: Record<string, string[]> = {
  [DEMO.priorityLietSi]: ['LIET_SI'],
  [DEMO.twoPriorityGroups]: ['HO_NGHEO', 'DTTS_VUNG_SAU'],
  '23520005': ['THUONG_BINH'],
  '25520003': ['HO_NGHEO'],
}

/** Students in a remote-area priority group get a remote hometown so the profile is consistent. */
const REMOTE_HOMETOWNS: Record<string, string> = { [DEMO.twoPriorityGroups]: 'HGG.MV' }

export type StaffUsers = { admin: number; academicOffice: number; financeOffice: number }

export type StudentInfo = {
  id: number
  code: string
  userId: number
  cohort: string
  major: string
  /** Position within its STUDENT_GROUPS entry; drives the regular (non-demo) variations. */
  index: number
  /** HS-02: rate of the highest-priority group, 0 when none. */
  discountRate: number
}

export type LecturerInfo = { id: number; userId: number }

export type People = { staff: StaffUsers; lecturers: LecturerInfo[]; students: StudentInfo[] }

export async function seedPeople(db: Db, catalog: Catalog): Promise<People> {
  const rng = createRng(104)
  // Every account shares one password, so hash once: argon2id is deliberately slow (NFR-08).
  const passwordHash = await Bun.password.hash(DEV_PASSWORD, { algorithm: 'argon2id' })
  const account = (username: string, fullName: string, roles: Role[], email: string) => ({
    username,
    fullName,
    roles,
    email,
    passwordHash,
    mustChangePassword: false,
  })

  const [admin, academicOffice, financeOffice] = await db.user.createManyAndReturn({
    data: [
      account('admin', 'Quản trị hệ thống', [Role.ADMIN], 'admin@dkhp.test'),
      account('daotao', 'Phòng Đào tạo', [Role.ACADEMIC_OFFICE], 'daotao@dkhp.test'),
      account('taivu', 'Phòng Tài vụ', [Role.FINANCE_OFFICE], 'taivu@dkhp.test'),
    ],
  })
  if (!admin || !academicOffice || !financeOffice)
    throw new Error('staff accounts were not created')

  const lecturers: LecturerInfo[] = []
  for (const [code, fullName, faculty] of LECTURERS) {
    // GV001 also works in the academic office, to exercise multi-role accounts.
    const roles = code === 'GV001' ? [Role.LECTURER, Role.ACADEMIC_OFFICE] : [Role.LECTURER]
    const user = await db.user.create({
      data: account(code.toLowerCase(), fullName, roles, `${code.toLowerCase()}@dkhp.test`),
    })
    const lecturer = await db.lecturer.create({
      data: {
        lecturerCode: code,
        userId: user.id,
        fullName,
        facultyId: must(catalog.faculties, faculty),
      },
    })
    lecturers.push({ id: lecturer.id, userId: user.id })
  }

  const ordinaryDistricts = catalog.districts.filter((d) => !d.isRemote)
  const districtByCode = new Map(catalog.districts.map((d) => [d.code, d]))
  const students: StudentInfo[] = []

  for (const group of STUDENT_GROUPS) {
    const cohort = must(catalog.cohorts, group.cohort)
    for (let index = 0; index < group.count; index++) {
      const code = `${cohort.admissionYear % 100}52${String(group.first + index).padStart(4, '0')}`
      const gender = rng() < 0.5 ? Gender.MALE : Gender.FEMALE
      const fullName = `${pick(rng, FAMILY_NAMES)} ${pick(rng, MIDDLE_NAMES[gender])} ${pick(rng, GIVEN_NAMES[gender])}`
      const birthYear = cohort.admissionYear - 18
      const dateOfBirth = new Date(Date.UTC(birthYear, randInt(rng, 0, 11), randInt(rng, 1, 28)))
      const remote = REMOTE_HOMETOWNS[code]
      const district = remote ? must(districtByCode, remote) : pick(rng, ordinaryDistricts)
      const groups = (PRIORITY_MEMBERSHIPS[code] ?? []).map((g) => must(catalog.priorityGroups, g))

      const user = await db.user.create({
        data: {
          ...account(code, fullName, [Role.STUDENT], `${code}@student.dkhp.test`),
          mustChangePassword: code === DEMO.mustChangePassword,
        },
      })
      const student = await db.student.create({
        data: {
          studentCode: code,
          userId: user.id,
          fullName,
          dateOfBirth,
          gender,
          hometownDistrictId: district.id,
          majorId: must(catalog.majors, group.major),
          cohortId: cohort.id,
          priorityGroups: { create: groups.map((g) => ({ priorityGroupId: g.id })) },
        },
      })

      const applicable = groups.reduce<(typeof groups)[number] | undefined>(
        (best, g) => (!best || g.priority > best.priority ? g : best),
        undefined,
      )
      students.push({
        id: student.id,
        code,
        userId: user.id,
        cohort: group.cohort,
        major: group.major,
        index,
        discountRate: applicable?.discountRate ?? 0,
      })
    }
  }

  return {
    staff: { admin: admin.id, academicOffice: academicOffice.id, financeOffice: financeOffice.id },
    lecturers,
    students,
  }
}
