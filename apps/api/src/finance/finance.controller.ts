import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'

import { Roles } from '../auth/auth.guard'
import type { AuthRequest } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { FinanceService } from './finance.service'

@Controller('finance')
@Roles(Role.FINANCE_OFFICE)
@UseGuards(CsrfGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('settings')
  list() {
    return this.finance.list()
  }

  @Patch('settings/credit-rates')
  @HttpCode(200)
  updateCreditRates(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.finance.updateDefaultRates(body, this.finance.actor(req))
  }

  @Post('fee-schedules')
  @HttpCode(201)
  createFeeSchedule(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.finance.saveFeeSchedule(body, undefined, this.finance.actor(req))
  }

  @Patch('fee-schedules/:id')
  @HttpCode(200)
  updateFeeSchedule(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.finance.saveFeeSchedule(body, Number(id), this.finance.actor(req))
  }

  @Patch('receiving-account')
  @HttpCode(200)
  updateReceivingAccount(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.finance.updateReceivingAccount(body, this.finance.actor(req))
  }
}
