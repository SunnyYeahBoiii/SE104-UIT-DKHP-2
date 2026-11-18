import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { AcademicCatalogController } from './catalog.controller'
import { AcademicCatalogService } from './catalog.service'
import { StudentsController } from './students.controller'
import { StudentsService } from './students.service'

/** ADR-0007: students owns student profiles, priority groups and cohorts. */
@Module({
  imports: [AuthModule],
  controllers: [AcademicCatalogController, StudentsController],
  providers: [AcademicCatalogService, StudentsService],
})
export class StudentsModule {}
