import { Module } from '@nestjs/common'

import { AcademicCatalogController } from './catalog.controller'
import { AcademicCatalogService } from './catalog.service'

/** ADR-0007: students owns student profiles, priority groups and cohorts. */
@Module({
  controllers: [AcademicCatalogController],
  providers: [AcademicCatalogService],
})
export class StudentsModule {}
