import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { PaymentService } from './payment.service'

@Controller('tuition/receipts')
@Roles(Role.STUDENT)
@UseGuards(CsrfGuard)
export class StudentReceiptController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.payments.receiptsFor(req.auth!.user.id)
  }

  @Get(':number')
  detail(@Req() req: AuthRequest, @Param('number') number: string) {
    return this.payments.receiptFor(req.auth!.user.id, number)
  }
}
