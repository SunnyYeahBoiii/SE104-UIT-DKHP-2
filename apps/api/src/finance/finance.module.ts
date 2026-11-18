import { Module } from '@nestjs/common'

import { Clock } from '../academics/clock'
import { PrismaModule } from '../prisma/prisma.module'
import { FinanceController } from './finance.controller'
import { FinanceReportController } from './finance-report.controller'
import { FinanceReportService } from './finance-report.service'
import { FinanceService } from './finance.service'
import { ReceivingAccountService } from './receiving-account.service'

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController, FinanceReportController],
  providers: [Clock, FinanceService, FinanceReportService, ReceivingAccountService],
  exports: [ReceivingAccountService],
})
export class FinanceModule {}
