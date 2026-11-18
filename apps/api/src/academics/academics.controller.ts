import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common'

import { Role } from '../generated/prisma/enums'
import { Roles, type AuthRequest } from '../auth/auth.guard'
import { AcademicsService, type Actor } from './academics.service'

@Roles(Role.ACADEMIC_OFFICE)
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academics: AcademicsService) {}

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

  private slotId(value: string): number {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0)
      throw new HttpException(
        { code: 'INVALID_REQUEST', message: 'Mã khung giờ không hợp lệ.' },
        400,
      )
    return id
  }

  @Get('terms')
  list() {
    return this.academics.list()
  }

  @Post('terms/:code/milestones/preview')
  preview(@Param('code') code: string, @Body() body: unknown) {
    return this.academics.previewMilestones(code, body)
  }

  @Patch('terms/:code/milestones')
  updateMilestones(@Param('code') code: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.academics.updateMilestones(code, body, this.actor(req))
  }

  @Put('credit-limits')
  updateCreditLimits(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.academics.updateCreditLimits(body, this.actor(req))
  }

  @Post('terms/:code/slots')
  createSlot(@Param('code') code: string, @Body() body: unknown, @Req() req: AuthRequest) {
    return this.academics.createSlot(code, body, this.actor(req))
  }

  @Patch('terms/:code/slots/:slotId')
  updateSlot(
    @Param('code') code: string,
    @Param('slotId') slotId: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.academics.updateSlot(code, this.slotId(slotId), body, this.actor(req))
  }

  @Delete('terms/:code/slots/:slotId')
  deleteSlot(
    @Param('code') code: string,
    @Param('slotId') slotId: string,
    @Req() req: AuthRequest,
  ) {
    return this.academics.deleteSlot(code, this.slotId(slotId), this.actor(req))
  }
}
