import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { describe, expect, it } from 'bun:test'
import { HttpException } from '@nestjs/common'

import { PasswordHasher } from '../auth/password.hasher'
import { SessionStore } from '../auth/session.store'
import { ReceivingAccountService } from '../finance/receiving-account.service'
import {
  LedgerDirection,
  LedgerEntryType,
  PrismaClient,
  TermPhase,
  type Prisma,
} from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StudentsService, type StudentInput } from '../students/students.service'
import { recalculationGroupOf } from './recalculation'
import { TuitionService } from './tuition.service'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})
const prisma = db as unknown as PrismaService
const tuition = new TuitionService(prisma, new ReceivingAccountService(prisma))
const students = new StudentsService(
  prisma,
  {} as PasswordHasher,
  { deleteAll: () => Promise.resolve() } as unknown as SessionStore,
  tuition,
)

const ROLLBACK = 'isolated-test-rollback'
async function isolated(run: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await db.$transaction(async (tx) => {
      await run(tx)
      throw new Error(ROLLBACK)
    })
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error
  }
}

async function profileOf(code: string): Promise<StudentInput> {
  const student = await db.student.findUniqueOrThrow({
    where: { studentCode: code },
    include: { cohort: true, trainingSystem: true, priorityGroups: true },
  })
  return {
    studentCode: student.studentCode,
    fullName: student.fullName,
    email: student.email ?? '',
    cohortId: student.cohortId,
    trainingSystemId: student.trainingSystemId,
    priorityGroupIds: student.priorityGroups.map((link) => link.priorityGroupId),
  }
}

const codeOf = async (cohort: string) =>
  (await db.cohort.findUniqueOrThrow({ where: { code: cohort } })).id
const systemId = async (code: string) =>
  (await db.trainingSystem.findUniqueOrThrow({ where: { code } })).id
const termOf = async (code: string) => db.term.findUniqueOrThrow({ where: { termCode: code } })

describe('HP-12/HS-14: recalculating tuition on a profile edit', () => {
  it('previews 24520013 CQUI → CLC as 15M → 20M without writing anything (C.4.3)', async () => {
    const profile = await profileOf('24520013')
    const [cqui, clc, open] = await Promise.all([
      systemId('CQUI'),
      systemId('CLC'),
      termOf('20262'),
    ])
    expect(profile.trainingSystemId).toBe(cqui)
    const ledgerBefore = await db.ledgerEntry.count()
    const studentBefore = await db.student.findUniqueOrThrow({ where: { studentCode: '24520013' } })

    const preview = await tuition.preview('24520013', { ...profile, trainingSystemId: clc })

    expect(preview.student.studentCode).toBe('24520013')
    expect(preview.terms).toHaveLength(1)
    const term = preview.terms[0]!
    expect(term.termCode).toBe(open.termCode)
    expect(term.reason).toBe('đổi hệ CQUI → CLC')
    expect(term.blocked).toBeNull()
    expect(term.before.baseTuition).toBe(15_000_000)
    expect(term.after.baseTuition).toBe(20_000_000)
    expect(term.before.netAmount).toBe(15_000_000)
    expect(term.after.netAmount).toBe(20_000_000)
    expect(term.before.outstandingAmount).toBe(15_000_000)
    expect(term.after.outstandingAmount).toBe(20_000_000)
    expect(await db.ledgerEntry.count()).toBe(ledgerBefore)
    expect(
      (await db.student.findUniqueOrThrow({ where: { studentCode: '24520013' } })).trainingSystemId,
    ).toBe(studentBefore.trainingSystemId)
  })

  it('commits the profile edit and one grouped set of reversal/re-post rows in one transaction', async () => {
    const profile = await profileOf('24520013')
    const clc = await systemId('CLC')
    const actor = await db.user.findUniqueOrThrow({ where: { username: 'pdt.hang' } })
    const student = await db.student.findUniqueOrThrow({
      where: { studentCode: '24520013' },
      include: { priorityGroups: true, cohort: true, trainingSystem: true },
    })
    const open = await termOf('20262')
    const previous = await termOf('20261')
    const snapshot = {
      enrollments: await db.enrollment.findMany({
        where: { form: { studentId: student.id, termId: open.id } },
        orderBy: { id: 'asc' },
      }),
      receipts: await db.receipt.count({ where: { studentId: student.id } }),
      previous: await tuition.bm7(db, student.id, previous.id),
    }

    await isolated(async (tx) => {
      const result = await students.applyUpdate(
        tx,
        '24520013',
        { ...profile, trainingSystemId: clc },
        { actorId: actor.id, requestId: 'req-52' },
      )
      expect(result.item.trainingSystem.code).toBe('CLC')

      const bm7 = await tuition.bm7(tx, student.id, open.id)
      expect(bm7.netAmount).toBe(20_000_000)
      expect(bm7.outstandingAmount).toBe(20_000_000)

      const rows = await tx.ledgerEntry.findMany({
        where: { studentId: student.id, termId: open.id },
        orderBy: { id: 'asc' },
      })
      const reversal = rows.filter((row) => row.type === LedgerEntryType.BASE_TUITION_REVERSAL)
      expect(reversal).toHaveLength(1)
      expect(reversal[0]!.direction).toBe(LedgerDirection.CREDIT)
      expect(Number(reversal[0]!.amount)).toBe(15_000_000)
      const posted = rows.filter(
        (row) =>
          row.type === LedgerEntryType.BASE_TUITION && row.description?.includes('hồ sơ mới'),
      )
      expect(posted).toHaveLength(1)
      expect(Number(posted[0]!.amount)).toBe(20_000_000)

      const groups = new Set(
        rows.map((row) => recalculationGroupOf(row.description)).filter(Boolean),
      )
      expect(groups.size).toBe(1)
      expect([...groups][0]).toContain('đổi hệ CQUI → CLC')

      const logs = await tx.auditLog.findMany({
        where: { entityType: 'Student', entityId: '24520013', action: 'TUITION_RECALCULATED' },
      })
      expect(logs).toHaveLength(1)
      expect(logs[0]!.actorId).toBe(actor.id)
      expect(logs[0]!.requestId).toBe('req-52')

      expect(
        await tx.enrollment.findMany({
          where: { form: { studentId: student.id, termId: open.id } },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(snapshot.enrollments)
      expect(await tx.receipt.count({ where: { studentId: student.id } })).toBe(snapshot.receipts)
      expect(await tuition.bm7(tx, student.id, previous.id)).toEqual(snapshot.previous)
    })

    // The outer transaction never saw the edit: one transaction really did contain everything.
    expect(
      (await db.student.findUniqueOrThrow({ where: { studentCode: '24520013' } })).trainingSystemId,
    ).toBe(profile.trainingSystemId)
    expect(await tuition.bm7(db, student.id, open.id)).toEqual({
      grossAmount: 15_000_000,
      discountAmount: 0,
      netAmount: 15_000_000,
      paidAmount: 0,
      outstandingAmount: 15_000_000,
    })
  })

  it('blocks the save and shows the Finance contact when the new pair has no fee table', async () => {
    const profile = await profileOf('24520013')
    const [k20, clc] = await Promise.all([codeOf('K20'), systemId('CLC')])
    const proposed = { ...profile, cohortId: k20, trainingSystemId: clc }
    const ledgerBefore = await db.ledgerEntry.count()

    const preview = await tuition.preview('24520013', proposed)
    expect(preview.terms[0]!.blocked).toEqual({
      code: 'MISSING_FEE_SCHEDULE',
      message: 'Chưa có bảng phí cho Khoá 20 · CLC. Liên hệ Phòng Tài vụ.',
    })
    expect(await db.ledgerEntry.count()).toBe(ledgerBefore)

    await isolated(async (tx) => {
      let failure: unknown
      try {
        await students.applyUpdate(tx, '24520013', proposed, {})
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(HttpException)
      expect((failure as HttpException).getResponse()).toMatchObject({
        code: 'MISSING_FEE_SCHEDULE',
      })
      expect(await tx.ledgerEntry.count()).toBe(ledgerBefore)
      expect(
        (await tx.student.findUniqueOrThrow({ where: { studentCode: '24520013' } })).cohortId,
      ).toBe(profile.cohortId)
    })
  })

  it('saves straight through outside the registration window', async () => {
    const profile = await profileOf('24520013')
    const clc = await systemId('CLC')
    const open = await termOf('20262')
    const student = await db.student.findUniqueOrThrow({ where: { studentCode: '24520013' } })

    await isolated(async (tx) => {
      await tx.term.update({ where: { id: open.id }, data: { phase: TermPhase.IN_PROGRESS } })
      const ledgerBefore = await tx.ledgerEntry.count()
      const result = await students.applyUpdate(
        tx,
        '24520013',
        { ...profile, trainingSystemId: clc },
        {},
      )
      expect(result.item.trainingSystem.code).toBe('CLC')
      expect(await tx.ledgerEntry.count()).toBe(ledgerBefore)
      expect(
        await tx.auditLog.count({
          where: { entityId: '24520013', action: 'TUITION_RECALCULATED' },
        }),
      ).toBe(0)
      expect(
        await tuition.plansForUpdate(
          tx,
          {
            ...student,
            cohort: { code: 'K19' },
            trainingSystem: { code: 'CQUI' },
            priorityGroups: [],
          },
          { cohortId: profile.cohortId, trainingSystemId: clc, priorityGroupIds: [] },
          'đổi hệ CQUI → CLC',
        ),
      ).toEqual([])
    })
  })

  it('treats an outstanding amount below zero as a credit balance for the next term', async () => {
    const profile = await profileOf('24520002')
    const k18 = await codeOf('K18')
    const student = await db.student.findUniqueOrThrow({
      where: { studentCode: '24520002' },
      include: { cohort: true, trainingSystem: true },
    })
    const open = await termOf('20262')
    const next = await termOf('20263')
    const preview = await tuition.preview('24520002', { ...profile, cohortId: k18 })
    expect(preview.terms[0]!.before.netAmount).toBe(3_000_000)
    expect(preview.terms[0]!.after.netAmount).toBe(2_900_000)
    expect(preview.terms[0]!.after.outstandingAmount).toBe(-100_000)
    expect(preview.terms[0]!.creditBalance).toBe(100_000)

    await isolated(async (tx) => {
      await students.applyUpdate(tx, '24520002', { ...profile, cohortId: k18 }, {})
      expect((await tuition.bm7(tx, student.id, open.id)).outstandingAmount).toBe(-100_000)
      // The term-transition hook reads exactly this surplus when 20263 enters REGISTRATION.
      await tuition.carryBalance(tx, next, open, student.id)
      const carried = await tx.ledgerEntry.findMany({
        where: {
          studentId: student.id,
          type: { in: [LedgerEntryType.BALANCE_CARRY_OUT, LedgerEntryType.BALANCE_CARRY_IN] },
        },
      })
      expect(carried).toHaveLength(2)
      expect(carried.every((row) => Number(row.amount) === 100_000)).toBe(true)
      expect((await tuition.bm7(tx, student.id, open.id)).outstandingAmount).toBe(0)
    })
  })
})
