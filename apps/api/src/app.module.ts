import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core'

import { AcademicsModule } from './academics/academics.module'
import { AuthGuard } from './auth/auth.guard'
import { AuthModule } from './auth/auth.module'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { RequestIdMiddleware } from './common/request-id.middleware'
import { HealthController } from './health/health.controller'
import { PrismaModule } from './prisma/prisma.module'
import { StudentsModule } from './students/students.module'
import { TimetableModule } from './timetable/timetable.module'

@Module({
  imports: [PrismaModule, AuthModule, StudentsModule, AcademicsModule, TimetableModule],
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
