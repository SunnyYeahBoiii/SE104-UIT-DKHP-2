import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common'
import type { Job, Queue } from 'bullmq'

import { Clock } from '../academics/clock'
import { PrismaModule } from '../prisma/prisma.module'
import { PrerequisiteReviewModule } from '../registration/prerequisite-review.worker'
import {
  NoopTermRegistrationHook,
  TERM_REGISTRATION_HOOK,
  TermPhaseService,
  type AdvanceResult,
} from './term-phase.service'

export const TERM_PHASE_QUEUE = 'term-phases'
export const ADVANCE_JOB = 'advance'

function queueConnection() {
  // ADR-0010: the queue has its own Redis (compose.dev.yml, 6380) and uses database index 11.
  const url = new URL(process.env.QUEUE_REDIS_URL ?? 'redis://localhost:6380/11')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.password && { password: decodeURIComponent(url.password) }),
  }
}

@Processor(TERM_PHASE_QUEUE)
export class TermPhaseProcessor extends WorkerHost {
  constructor(private readonly service: TermPhaseService) {
    super()
  }

  async process(job: Job): Promise<AdvanceResult> {
    if (job.name !== ADVANCE_JOB) throw new Error(`Unknown term-phase job: ${job.name}`)
    return this.service.advance()
  }
}

/** One repeatable schedule, declared by id so extra worker replicas do not multiply it (ADR-0010). */
@Injectable()
export class TermPhaseScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(TERM_PHASE_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'term-phases:every-minute',
      { every: 60_000 },
      { name: ADVANCE_JOB, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } } },
    )
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: TERM_PHASE_QUEUE })],
  providers: [
    Clock,
    TermPhaseService,
    TermPhaseProcessor,
    TermPhaseScheduler,
    { provide: TERM_REGISTRATION_HOOK, useClass: NoopTermRegistrationHook },
  ],
  exports: [TERM_REGISTRATION_HOOK, TermPhaseService],
})
export class TermPhasesModule {}

/** ADR-0007: the worker is the same codebase under a different entrypoint. */
@Module({
  imports: [
    PrismaModule,
    BullModule.forRoot({ connection: queueConnection() }),
    TermPhasesModule,
    PrerequisiteReviewModule,
  ],
})
export class WorkerModule {}
