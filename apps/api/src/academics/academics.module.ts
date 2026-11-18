import { Module } from '@nestjs/common'

import { AcademicsController } from './academics.controller'
import { AcademicsService } from './academics.service'
import { Clock } from './clock'

@Module({
  controllers: [AcademicsController],
  providers: [AcademicsService, Clock],
  exports: [AcademicsService],
})
export class AcademicsModule {}
