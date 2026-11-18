import { Body, Controller, Get, HttpCode, Param, Patch, Post, Delete, Req } from '@nestjs/common'

import { Roles } from '../auth/auth.guard'
import type { AuthRequest } from '../auth/auth.guard'
import { Role } from '../generated/prisma/enums'
import { AcademicCatalogService } from './catalog.service'
import { cohortInput, priorityGroupInput } from './catalog.validation'

@Controller('academic-catalog')
@Roles(Role.ACADEMIC_OFFICE)
export class AcademicCatalogController {
  constructor(private readonly catalog: AcademicCatalogService) {}

  @Get()
  list() {
    return this.catalog.list()
  }

  @Post('priority-groups')
  @HttpCode(201)
  createPriorityGroup(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.catalog.createPriorityGroup(priorityGroupInput(body), this.catalog.actor(req))
  }

  @Patch('priority-groups/:id')
  updatePriorityGroup(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.catalog.updatePriorityGroup(
      Number(id),
      priorityGroupInput(body),
      this.catalog.actor(req),
    )
  }

  @Delete('priority-groups/:id')
  @HttpCode(200)
  deletePriorityGroup(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.catalog.deletePriorityGroup(Number(id), this.catalog.actor(req))
  }

  @Post('cohorts')
  @HttpCode(201)
  createCohort(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.catalog.createCohort(cohortInput(body), this.catalog.actor(req))
  }

  @Patch('cohorts/:id')
  updateCohort(@Param('id') id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.catalog.updateCohort(Number(id), cohortInput(body), this.catalog.actor(req))
  }

  @Delete('cohorts/:id')
  @HttpCode(200)
  deleteCohort(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.catalog.deleteCohort(Number(id), this.catalog.actor(req))
  }
}
