import type { Course, Prisma } from '../generated/prisma/client'
import {
  checkPrerequisites,
  type AttemptLike,
  type PrerequisiteCheck,
  type PrerequisiteCondition,
} from './policy'

type Db = Prisma.TransactionClient

const scoreOf = (score: unknown): number | null => (score === null ? null : Number(score))

/** KQ-01/KQ-04: past attempts and finalized lines are the only source of results. */
export async function studentAttempts(db: Db, studentId: number): Promise<AttemptLike[]> {
  const [taken, finalized] = await Promise.all([
    db.takenCourse.findMany({
      where: { studentId },
      select: {
        courseId: true,
        courseScore: true,
        term: { select: { startDate: true } },
      },
    }),
    db.enrollment.findMany({
      where: { status: 'FINALIZED', form: { studentId } },
      select: {
        courseId: true,
        courseScore: true,
        form: { select: { term: { select: { startDate: true } } } },
      },
    }),
  ])
  return [
    ...taken.map((row): AttemptLike => ({
      courseId: row.courseId,
      equivalenceId: row.courseId,
      score: scoreOf(row.courseScore),
      order: row.term.startDate.getTime(),
    })),
    ...finalized.map((row): AttemptLike => ({
      courseId: row.courseId,
      equivalenceId: row.courseId,
      score: scoreOf(row.courseScore),
      order: row.form.term.startDate.getTime(),
    })),
  ]
}

/** DK-05: prerequisites of a course include those of every equivalent course. */
export async function prerequisiteConditions(
  db: Db,
  course: Pick<Course, 'id' | 'equivalenceId'>,
): Promise<PrerequisiteCondition[]> {
  const [courses, prerequisites] = await Promise.all([
    db.course.findMany({ select: { id: true, equivalenceId: true, code: true } }),
    db.prerequisite.findMany({
      include: { prerequisiteCourse: { select: { id: true, code: true, equivalenceId: true } } },
    }),
  ])
  const groupOf = (item: Pick<Course, 'id' | 'equivalenceId'>) =>
    item.equivalenceId === null
      ? [item.id]
      : courses.filter((row) => row.equivalenceId === item.equivalenceId).map((row) => row.id)
  const group = groupOf(course)
  return prerequisites
    .filter((row) => group.includes(row.courseId))
    .map((row) => ({
      code: row.prerequisiteCourse.code,
      type: row.type,
      equivalenceIds: groupOf(row.prerequisiteCourse),
    }))
}

/** Single entry point for both the registration transaction and the daily review job. */
export async function prerequisiteCheck(
  db: Db,
  studentId: number,
  course: Pick<Course, 'id' | 'equivalenceId'>,
): Promise<PrerequisiteCheck> {
  const [conditions, attempts] = await Promise.all([
    prerequisiteConditions(db, course),
    studentAttempts(db, studentId),
  ])
  return checkPrerequisites(conditions, attempts)
}
