import { Injectable } from '@nestjs/common'

import { Clock } from '../academics/clock'
import { EnrollmentStatus, type Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { prerequisiteCheck } from './prerequisites'
import { RegistrationService } from './registration.service'

export type ReviewResult = {
  reviewed: number
  cleared: number
  cancelled: number
  kept: number
}

type PendingRow = Prisma.EnrollmentGetPayload<{
  include: { form: { include: { term: true } }; section: true; course: true }
}>

/**
 * DK-06/YC22: the daily pass over conditional lines. A grade that arrives clears the flag; a
 * REQUIRED_PASS failure auto-cancels through the shared path while the form is still in its period.
 * Every row is re-read and guarded inside its own transaction, so a retry or a second worker is safe.
 */
@Injectable()
export class PrerequisiteReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly registration: RegistrationService,
  ) {}

  async review(): Promise<ReviewResult> {
    const pending = await this.prisma.enrollment.findMany({
      where: { pendingPrerequisite: true, status: EnrollmentStatus.REGISTERED },
      include: { form: { include: { term: true } }, section: true, course: true },
      orderBy: { id: 'asc' },
    })
    const result: ReviewResult = { reviewed: pending.length, cleared: 0, cancelled: 0, kept: 0 }

    for (const row of pending) {
      await this.prisma.$transaction(async (tx) => {
        const fresh: PendingRow | null = await tx.enrollment.findUnique({
          where: { id: row.id },
          include: { form: { include: { term: true } }, section: true, course: true },
        })
        if (!fresh || fresh.status !== EnrollmentStatus.REGISTERED || !fresh.pendingPrerequisite)
          return

        const check = await prerequisiteCheck(tx, fresh.form.studentId, fresh.course)
        if (check.state === 'CONDITIONAL') return
        if (check.state === 'OK') {
          const cleared = await tx.enrollment.updateMany({
            where: { id: fresh.id, pendingPrerequisite: true },
            data: { pendingPrerequisite: false },
          })
          result.cleared += cleared.count
          return
        }

        const inPeriod =
          !fresh.form.finalizedAt &&
          (fresh.form.term.phase === 'REGISTRATION' || fresh.form.term.phase === 'ADJUSTMENT')
        if (!inPeriod) {
          result.kept++
          return
        }
        await this.registration.cancelActive(
          tx,
          fresh,
          this.clock.now(),
          `Tự huỷ: ${check.condition.code} Không đạt`,
        )
        result.cancelled++
      })
    }
    return result
  }
}
