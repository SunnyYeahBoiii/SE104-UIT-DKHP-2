import { HttpException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

import { PasswordHasher } from '../auth/password.hasher'
import { SessionStore } from '../auth/session.store'
import { Role } from '../generated/prisma/enums'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type StudentInput = {
  studentCode: string
  fullName: string
  email: string | null
  cohortId: number
  trainingSystemId: number
  priorityGroupIds: number[]
}

export type AuditContext = {
  actorId?: number
  requestId?: string
  ip?: string
}

export type StudentQuery = {
  q?: string
  cohortId?: number
  trainingSystemId?: number
  priorityGroupId?: number
}

const PASSWORD_GROUPS = [
  'abcdefghjkmnpqrstuvwxyz',
  'ABCDEFGHJKMNPQRSTUVWXYZ',
  '23456789',
  '!@#$%^&*',
]

/** Meets the password checklist in password.hasher.ts; never stored in plaintext (HS-13). */
function temporaryPassword(): string {
  const bytes = randomBytes(24)
  const alphabet = PASSWORD_GROUPS.join('')
  const chars = PASSWORD_GROUPS.map((group, index) => group[bytes[index]! % group.length]!)
  for (let index = chars.length; index < 18; index++) {
    chars.push(alphabet[bytes[index]! % alphabet.length]!)
  }
  for (let index = chars.length - 1; index > 0; index--) {
    const swap = bytes[index]! % (index + 1)
    ;[chars[index], chars[swap]] = [chars[swap]!, chars[index]!]
  }
  return chars.join('')
}

function termLabel(term: {
  type: string
  termCode: string
  academicYear: { startYear: number }
}): string {
  const label =
    term.type === 'SUMMER'
      ? `HK hè ${term.academicYear.startYear}–${term.academicYear.startYear + 1}`
      : `HK${term.type === 'FIRST' ? 1 : 2} ${term.academicYear.startYear}–${term.academicYear.startYear + 1}`
  return `${label} · ${term.termCode}`
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionStore,
  ) {}

  async list(query: StudentQuery) {
    const [students, cohorts, trainingSystems, priorityGroups] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          ...(query.q
            ? {
                OR: [
                  { studentCode: { contains: query.q, mode: 'insensitive' } },
                  { fullName: { contains: query.q, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(query.cohortId ? { cohortId: query.cohortId } : {}),
          ...(query.trainingSystemId ? { trainingSystemId: query.trainingSystemId } : {}),
          ...(query.priorityGroupId
            ? { priorityGroups: { some: { priorityGroupId: query.priorityGroupId } } }
            : {}),
        },
        include: {
          cohort: true,
          trainingSystem: true,
          priorityGroups: { include: { priorityGroup: true } },
        },
        orderBy: { studentCode: 'asc' },
      }),
      this.prisma.cohort.findMany({ orderBy: { admissionYear: 'desc' } }),
      this.prisma.trainingSystem.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.priorityGroup.findMany({ orderBy: [{ priority: 'desc' }, { code: 'asc' }] }),
    ])
    return {
      items: students.map((student) => this.toItem(student)),
      cohorts: cohorts.map(({ id, code, admissionYear }) => ({ id, code, admissionYear })),
      trainingSystems: trainingSystems.map(({ id, code, name }) => ({ id, code, name })),
      priorityGroups: priorityGroups.map((group) => this.toGroup(group)),
    }
  }

  async exists(studentCode: string) {
    const [student, user] = await Promise.all([
      this.prisma.student.findUnique({ where: { studentCode } }),
      this.prisma.user.findUnique({ where: { username: studentCode } }),
    ])
    return { exists: Boolean(student || user) }
  }

  async detail(studentCode: string) {
    const student = await this.prisma.student.findUnique({
      where: { studentCode },
      include: {
        cohort: true,
        trainingSystem: true,
        priorityGroups: { include: { priorityGroup: true } },
        registrationForms: {
          include: {
            term: {
              include: { academicYear: true },
            },
            enrollments: {
              include: { course: true },
              orderBy: { id: 'asc' },
            },
          },
          orderBy: { id: 'desc' },
        },
      },
    })
    if (!student)
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' })

    const [formCount, ledgerCount, auditLogs, cohorts, trainingSystems, priorityGroups] =
      await Promise.all([
        this.prisma.registrationForm.count({ where: { studentId: student.id } }),
        this.prisma.ledgerEntry.count({ where: { studentId: student.id } }),
        this.prisma.auditLog.findMany({
          where: { entityType: 'Student', entityId: studentCode },
          include: { actor: { select: { fullName: true } } },
          orderBy: { id: 'desc' },
          take: 50,
        }),
        this.prisma.cohort.findMany({ orderBy: { admissionYear: 'desc' } }),
        this.prisma.trainingSystem.findMany({ orderBy: { code: 'asc' } }),
        this.prisma.priorityGroup.findMany({ orderBy: [{ priority: 'desc' }, { code: 'asc' }] }),
      ])

    const firstForm = student.registrationForms[0]
    const reason =
      formCount > 0 && firstForm
        ? `Đã có phiếu đăng ký ${termLabel(firstForm.term)}.`
        : ledgerCount > 0
          ? `Đã có ${ledgerCount} dòng sổ cái.`
          : null

    return {
      item: this.toItem(student),
      cohorts: cohorts.map(({ id, code, admissionYear }) => ({ id, code, admissionYear })),
      trainingSystems: trainingSystems.map(({ id, code, name }) => ({ id, code, name })),
      priorityGroups: priorityGroups.map((group) => this.toGroup(group)),
      registrationForms: student.registrationForms.map((form) => ({
        id: form.id,
        term: termLabel(form.term),
        finalizedAt: form.finalizedAt?.toISOString() ?? null,
        enrollments: form.enrollments.map((enrollment) => ({
          id: enrollment.id,
          code: enrollment.course.code,
          name: enrollment.course.name,
          status: enrollment.status,
          attemptType: enrollment.attemptType,
          credits: enrollment.credits,
          creditRate: Number(enrollment.creditRate),
          surcharge: Number(enrollment.surcharge),
          cancelledAt: enrollment.cancelledAt?.toISOString() ?? null,
        })),
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.actor?.fullName ?? 'Hệ thống',
        createdAt: log.createdAt.toISOString(),
        payload: log.payload,
      })),
      deleteBlocked: { reason, registrationForms: formCount, ledgerEntries: ledgerCount },
    }
  }

  async create(input: StudentInput, audit: AuditContext) {
    const temporary = temporaryPassword()
    const passwordHash = await this.hasher.hash(temporary)
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertCodeFree(tx, input.studentCode)
      await this.assertReferences(tx, input)
      const user = await tx.user.create({
        data: {
          username: input.studentCode,
          passwordHash,
          fullName: input.fullName,
          email: input.email,
          roles: [Role.STUDENT],
          mustChangePassword: true,
        },
      })
      const student = await tx.student.create({
        data: {
          studentCode: input.studentCode,
          userId: user.id,
          fullName: input.fullName,
          email: input.email,
          cohortId: input.cohortId,
          trainingSystemId: input.trainingSystemId,
          priorityGroups: {
            create: input.priorityGroupIds.map((priorityGroupId) => ({ priorityGroupId })),
          },
        },
        include: {
          cohort: true,
          trainingSystem: true,
          priorityGroups: { include: { priorityGroup: true } },
        },
      })
      await this.writeAudit(tx, 'STUDENT_CREATED', input.studentCode, input, audit)
      return student
    })
    return { item: this.toItem(created), temporaryPassword: temporary }
  }

  async update(code: string, input: StudentInput, audit: AuditContext) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { studentCode: code } })
      if (!student)
        throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' })
      await this.assertReferences(tx, input)
      await tx.student.update({
        where: { id: student.id },
        data: {
          fullName: input.fullName,
          email: input.email,
          cohortId: input.cohortId,
          trainingSystemId: input.trainingSystemId,
        },
      })
      await tx.studentPriorityGroup.deleteMany({ where: { studentId: student.id } })
      if (input.priorityGroupIds.length > 0) {
        await tx.studentPriorityGroup.createMany({
          data: input.priorityGroupIds.map((priorityGroupId) => ({
            studentId: student.id,
            priorityGroupId,
          })),
        })
      }
      const result = await tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: {
          cohort: true,
          trainingSystem: true,
          priorityGroups: { include: { priorityGroup: true } },
        },
      })
      await this.writeAudit(tx, 'STUDENT_UPDATED', code, input, audit)
      return result
    })
    return { item: this.toItem(updated) }
  }

  async resetPassword(code: string, audit: AuditContext) {
    const temporary = temporaryPassword()
    const passwordHash = await this.hasher.hash(temporary)
    const student = await this.prisma.$transaction(async (tx) => {
      const found = await tx.student.findUnique({ where: { studentCode: code } })
      if (!found)
        throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' })
      await tx.user.update({
        where: { id: found.userId },
        data: { passwordHash, mustChangePassword: true },
      })
      await this.writeAudit(tx, 'STUDENT_PASSWORD_RESET', code, { studentCode: code }, audit)
      return found
    })
    await this.sessions.deleteAll(student.userId)
    return { temporaryPassword: temporary }
  }

  async remove(code: string, confirmation: string, audit: AuditContext) {
    if (confirmation !== code) {
      throw new HttpException(
        { code: 'CONFIRM_MISMATCH', message: `Gõ lại đúng MSSV ${code} để xác nhận.` },
        400,
      )
    }
    const student = await this.prisma.$transaction(async (tx) => {
      const found = await tx.student.findUnique({ where: { studentCode: code } })
      if (!found)
        throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Không tìm thấy hồ sơ.' })
      const [formCount, ledgerCount, firstForm] = await Promise.all([
        tx.registrationForm.count({ where: { studentId: found.id } }),
        tx.ledgerEntry.count({ where: { studentId: found.id } }),
        tx.registrationForm.findFirst({
          where: { studentId: found.id },
          include: { term: { include: { academicYear: true } } },
          orderBy: { id: 'asc' },
        }),
      ])
      if (formCount > 0 || ledgerCount > 0) {
        const reason =
          formCount > 0 && firstForm
            ? `Đã có phiếu đăng ký ${termLabel(firstForm.term)}.`
            : `Đã có ${ledgerCount} dòng sổ cái.`
        throw new HttpException(
          {
            code: 'DELETE_BLOCKED',
            message: `Không xoá được hồ sơ. ${reason}`,
            registrationForms: formCount,
            ledgerEntries: ledgerCount,
          },
          409,
        )
      }
      await tx.student.delete({ where: { id: found.id } })
      await tx.user.delete({ where: { id: found.userId } })
      await this.writeAudit(tx, 'STUDENT_DELETED', code, { studentCode: code }, audit)
      return found
    })
    await this.sessions.deleteAll(student.userId)
    return { ok: true }
  }

  private toGroup(group: {
    id: number
    code: string
    name: string
    discountRate: number
    priority: number
  }) {
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      discountRate: group.discountRate,
      priority: group.priority,
    }
  }

  private toItem(student: {
    id: number
    studentCode: string
    fullName: string
    email: string | null
    createdAt: Date
    updatedAt: Date
    cohort: { id: number; code: string; admissionYear: number }
    trainingSystem: { id: number; code: string; name: string }
    priorityGroups: {
      priorityGroup: {
        id: number
        code: string
        name: string
        discountRate: number
        priority: number
      }
    }[]
  }) {
    const groups = student.priorityGroups.map((link) => this.toGroup(link.priorityGroup))
    const applied =
      [...groups].sort((a, b) => b.priority - a.priority || b.discountRate - a.discountRate)[0] ??
      null
    return {
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.email,
      cohort: student.cohort,
      trainingSystem: student.trainingSystem,
      priorityGroups: groups,
      appliedPriorityGroup: applied,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    }
  }

  private async assertCodeFree(tx: Prisma.TransactionClient, studentCode: string) {
    const [student, user] = await Promise.all([
      tx.student.findUnique({ where: { studentCode } }),
      tx.user.findUnique({ where: { username: studentCode } }),
    ])
    if (student || user) {
      throw new HttpException(
        { code: 'STUDENT_CODE_EXISTS', message: `MSSV ${studentCode} đã tồn tại.` },
        409,
      )
    }
  }

  private async assertReferences(tx: Prisma.TransactionClient, input: StudentInput) {
    const [cohort, trainingSystem, groups] = await Promise.all([
      tx.cohort.count({ where: { id: input.cohortId } }),
      tx.trainingSystem.count({ where: { id: input.trainingSystemId } }),
      tx.priorityGroup.count({ where: { id: { in: input.priorityGroupIds } } }),
    ])
    if (!cohort || !trainingSystem || groups !== input.priorityGroupIds.length) {
      throw new HttpException(
        {
          code: 'INVALID_REFERENCE',
          message: 'Khoá, hệ đào tạo hoặc đối tượng ưu tiên không hợp lệ.',
        },
        400,
      )
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    payload: unknown,
    audit: AuditContext,
  ) {
    await tx.auditLog.create({
      data: {
        actorId: audit.actorId ?? null,
        action,
        entityType: 'Student',
        entityId,
        payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
        requestId: audit.requestId ?? null,
        ip: audit.ip ?? null,
      },
    })
  }
}
