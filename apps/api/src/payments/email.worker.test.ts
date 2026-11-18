import { describe, expect, it } from 'bun:test'

import type { PrismaService } from '../prisma/prisma.service'
import { EmailProcessor, MailerService, OutboxRelay, RELAY_JOB, SEND_JOB } from './email.worker'
import { renderSettledEmail, TUITION_SETTLED, type SettledPayload } from './settled-email'

const payload: SettledPayload = {
  studentCode: '24520001',
  studentName: 'Nguyễn Văn A',
  email: 'student@uit.edu.vn',
  termCode: '20262',
  termName: 'HK2 2026–2027',
  netAmount: 15_000_000,
  paidAmount: 15_000_000,
  creditBalance: 0,
  receiptNumber: 'PT-20262-00045',
}

describe('B.4.7: settled email rendering', () => {
  it('names the term, amounts and the last receipt, and carries the credit balance', () => {
    const email = renderSettledEmail(payload)
    expect(email.to).toBe('student@uit.edu.vn')
    expect(email.subject).toContain('HK2 2026–2027')
    expect(email.html).toContain('15.000.000 đ')
    expect(email.html).toContain('PT-20262-00045')
    expect(email.html).toContain('Đây là email tự động')
    expect(email.html).not.toContain('Số dư có')
    expect(renderSettledEmail({ ...payload, creditBalance: 500_000 }).html).toContain('Số dư có')
  })
})

describe('ADR-0008/0010: outbox relay and email worker', () => {
  it('queues unpublished events once and marks them published', async () => {
    const added: { name: string; data: unknown; opts: unknown }[] = []
    const published: unknown[] = []
    const prisma = {
      outboxEvent: {
        findMany: () => Promise.resolve([{ id: 7, type: TUITION_SETTLED, payload }]),
        updateMany: (args: unknown) => Promise.resolve(published.push(args)),
      },
    } as unknown as PrismaService
    const queue = {
      add: (name: string, data: unknown, opts: unknown) =>
        Promise.resolve(added.push({ name, data, opts })),
    }
    const relay = new OutboxRelay(prisma, queue as never, new MailerService())

    expect(await relay.publishPending()).toBe(1)
    expect(added[0]!.name).toBe(SEND_JOB)
    expect(added[0]!.data).toEqual({ outboxId: 7 })
    expect(published).toHaveLength(1)
  })

  it('sends to the profile email and ignores unknown events', async () => {
    const sent: string[] = []
    const mailer = {
      send: (to: string) => Promise.resolve(sent.push(to)),
    } as unknown as MailerService
    const prisma = {
      outboxEvent: {
        findUnique: () => Promise.resolve({ id: 7, type: TUITION_SETTLED, payload }),
        findMany: () => Promise.resolve([]),
        updateMany: () => Promise.resolve({ count: 0 }),
      },
    } as unknown as PrismaService
    const relay = new OutboxRelay(prisma, {} as never, mailer)
    expect(await relay.send(7)).toBe(true)
    expect(sent).toEqual(['student@uit.edu.vn'])

    const processor = new EmailProcessor(relay)
    expect(await processor.process({ name: SEND_JOB, data: { outboxId: 7 } } as never)).toBe(true)
    expect(await processor.process({ name: RELAY_JOB, data: {} } as never)).toBe(0)
  })
})
