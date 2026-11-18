import { Role } from '../../src/generated/prisma/enums'
import type { Catalog } from './catalog'
import { addDays, type Db, must } from './lib'
import { DEMO, DEMO_NOW, DEV_PASSWORD } from './scenarios'

const LECTURERS: [code: string, name: string][] = [
  ['GV001', 'Nguyễn Văn Phúc'],
  ['GV002', 'Trần Thị Thanh Hà'],
  ['GV003', 'Lê Minh Khoa'],
  ['GV004', 'Phạm Ngọc Diệp'],
  ['GV005', 'Huỳnh Quốc Bảo'],
  ['GV006', 'Võ Thị Kim Ngân'],
]

type StudentSeed = {
  code: string
  name: string
  cohort: string
  system: string
  groups?: string[]
  email?: string
  mustChangePassword?: boolean
}

/** A.7 student table + three fillers so SE104.P23, CS106.P21 and the K20 CLC warning have a subject. */
const STUDENTS: StudentSeed[] = [
  {
    code: DEMO.student,
    name: 'Nguyễn Minh An',
    cohort: 'K19',
    system: 'CQUI',
    email: '24520001@gm.uit.edu.vn',
  },
  {
    code: DEMO.discount80,
    name: 'Trần Thị Mai',
    cohort: 'K19',
    system: 'CQUI',
    groups: ['LIET_SI'],
  },
  { code: DEMO.pendingPrerequisite, name: 'Lê Quốc Khoa', cohort: 'K19', system: 'CQUI' },
  {
    code: DEMO.twoGroups,
    name: 'Hoàng Thị Nhi',
    cohort: 'K19',
    system: 'CQUI',
    groups: ['HO_NGHEO', 'DTTS_VUNG_SAU'],
  },
  { code: DEMO.overpaid, name: 'Phạm Đức Long', cohort: 'K19', system: 'CQUI' },
  { code: DEMO.fullClass, name: 'Trần Văn Hùng', cohort: 'K19', system: 'CQUI' },
  { code: DEMO.retakeReregistered, name: 'Võ Gia Huy', cohort: 'K19', system: 'CQUI' },
  { code: DEMO.summerRetake, name: 'Trịnh Bảo Ngọc', cohort: 'K19', system: 'CQUI' },
  { code: DEMO.overdue, name: 'Đặng Thanh Trang', cohort: 'K19', system: 'CQUI' },
  { code: DEMO.recalculated, name: 'Đinh Hoàng Phúc', cohort: 'K19', system: 'CLC' },
  { code: DEMO.clcStudent, name: 'Phan Minh Triết', cohort: 'K19', system: 'CLC' },
  { code: DEMO.improvement, name: 'Bùi Ngọc Linh', cohort: 'K18', system: 'CQUI' },
  { code: DEMO.missingFeeSchedule, name: 'Ngô Đức Mạnh', cohort: 'K20', system: 'CLC' },
  {
    code: DEMO.newProfile,
    name: 'Mai Anh Tuấn',
    cohort: 'K20',
    system: 'CQUI',
    mustChangePassword: true,
  },
]

export type StudentInfo = {
  id: number
  code: string
  userId: number
  cohort: string
  system: string
  /** HS-02: rate of the highest-priority group, 0 when none. */
  discountRate: number
  groups: string[]
}

export type People = {
  /** pdt.hang — Phòng Đào tạo. */
  academic: number
  /** tv.lan — Phòng Tài vụ, thu ngân. */
  cashier: number
  /** tv.viet — both Phòng Tài vụ and Phòng Đào tạo. */
  finance: number
  lecturers: Map<string, number>
  students: Map<string, StudentInfo>
}

export async function seedPeople(db: Db, catalog: Catalog): Promise<People> {
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

  const [pdtHang, tvLan, tvViet] = await db.user.createManyAndReturn({
    data: [
      account('pdt.hang', 'Đỗ Thu Hằng', [Role.ACADEMIC_OFFICE], 'pdt.hang@uit.edu.vn'),
      account('tv.lan', 'Ngô Thị Lan', [Role.FINANCE_OFFICE], 'tv.lan@uit.edu.vn'),
      account(
        'tv.viet',
        'Trịnh Quốc Việt',
        [Role.FINANCE_OFFICE, Role.ACADEMIC_OFFICE],
        'tv.viet@uit.edu.vn',
      ),
    ],
  })
  if (!pdtHang || !tvLan || !tvViet) throw new Error('staff accounts were not created')

  const lecturers = new Map<string, number>()
  for (const [code, name] of LECTURERS) {
    const created = await db.lecturer.create({ data: { lecturerCode: code, fullName: name } })
    lecturers.set(code, created.id)
  }

  const students = new Map<string, StudentInfo>()
  for (const seed of STUDENTS) {
    const email = seed.email ?? `${seed.code}@gm.uit.edu.vn`
    const user = await db.user.create({
      data: {
        ...account(seed.code, seed.name, [Role.STUDENT], email),
        mustChangePassword: seed.mustChangePassword ?? false,
        lastLoginAt: seed.mustChangePassword ? null : addDays(DEMO_NOW, -3),
      },
    })
    const groups = seed.groups ?? []
    const applied = groups.map((code) => must(catalog.priorityGroups, code))
    const best = applied.reduce<(typeof applied)[number] | undefined>(
      (top, group) => (!top || group.priority > top.priority ? group : top),
      undefined,
    )
    const student = await db.student.create({
      data: {
        studentCode: seed.code,
        userId: user.id,
        fullName: seed.name,
        email,
        cohortId: must(catalog.cohorts, seed.cohort).id,
        trainingSystemId: must(catalog.systems, seed.system),
        priorityGroups: {
          create: applied.map((group) => ({ priorityGroupId: group.id })),
        },
      },
    })
    students.set(seed.code, {
      id: student.id,
      code: seed.code,
      userId: user.id,
      cohort: seed.cohort,
      system: seed.system,
      discountRate: best?.discountRate ?? 0,
      groups,
    })
  }

  return {
    academic: pdtHang.id,
    cashier: tvLan.id,
    finance: tvViet.id,
    lecturers,
    students,
  }
}
