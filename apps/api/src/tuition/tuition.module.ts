import { Module } from '@nestjs/common'

import { FinanceModule } from '../finance/finance.module'
import { PrismaModule } from '../prisma/prisma.module'
import { TERM_REGISTRATION_HOOK } from '../term-phases/term-phase.service'
import { TuitionController } from './tuition.controller'
import { TuitionRegistrationHook } from './tuition-registration.hook'
import { TuitionService } from './tuition.service'

@Module({
  imports: [PrismaModule, FinanceModule],
  controllers: [TuitionController],
  providers: [
    TuitionService,
    TuitionRegistrationHook,
    { provide: TERM_REGISTRATION_HOOK, useExisting: TuitionRegistrationHook },
  ],
  exports: [TuitionService, TERM_REGISTRATION_HOOK],
})
export class TuitionModule {}
