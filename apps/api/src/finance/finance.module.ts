import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { FinanceController } from './finance.controller'
import { FinanceService } from './finance.service'
import { ReceivingAccountService } from './receiving-account.service'

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, ReceivingAccountService],
  exports: [ReceivingAccountService],
})
export class FinanceModule {}
