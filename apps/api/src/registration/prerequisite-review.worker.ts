import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common'
import type { Job, Queue } from 'bullmq'

import { Clock } from '../academics/clock'
import { PrerequisiteReviewService, type ReviewResult } from './prerequisite-review.service'
import { RegistrationModule } from './registration.module'

export const PREREQUISITE_QUEUE = 'prerequisites'
export const REVIEW_JOB = 'daily-review'

function queueConnection() {
  // DB 0 of the queue Redis (compose.dev.yml): separate from sessions (7) and registration (14).
  const url = new URL(process.env.PREREQUISITE_REDIS_URL ?? 'redis://localhost:6380/0')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.password && { password: decodeURIComponent(url.password) }),
  }
}

@Processor(PREREQUISITE_QUEUE)
export class PrerequisiteReviewProcessor extends WorkerHost {
  constructor(private readonly service: PrerequisiteReviewService) {
    super()
  }

  async process(job: Job): Promise<ReviewResult> {
    if (job.name !== REVIEW_JOB) throw new Error(`Unknown prerequisite job: ${job.name}`)
    return this.service.review()
  }
}

/** One named scheduler, so extra worker replicas do not multiply the daily run (ADR-0010). */
@Injectable()
export class PrerequisiteReviewScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(PREREQUISITE_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'prerequisites:daily',
      { pattern: '0 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
      { name: REVIEW_JOB, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } },
    )
  }
}

@Module({
  imports: [
    BullModule.registerQueue({ name: PREREQUISITE_QUEUE, connection: queueConnection() }),
    RegistrationModule,
  ],
  providers: [
    Clock,
    PrerequisiteReviewService,
    PrerequisiteReviewProcessor,
    PrerequisiteReviewScheduler,
  ],
  exports: [PrerequisiteReviewService],
})
export class PrerequisiteReviewModule {}
