import { BullModule, Processor, WorkerHost } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import type { Job } from 'bullmq'

import { FinanceModule } from '../finance/finance.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PaymentModule } from './payment.module'
import { SepayWebhookController } from './sepay.controller'
import {
  PROCESS_TRANSACTION_JOB,
  sepayQueueConnection,
  SEPAY_QUEUE,
  SepayService,
} from './sepay.service'

@Processor(SEPAY_QUEUE)
export class SepayProcessor extends WorkerHost {
  constructor(private readonly sepay: SepayService) {
    super()
  }

  async process(job: Job): Promise<string> {
    if (job.name !== PROCESS_TRANSACTION_JOB) throw new Error(`Unknown SePay job: ${job.name}`)
    const { transactionId } = job.data as { transactionId: number }
    return this.sepay.process(Number(transactionId))
  }
}

@Module({
  imports: [
    PrismaModule,
    PaymentModule,
    FinanceModule,
    BullModule.registerQueue({ name: SEPAY_QUEUE, connection: sepayQueueConnection() }),
  ],
  controllers: [SepayWebhookController],
  providers: [SepayService, SepayProcessor],
  exports: [SepayService],
})
export class SepayModule {}
