import { Module } from '@nestjs/common'

import { SectionsController } from './sections.controller'
import { SectionsService } from './sections.service'
import { TimetableController } from './timetable.controller'
import { TimetableService } from './timetable.service'

@Module({
  controllers: [TimetableController, SectionsController],
  providers: [TimetableService, SectionsService],
})
export class TimetableModule {}
