import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { TuitionService } from './tuition.service'

@Controller('tuition')
@Roles(Role.STUDENT)
@UseGuards(CsrfGuard)
export class TuitionController {
  constructor(private readonly tuition: TuitionService) {}

  @Get()
  overview(@Req() req: AuthRequest, @Query('termCode') termCode?: string) {
    return this.tuition.overview(req.auth!.user.id, termCode)
  }
}
