import { HttpException, Injectable } from '@nestjs/common'

import type { AuthRequest } from '../auth/auth.guard'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { CohortInput, PriorityGroupInput } from './catalog.validation'

type Actor = { actorId: number; requestId?: string }
type Change = Record<string, number | string | null>

export type PriorityGroupRow = {
  id: number
  code: string
  name: string
  discountRate: number
  priority: number
  studentCount: number
  duplicatePriority: boolean
}

export type CohortRow = {
  id: number
  code: string
  admissionYear: number
  studentCount: number
  feeScheduleCount: number
  registrationSlotCount: number
}

/** QV-01/ADR-0007: Phòng Đào tạo owns the priority-group and cohort catalogues in the students module. */
@Injectable()
export class AcademicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  actor(req: AuthRequest): Actor {
    return { actorId: req.auth!.session.userId, requestId: req.requestId }
  }

  async list(): Promise<{ priorityGroups: PriorityGroupRow[]; cohorts: CohortRow[] }> {
    const [groups, cohorts] = await Promise.all([
      this.prisma.priorityGroup.findMany({
        include: { _count: { select: { students: true } } },
        orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.cohort.findMany({
        include: {
          _count: { select: { students: true, feeSchedules: true, registrationSlots: true } },
        },
        orderBy: [{ admissionYear: 'asc' }, { id: 'asc' }],
      }),
    ])
    const priorityCounts = new Map<number, number>()
    for (const group of groups)
      priorityCounts.set(group.priority, (priorityCounts.get(group.priority) ?? 0) + 1)

    return {
      priorityGroups: groups.map((group) => ({
        id: group.id,
        code: group.code,
        name: group.name,
        discountRate: group.discountRate,
        priority: group.priority,
        studentCount: group._count.students,
        // HS-02: a tie is a warning, never a validation error.
        duplicatePriority: (priorityCounts.get(group.priority) ?? 0) > 1,
      })),
      cohorts: cohorts.map((cohort) => ({
        id: cohort.id,
        code: cohort.code,
        admissionYear: cohort.admissionYear,
        studentCount: cohort._count.students,
        feeScheduleCount: cohort._count.feeSchedules,
        registrationSlotCount: cohort._count.registrationSlots,
      })),
    }
  }

  async createPriorityGroup(input: PriorityGroupInput, actor: Actor) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.priorityGroup.create({ data: input })
        await this.audit(tx, actor, 'PRIORITY_GROUP_CREATE', created.id, null, created)
        return created
      })
    } catch (error) {
      this.handleError(error, 'đối tượng ưu tiên')
    }
  }

  async updatePriorityGroup(id: number, input: PriorityGroupInput, actor: Actor) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // HP-06: only new ledger entries take the new rate; nothing in the past is rewritten.
        const before = await tx.priorityGroup.findUnique({ where: { id } })
        if (!before) throw this.notFound('đối tượng ưu tiên')
        const after = await tx.priorityGroup.update({ where: { id }, data: input })
        await this.audit(tx, actor, 'PRIORITY_GROUP_UPDATE', id, before, after)
        return after
      })
    } catch (error) {
      this.handleError(error, 'đối tượng ưu tiên')
    }
  }

  async deletePriorityGroup(id: number, actor: Actor) {
    try {
      const group = await this.prisma.priorityGroup.findUnique({
        where: { id },
        include: { _count: { select: { students: true } } },
      })
      if (!group) throw this.notFound('đối tượng ưu tiên')
      // HS-02: a group with students cannot be deleted.
      if (group._count.students > 0)
        throw new HttpException(
          {
            code: 'PRIORITY_GROUP_IN_USE',
            message: `Không xoá được đối tượng "${group.name}": đang có ${group._count.students} sinh viên thuộc đối tượng này.`,
            studentCount: group._count.students,
          },
          409,
        )

      await this.prisma.$transaction(async (tx) => {
        await tx.priorityGroup.delete({ where: { id } })
        await this.audit(
          tx,
          actor,
          'PRIORITY_GROUP_DELETE',
          id,
          {
            id: group.id,
            code: group.code,
            name: group.name,
            discountRate: group.discountRate,
            priority: group.priority,
          },
          null,
        )
      })
      return { ok: true }
    } catch (error) {
      this.handleError(error, 'đối tượng ưu tiên')
    }
  }

  async createCohort(input: CohortInput, actor: Actor) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.cohort.create({ data: input })
        await this.audit(tx, actor, 'COHORT_CREATE', created.id, null, created)
        return created
      })
    } catch (error) {
      this.handleError(error, 'khoá tuyển sinh')
    }
  }

  async updateCohort(id: number, input: CohortInput, actor: Actor) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.cohort.findUnique({ where: { id } })
        if (!before) throw this.notFound('khoá tuyển sinh')
        const after = await tx.cohort.update({ where: { id }, data: input })
        await this.audit(tx, actor, 'COHORT_UPDATE', id, before, after)
        return after
      })
    } catch (error) {
      this.handleError(error, 'khoá tuyển sinh')
    }
  }

  async deleteCohort(id: number, actor: Actor) {
    try {
      const cohort = await this.prisma.cohort.findUnique({
        where: { id },
        include: {
          _count: {
            select: { students: true, feeSchedules: true, registrationSlots: true },
          },
        },
      })
      if (!cohort) throw this.notFound('khoá tuyển sinh')
      // HS-15: every blocking relationship is named so the UI can show the reason.
      const reasons: string[] = []
      if (cohort._count.students > 0) reasons.push(`có ${cohort._count.students} sinh viên`)
      if (cohort._count.feeSchedules > 0) reasons.push(`có ${cohort._count.feeSchedules} bảng phí`)
      if (cohort._count.registrationSlots > 0)
        reasons.push(`có ${cohort._count.registrationSlots} khung giờ`)
      if (reasons.length > 0)
        throw new HttpException(
          {
            code: 'COHORT_IN_USE',
            message: `Không xoá được khoá ${cohort.code}: đang ${reasons.join(', ')}.`,
            reasons,
            counts: cohort._count,
          },
          409,
        )

      await this.prisma.$transaction(async (tx) => {
        await tx.cohort.delete({ where: { id } })
        await this.audit(
          tx,
          actor,
          'COHORT_DELETE',
          id,
          { id: cohort.id, code: cohort.code, admissionYear: cohort.admissionYear },
          null,
        )
      })
      return { ok: true }
    } catch (error) {
      this.handleError(error, 'khoá tuyển sinh')
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: Actor,
    action: string,
    entityId: number,
    before: Change | null,
    after: Change | null,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: actor.actorId,
        action,
        entityType: action.startsWith('COHORT') ? 'Cohort' : 'PriorityGroup',
        entityId: String(entityId),
        payload: { before, after },
        requestId: actor.requestId,
      },
    })
  }

  private notFound(entity: string): HttpException {
    return new HttpException({ code: 'NOT_FOUND', message: `Không tìm thấy ${entity}.` }, 404)
  }

  private handleError(error: unknown, entity: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new HttpException({ code: 'CODE_EXISTS', message: `Mã ${entity} đã tồn tại.` }, 409)
      if (error.code === 'P2003')
        throw new HttpException(
          { code: 'IN_USE', message: `Không xoá được ${entity} đang được sử dụng.` },
          409,
        )
      if (error.code === 'P2025') throw this.notFound(entity)
    }
    throw error instanceof Error ? error : new Error(String(error))
  }
}
