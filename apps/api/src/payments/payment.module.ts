import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { RegistrationModule } from '../registration/registration.module'
import { TuitionModule } from '../tuition/tuition.module'
import { CounterController } from './counter.controller'
import { PaymentService } from './payment.service'
import { StudentReceiptController } from './receipt.controller'

@Module({
  imports: [PrismaModule, TuitionModule, RegistrationModule],
  controllers: [CounterController, StudentReceiptController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
