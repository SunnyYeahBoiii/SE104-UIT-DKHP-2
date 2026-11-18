import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { assignInput, ignoreReasonInput } from './bank-transaction.validation'
import { BankTransactionService, type TransactionActor } from './bank-transaction.service'

@Controller('bank-transactions')
@Roles(Role.FINANCE_OFFICE)
@UseGuards(CsrfGuard)
export class BankTransactionController {
  constructor(private readonly transactions: BankTransactionService) {}

  private actor(req: AuthRequest): TransactionActor {
    return { actorId: req.auth!.user.id, requestId: req.requestId }
  }

  @Get()
  list(@Query('status') status = 'UNMATCHED') {
    return this.transactions.list(status)
  }

  @Get('count')
  count() {
    return this.transactions.count()
  }

  @Get('students')
  students(@Query('q') q = '') {
    return this.transactions.students(q)
  }

  @Get('terms')
  terms() {
    return this.transactions.terms()
  }

  @Get(':id/preview')
  preview(
    @Param('id', ParseIntPipe) id: number,
    @Query('studentCode') studentCode: string,
    @Query('termCode') termCode: string,
  ) {
    return this.transactions.preview(id, studentCode ?? '', termCode ?? '')
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.transactions.detail(id)
  }

  @Post(':id/assign')
  assign(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.transactions.assign(id, assignInput(body), this.actor(req))
  }

  @Post(':id/ignore')
  ignore(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.transactions.ignore(id, ignoreReasonInput(body), this.actor(req))
  }
}
