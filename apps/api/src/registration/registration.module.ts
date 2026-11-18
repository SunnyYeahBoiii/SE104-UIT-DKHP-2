import { Module } from '@nestjs/common'

import { TuitionModule } from '../tuition/tuition.module'
import { RegistrationController } from './registration.controller'
import { RegistrationClock, RegistrationService } from './registration.service'
import { RegistrationIdempotency } from './idempotency'

@Module({
  imports: [TuitionModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, RegistrationClock, RegistrationIdempotency],
})
export class RegistrationModule {}
