import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core'

import { AcademicsModule } from './academics/academics.module'
import { AuthGuard } from './auth/auth.guard'
import { AuthModule } from './auth/auth.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { RequestIdMiddleware } from './common/request-id.middleware'
import { FinanceModule } from './finance/finance.module'
import { HealthController } from './health/health.controller'
import { MonitoringModule } from './monitoring/monitoring.module'
import { PrismaModule } from './prisma/prisma.module'
import { RegistrationModule } from './registration/registration.module'
import { StudentsModule } from './students/students.module'
import { TimetableModule } from './timetable/timetable.module'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StudentsModule,
    RegistrationModule,
    AcademicsModule,
    TimetableModule,
    MonitoringModule,
    FinanceModule,
  ],
  controllers: [HealthController],
  providers: [
    Reflector,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
