import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common'
import type { Job, Queue } from 'bullmq'

import { Clock } from '../academics/clock'
import { FinanceModule } from '../finance/finance.module'
import { PrismaModule } from '../prisma/prisma.module'
import { SepayApiClient } from './sepay-api'
import { previousVietnamDay } from './reconciliation'
import { ReconciliationController } from './reconciliation.controller'
import { ReconciliationService } from './reconciliation.service'
import { SepayModule } from './sepay.worker'

export const RECONCILIATION_QUEUE = 'reconciliation'
export const RECONCILE_JOB = 'daily'

function queueConnection() {
  // ADR-0010: schedules live on the queue Redis (6380); DB 8 is reserved for daily reconciliation.
  const url = new URL(process.env.RECONCILIATION_REDIS_URL ?? 'redis://localhost:6380/8')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.password && { password: decodeURIComponent(url.password) }),
  }
}

@Processor(RECONCILIATION_QUEUE)
export class ReconciliationProcessor extends WorkerHost {
  constructor(
    private readonly service: ReconciliationService,
    private readonly clock: Clock,
  ) {
    super()
  }

  async process(job: Job) {
    if (job.name !== RECONCILE_JOB) throw new Error(`Unknown reconciliation job: ${job.name}`)
    return this.service.reconcile(previousVietnamDay(this.clock.now()))
  }
}

/** One named scheduler, so extra worker replicas do not multiply the daily run (ADR-0010). */
@Injectable()
export class ReconciliationScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(RECONCILIATION_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'reconciliation:daily',
      { pattern: '30 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
      {
        name: RECONCILE_JOB,
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
      },
    )
  }
}

@Module({
  imports: [
    PrismaModule,
    FinanceModule,
    SepayModule,
    BullModule.registerQueue({ name: RECONCILIATION_QUEUE, connection: queueConnection() }),
  ],
  controllers: [ReconciliationController],
  providers: [
    Clock,
    SepayApiClient,
    ReconciliationService,
    ReconciliationProcessor,
    ReconciliationScheduler,
  ],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
