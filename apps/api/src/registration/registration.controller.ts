import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { Role } from '../generated/prisma/enums'
import { RegistrationService } from './registration.service'
import { registerInput, sectionFilters, timetableScope } from './validation'

@Controller('registration')
@Roles(Role.STUDENT)
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Get()
  overview(@Req() req: AuthRequest, @Query() query: Record<string, unknown>) {
    return this.registration.overview(req.auth!.user.id, sectionFilters(query))
  }

  /** B.4.3: student's own weekly timetable, for the term in progress or the one being registered. */
  @Get('timetable')
  timetable(@Req() req: AuthRequest, @Query('scope') scope: unknown) {
    return this.registration.timetable(req.auth!.user.id, timetableScope(scope))
  }

  @Post('requests')
  @HttpCode(201)
  register(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.registration.register(req.auth!.user.id, key ?? '', registerInput(body))
  }

  /** DK-13: there is deliberately no change-section route; cancel then register again. */
  @Post('enrollments/:id/cancel')
  @HttpCode(200)
  cancel(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) enrollmentId: number,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.registration.cancel(req.auth!.user.id, key ?? '', enrollmentId)
  }
}
