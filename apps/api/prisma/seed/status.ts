import { StudentStatus } from '../../src/generated/prisma/enums'
import type { Catalog } from './catalog'
import { addDays, type Db, must } from './lib'
import type { People } from './people'
import { DEMO } from './scenarios'
import { OPEN_TERM, type TermInfo } from './terms'

/**
 * HS-06: every status comes from an academic-office decision. Each student is admitted ACTIVE in the first
 * term of their cohort; the withdrawn and on-leave demo accounts get one more decision each.
 */
export async function seedStatuses(
  db: Db,
  catalog: Catalog,
  people: People,
  terms: Map<string, TermInfo>,
  now: Date,
) {
  const decidedById = people.staff.academicOffice

  await db.studentStatusDecision.createMany({
    data: people.students.map((s) => {
      const firstTerm = must(terms, `${must(catalog.cohorts, s.cohort).admissionYear}1`)
      return {
        studentId: s.id,
        status: StudentStatus.ACTIVE,
        effectiveTermId: firstTerm.id,
        reason: 'Trúng tuyển, nhập học',
        decidedById,
        createdAt: addDays(firstTerm.registrationStartAt, -14),
      }
    }),
  })

  const byCode = new Map(people.students.map((s) => [s.code, s]))
  const withdrawnFrom = must(terms, '20252')
  await db.studentStatusDecision.create({
    data: {
      studentId: must(byCode, DEMO.withdrawn).id,
      status: StudentStatus.WITHDRAWN,
      effectiveTermId: withdrawnFrom.id,
      reason: 'Thôi học theo nguyện vọng cá nhân',
      decidedById,
      createdAt: addDays(withdrawnFrom.registrationStartAt, -10),
    },
  })

  await db.leaveDecision.create({
    data: {
      studentId: must(byCode, DEMO.onLeave).id,
      termId: must(terms, OPEN_TERM).id,
      reason: 'Bảo lưu một học kỳ vì lý do sức khoẻ',
      decidedById,
      createdAt: addDays(now, -5),
    },
  })
}
