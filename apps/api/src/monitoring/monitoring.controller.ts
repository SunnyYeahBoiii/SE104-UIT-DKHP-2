import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common'

import type { Actor } from '../academics/academics.service'
import { Role } from '../generated/prisma/enums'
import { Roles, type AuthRequest } from '../auth/auth.guard'
import { MonitoringService } from './monitoring.service'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

@Roles(Role.ACADEMIC_OFFICE)
@Controller('monitor')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

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

  private includeCancelled(value: string | undefined): boolean {
    return value === 'true' || value === '1'
  }

  @Get('overview')
  overview() {
    return this.monitoring.overview()
  }

  @Get(':code/sections')
  sections(@Param('code') code: string) {
    return this.monitoring.sections(code)
  }

  @Patch(':code/sections/:id/capacity')
  capacity(
    @Param('code') code: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.monitoring.setCapacity(code, id, body, this.actor(req))
  }

  @Get(':code/roster/:sectionCode')
  roster(
    @Param('code') code: string,
    @Param('sectionCode') sectionCode: string,
    @Query('includeCancelled') include?: string,
  ) {
    return this.monitoring.roster(code, sectionCode, this.includeCancelled(include))
  }

  @Get(':code/roster/:sectionCode/export')
  async rosterExcel(
    @Param('code') code: string,
    @Param('sectionCode') sectionCode: string,
    @Query('includeCancelled') include?: string,
  ) {
    const buffer = await this.monitoring.rosterExcel(
      code,
      sectionCode,
      this.includeCancelled(include),
    )
    return new StreamableFile(buffer, {
      type: XLSX_TYPE,
      disposition: `attachment; filename="BB01_${sectionCode}.xlsx"`,
    })
  }

  @Get(':code/under-credits')
  underCredits(@Param('code') code: string) {
    return this.monitoring.underCredits(code)
  }

  @Get(':code/under-credits/export')
  async underCreditsExcel(@Param('code') code: string) {
    const buffer = await this.monitoring.underCreditsExcel(code)
    return new StreamableFile(buffer, {
      type: XLSX_TYPE,
      disposition: `attachment; filename="duoi-tin-chi-toi-thieu_${code}.xlsx"`,
    })
  }
}
