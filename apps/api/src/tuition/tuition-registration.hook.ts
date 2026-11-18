import { Injectable, Logger } from '@nestjs/common'

import { Prisma, TermType, type Term } from '../generated/prisma/client'
import type { TermRegistrationHook } from '../term-phases/term-phase.service'
import { MissingFeeScheduleError, TuitionService } from './tuition.service'

/**
 * HP-02/HP-11: runs inside the conditional phase-update transaction of TermPhaseService. A missing
 * fee schedule throws, so the roll-back leaves the term in PREPARATION and the warning is logged once.
 */
@Injectable()
export class TuitionRegistrationHook implements TermRegistrationHook {
  private readonly logger = new Logger(TuitionRegistrationHook.name)

  constructor(private readonly tuition: TuitionService) {}

  async onEnterRegistration(tx: Prisma.TransactionClient, term: Term): Promise<void> {
    const students = await tx.student.findMany({
      include: { cohort: true, trainingSystem: true },
      orderBy: { id: 'asc' },
    })
    const previous = await tx.term.findFirst({
      where: {
        id: { not: term.id },
        registrationStartAt: { lt: term.registrationStartAt },
      },
      orderBy: { registrationStartAt: 'desc' },
      include: { academicYear: true },
    })

    if (term.type !== TermType.SUMMER) {
      const schedules = await tx.feeSchedule.findMany()
      const byPair = new Map(
        schedules.map((schedule) => [
          `${schedule.cohortId}:${schedule.trainingSystemId}`,
          schedule,
        ]),
      )
      const missing = new Map<string, number>()
      for (const student of students) {
        const key = `${student.cohortId}:${student.trainingSystemId}`
        if (byPair.has(key)) continue
        const label = `Khoá ${student.cohort.code.replace(/^K/, '')} · ${student.trainingSystem.code}`
        missing.set(label, (missing.get(label) ?? 0) + 1)
      }
      if (missing.size > 0) {
        const pairs = [...missing].map(([label, count]) => `${label} (${count} sinh viên)`)
        const error = new MissingFeeScheduleError(pairs)
        this.logger.warn(error.message)
        throw error
      }
      for (const student of students) {
        const key = `${student.cohortId}:${student.trainingSystemId}`
        await this.tuition.postBaseTuition(tx, term, student, byPair.get(key)!)
      }
    }

    if (previous) {
      for (const student of students)
        await this.tuition.carryBalance(tx, term, previous, student.id)
    }
  }
}
