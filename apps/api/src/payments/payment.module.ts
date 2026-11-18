import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { RegistrationModule } from '../registration/registration.module'
import { TuitionModule } from '../tuition/tuition.module'
import { BankTransactionController } from './bank-transaction.controller'
import { BankTransactionService } from './bank-transaction.service'
import { CounterController } from './counter.controller'
import { PaymentService } from './payment.service'
import { StudentReceiptController } from './receipt.controller'

@Module({
  imports: [PrismaModule, TuitionModule, RegistrationModule],
  controllers: [BankTransactionController, CounterController, StudentReceiptController],
  providers: [PaymentService, BankTransactionService],
  exports: [PaymentService],
})
export class PaymentModule {}
