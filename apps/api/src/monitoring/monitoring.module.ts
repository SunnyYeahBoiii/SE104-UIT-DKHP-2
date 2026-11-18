import { Module } from '@nestjs/common'

import { Clock } from '../academics/clock'
import { MonitoringController } from './monitoring.controller'
import { MonitoringService } from './monitoring.service'

@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, Clock],
})
export class MonitoringModule {}
