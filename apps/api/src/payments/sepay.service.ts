import { InjectQueue } from '@nestjs/bullmq'
import { HttpException, Injectable } from '@nestjs/common'
import type { Queue } from 'bullmq'

import { ReceivingAccountService } from '../finance/receiving-account.service'
import { BankTransactionStatus, PaymentChannel, Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentService } from './payment.service'
import {
  parsePaymentCode,
  SEPAY_API_KEY_PARAMETER,
  sepayPayload,
  verifyApiKey,
} from './sepay.validation'

export const SEPAY_QUEUE = 'sepay'
export const PROCESS_TRANSACTION_JOB = 'process'

export function registrationConnection() {
  const url = new URL(process.env.REGISTRATION_REDIS_URL ?? 'redis://localhost:6379/6')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.password && { password: decodeURIComponent(url.password) }),
  }
}

export type SepayReceiveResult = {
  received: true
  transactionId: number
  duplicate: boolean
}

@Injectable()
export class SepayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly accounts: ReceivingAccountService,
    @InjectQueue(SEPAY_QUEUE) private readonly queue: Queue,
  ) {}

  async receive(header: string | undefined, body: unknown): Promise<SepayReceiveResult> {
    const parameter = await this.prisma.systemParameter.findUniqueOrThrow({
      where: { key: SEPAY_API_KEY_PARAMETER },
    })
    const expected = typeof parameter.value === 'string' ? parameter.value : ''
    if (!verifyApiKey(header, expected))
      throw new HttpException(
        { code: 'INVALID_API_KEY', message: 'Khoá API SePay không hợp lệ.' },
        401,
      )

    const input = sepayPayload(body)
    if (input.transferType !== 'in')
      throw new HttpException(
        { code: 'INVALID_TRANSFER_TYPE', message: 'Giao dịch không phải tiền vào.' },
        400,
      )
    if (!(await this.accounts.accepts(input.accountNumber)))
      throw new HttpException(
        { code: 'INVALID_ACCOUNT', message: 'Giao dịch không đúng tài khoản nhận học phí.' },
        400,
      )

    try {
      const transaction = await this.prisma.bankTransaction.create({
        data: {
          sepayId: input.sepayId,
          gateway: input.gateway,
          accountNumber: input.accountNumber,
          transactionDate: input.transactionDate,
          code: input.code,
          content: input.content,
          referenceCode: input.referenceCode,
          amount: input.amount,
          status: BankTransactionStatus.PENDING,
          rawPayload: input.raw as Prisma.InputJsonValue,
        },
      })
      await this.enqueue(input.sepayId, transaction.id)
      return { received: true, transactionId: transaction.id, duplicate: false }
    } catch (error) {
      if (!this.isDuplicate(error)) throw error
      const existing = await this.prisma.bankTransaction.findUniqueOrThrow({
        where: { sepayId: input.sepayId },
      })
      await this.enqueue(input.sepayId, existing.id)
      return { received: true, transactionId: existing.id, duplicate: true }
    }
  }

  async process(transactionId: number): Promise<'matched' | 'unmatched' | 'skipped'> {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
    })
    if (!transaction || transaction.status !== BankTransactionStatus.PENDING) return 'skipped'

    const match = parsePaymentCode(transaction.code) ?? parsePaymentCode(transaction.content)
    const student = match
      ? await this.prisma.student.findUnique({ where: { studentCode: match.studentCode } })
      : null
    const term = match
      ? await this.prisma.term.findUnique({ where: { termCode: match.termCode } })
      : null

    if (!student || !term) {
      await this.prisma.bankTransaction.update({
        where: { id: transaction.id },
        data: { status: BankTransactionStatus.UNMATCHED, processedAt: new Date() },
      })
      return 'unmatched'
    }

    try {
      await this.payments.pay({
        studentCode: student.studentCode,
        termCode: term.termCode,
        amount: transaction.amount,
        channel: PaymentChannel.BANK_TRANSFER,
        bankTransactionId: transaction.id,
        paidAt: transaction.transactionDate,
        note: transaction.content,
      })
    } catch (error) {
      const posted = await this.prisma.receipt.findUnique({
        where: { bankTransactionId: transaction.id },
      })
      if (!posted || !this.isDuplicate(error)) throw error
    }

    await this.prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: {
        status: BankTransactionStatus.MATCHED,
        matchedStudentId: student.id,
        matchedTermId: term.id,
        processedAt: new Date(),
      },
    })
    return 'matched'
  }

  private async enqueue(sepayId: bigint, transactionId: number): Promise<void> {
    await this.queue.add(
      PROCESS_TRANSACTION_JOB,
      { transactionId },
      {
        jobId: `sepay-${sepayId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
      },
    )
  }

  private isDuplicate(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  }
}
