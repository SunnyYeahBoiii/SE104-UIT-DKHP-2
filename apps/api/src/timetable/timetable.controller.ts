import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'

import type { Actor } from '../academics/academics.service'
import { Role } from '../generated/prisma/enums'
import { Roles, type AuthRequest } from '../auth/auth.guard'
import { TimetableService } from './timetable.service'

@Roles(Role.ACADEMIC_OFFICE)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  private actor(req: AuthRequest): Actor {
    const forwarded = req.headers['x-forwarded-for']
    return {
      userId: req.auth!.user.id,
      requestId: req.requestId,
      ip:
        (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
        req.headers['x-real-ip']?.toString() ||
        'unknown',
    }
  }

  @Get(':code')
  overview(@Param('code') code: string) {
    return this.timetable.overview(code)
  }

  @Post(':code/preview')
  preview(@Param('code') code: string, @Body() body: unknown) {
    return this.timetable.preview(code, body)
  }

  @Post(':code/import')
  import(@Param('code') code: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.timetable.import(code, body, this.actor(req))
  }
}
