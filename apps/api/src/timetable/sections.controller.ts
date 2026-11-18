import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common'

import type { Actor } from '../academics/academics.service'
import { Role } from '../generated/prisma/enums'
import { Roles, type AuthRequest } from '../auth/auth.guard'
import { SectionsService } from './sections.service'

@Roles(Role.ACADEMIC_OFFICE)
@Controller('timetable')
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

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

  /** Full edit model: offerings, sections, meetings, groups, options and inline clash warnings. */
  @Get(':code/editor')
  editor(@Param('code') code: string) {
    return this.sections.editor(code)
  }

  @Post(':code/sections')
  create(@Param('code') code: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.sections.create(code, body, this.actor(req))
  }

  @Patch(':code/sections/:id')
  update(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.sections.update(code, id, body, this.actor(req))
  }

  @Delete(':code/sections/:id')
  remove(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    return this.sections.remove(code, id, this.actor(req))
  }

  @Patch(':code/offered-courses/:id/credits')
  credits(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.sections.updateCredits(code, id, body, this.actor(req))
  }
}
