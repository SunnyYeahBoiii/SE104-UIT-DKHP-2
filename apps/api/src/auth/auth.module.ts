import { Module } from '@nestjs/common'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { Argon2PasswordHasher, PasswordHasher } from './password.hasher'
import { LoginRateLimiter } from './login-rate-limiter'
import { SessionStore } from './session.store'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    SessionStore,
    LoginRateLimiter,
  ],
  exports: [SessionStore, PasswordHasher],
})
export class AuthModule {}
