import { Injectable } from '@nestjs/common'

import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const BANK_ACCOUNT_KEY = 'payment.bankAccount'

export type ReceivingAccount = {
  gateway: string
  accountNumber: string
  accountName: string
}

type Reader = Pick<PrismaService, 'systemParameter'> | Prisma.TransactionClient

@Injectable()
export class ReceivingAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async current(db: Reader = this.prisma): Promise<ReceivingAccount> {
    const parameter = await db.systemParameter.findUniqueOrThrow({
      where: { key: BANK_ACCOUNT_KEY },
    })
    return parameter.value as unknown as ReceivingAccount
  }

  async accepts(accountNumber: string, db: Reader = this.prisma): Promise<boolean> {
    return (await this.current(db)).accountNumber === accountNumber
  }
}
