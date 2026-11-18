import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { RegistrationIdempotency } from '../registration/idempotency'
import { counterPaymentInput } from './counter-payment.validation'
import { PaymentService } from './payment.service'

@Controller('counter')
@Roles(Role.FINANCE_OFFICE)
@UseGuards(CsrfGuard)
export class CounterController {
  constructor(
    private readonly payments: PaymentService,
    private readonly idempotency: RegistrationIdempotency,
  ) {}

  @Get('students/:studentCode')
  student(@Param('studentCode') studentCode: string) {
    return this.payments.studentForCounter(studentCode)
  }

  @Post('payments')
  @HttpCode(201)
  pay(@Body() body: unknown, @Req() req: AuthRequest, @Headers('idempotency-key') key?: string) {
    const input = counterPaymentInput(body)
    const collectorId = req.auth!.user.id
    return this.idempotency.run('payment', collectorId, key ?? '', () =>
      this.payments.pay({
        ...input,
        amount: BigInt(input.amount),
        collectedById: collectorId,
      }),
    )
  }

  @Get('receipts')
  shift(@Req() req: AuthRequest) {
    return this.payments.shiftReceipts(req.auth!.user.id)
  }
}
