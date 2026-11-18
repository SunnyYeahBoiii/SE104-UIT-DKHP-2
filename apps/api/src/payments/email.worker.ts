import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common'
import type { Job, Queue } from 'bullmq'

import { PrismaModule } from '../prisma/prisma.module'
import { PrismaService } from '../prisma/prisma.service'
import { renderSettledEmail, TUITION_SETTLED, type SettledPayload } from './settled-email'

export const EMAIL_QUEUE = 'email'
export const RELAY_JOB = 'relay'
export const SEND_JOB = 'send'

export class MailerService {
  /** No SMTP in the dev compose stack; the dev transport writes the rendered message to stdout. */
  send(to: string, subject: string, html: string): Promise<void> {
    if (to) process.stdout.write(`[email] to=${to} subject=${subject} html=${html.length} bytes\n`)
    return Promise.resolve()
  }
}

@Injectable()
export class OutboxRelay {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue,
    private readonly mailer: MailerService,
  ) {}

  /** ADR-0008/0010: mark published only after the job is durably queued; the consumer stays idempotent. */
  async publishPending(): Promise<number> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { type: TUITION_SETTLED, publishedAt: null },
      orderBy: { id: 'asc' },
      take: 100,
    })
    for (const event of events) {
      await this.queue.add(
        SEND_JOB,
        { outboxId: event.id },
        {
          jobId: `outbox:${event.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
        },
      )
    }
    if (events.length)
      await this.prisma.outboxEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { publishedAt: new Date() },
      })
    return events.length
  }

  async send(outboxId: number): Promise<boolean> {
    const event = await this.prisma.outboxEvent.findUnique({ where: { id: outboxId } })
    if (!event || event.type !== TUITION_SETTLED) return false
    const payload = event.payload as SettledPayload
    const email = renderSettledEmail(payload)
    await this.mailer.send(email.to, email.subject, email.html)
    return true
  }
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  constructor(private readonly relay: OutboxRelay) {
    super()
  }

  async process(job: Job): Promise<number | boolean> {
    if (job.name === RELAY_JOB) return this.relay.publishPending()
    if (job.name === SEND_JOB) {
      const data = job.data as { outboxId?: unknown }
      return this.relay.send(Number(data.outboxId))
    }
    throw new Error(`Unknown email job: ${job.name}`)
  }
}

@Injectable()
export class OutboxRelayScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'outbox:every-minute',
      { every: 60_000 },
      { name: RELAY_JOB, opts: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } } },
    )
  }
}

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [MailerService, OutboxRelay, EmailProcessor, OutboxRelayScheduler],
  exports: [MailerService, OutboxRelay],
})
export class EmailModule {}
