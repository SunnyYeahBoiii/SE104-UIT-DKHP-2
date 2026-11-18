import { Module } from '@nestjs/common'

import { RegistrationController } from './registration.controller'
import { RegistrationClock, RegistrationService } from './registration.service'
import { RegistrationIdempotency } from './idempotency'

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService, RegistrationClock, RegistrationIdempotency],
})
export class RegistrationModule {}
