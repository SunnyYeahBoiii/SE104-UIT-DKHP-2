import { Inject, Injectable, Optional } from '@nestjs/common'

import { Clock } from '../academics/clock'
import { nextTermPhase, type MilestoneValues, type TermPhase } from '../academics/term-policy'
import type { Prisma, Term } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** Replace in the worker module when the tuition slice is implemented (HP-02). */
export const TERM_REGISTRATION_HOOK = 'TERM_REGISTRATION_HOOK'

export interface TermRegistrationHook {
  onEnterRegistration(tx: Prisma.TransactionClient, term: Term): Promise<void>
}

export class NoopTermRegistrationHook implements TermRegistrationHook {
  async onEnterRegistration(): Promise<void> {}
}

export type TermPhaseTransition = { termCode: string; from: TermPhase; to: TermPhase }

export type AdvanceResult = { transitions: TermPhaseTransition[] }

/**
 * HK-03/DK-15: milestone-driven phase changes. Each step is a conditional `UPDATE ... WHERE phase =
 * old_phase` inside one transaction; the phase-specific work shares that transaction. A second run (or
 * a second worker) wins zero rows and becomes a no-op.
 */
@Injectable()
export class TermPhaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Optional() @Inject(TERM_REGISTRATION_HOOK) private readonly hook?: TermRegistrationHook,
  ) {}

  /** `termId` is only used by tests to keep their fixture away from the seeded terms. */
  async advance(options: { termId?: number } = {}): Promise<AdvanceResult> {
    const now = this.clock.now()
    const terms = await this.prisma.term.findMany({
      where: {
        phase: { not: 'CLOSED' },
        ...(options.termId === undefined ? {} : { id: options.termId }),
      },
      // HK-04: an earlier window must close before a later one opens.
      orderBy: { registrationStartAt: 'asc' },
    })
    const transitions: TermPhaseTransition[] = []

    for (const term of terms) {
      let phase = term.phase
      for (;;) {
        const milestones: MilestoneValues = {
          registrationStartAt: term.registrationStartAt,
          registrationEndAt: term.registrationEndAt,
          adjustmentStartAt: term.adjustmentStartAt,
          adjustmentEndAt: term.adjustmentEndAt,
          tuitionDeadline: term.tuitionDeadline,
        }
        const next = nextTermPhase(phase, milestones, now)
        if (!next) break

        const won = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.term.updateMany({
            where: { id: term.id, phase },
            data: { phase: next },
          })
          if (updated.count === 0) return false
          if (next === 'REGISTRATION') await this.hook?.onEnterRegistration(tx, term)
          if (next === 'IN_PROGRESS') await this.finalize(tx, term, now)
          return true
        })
        if (!won) break

        transitions.push({ termCode: term.termCode, from: phase, to: next })
        phase = next
      }
    }
    return { transitions }
  }

  /** DK-15 + DK-08: close every form, then mark (never block) the ones below minCredits. */
  private async finalize(tx: Prisma.TransactionClient, term: Term, now: Date): Promise<void> {
    await tx.registrationForm.updateMany({
      where: { termId: term.id, finalizedAt: null },
      data: { finalizedAt: now },
    })
    const forms = await tx.registrationForm.findMany({
      where: { termId: term.id },
      select: {
        id: true,
        studentId: true,
        enrollments: { where: { status: { not: 'CANCELLED' } }, select: { credits: true } },
      },
    })
    await tx.enrollment.updateMany({
      where: { formId: { in: forms.map((form) => form.id) }, status: 'REGISTERED' },
      data: { status: 'FINALIZED', finalizedAt: now },
    })
    for (const form of forms) {
      const credits = form.enrollments.reduce((sum, enrollment) => sum + enrollment.credits, 0)
      if (credits >= term.minCredits) continue
      await tx.creditWarning.upsert({
        where: { studentId_termId: { studentId: form.studentId, termId: term.id } },
        create: {
          studentId: form.studentId,
          termId: term.id,
          credits,
          minCredits: term.minCredits,
        },
        update: { credits, minCredits: term.minCredits },
      })
    }
  }
}
