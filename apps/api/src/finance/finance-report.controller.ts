import { Controller, Get, Param, Query, Req, StreamableFile, UseGuards } from '@nestjs/common'

import { Roles, type AuthRequest } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { bm7Excel } from './finance-excel'
import { FinanceReportService } from './finance-report.service'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Bm7Query = {
  termCode?: string
  cohortId?: string
  trainingSystemId?: string
  priorityGroupId?: string
}

@Controller('finance')
@Roles(Role.FINANCE_OFFICE)
@UseGuards(CsrfGuard)
export class FinanceReportController {
  constructor(private readonly reports: FinanceReportService) {}

  @Get('filters')
  filters() {
    return this.reports.filters()
  }

  @Get('overview')
  overview(@Query('termCode') termCode?: string) {
    return this.reports.overview(termCode)
  }

  @Get('receipts')
  receipts(@Query() query: Record<string, string | undefined>) {
    return this.reports.receipts(query)
  }

  @Get('bm7/export')
  async bm7Excel(@Query() query: Bm7Query, @Req() req: AuthRequest) {
    const report = await this.reports.bm7(query, req.auth!.user.fullName)
    return new StreamableFile(await bm7Excel(report), {
      type: XLSX_TYPE,
      disposition: `attachment; filename="BM7_${report.term.code}.xlsx"`,
    })
  }

  @Get('bm7')
  bm7(@Query() query: Bm7Query, @Req() req: AuthRequest) {
    return this.reports.bm7(query, req.auth!.user.fullName)
  }

  @Get('students/:code/debt')
  debt(@Param('code') code: string, @Query('termCode') termCode?: string) {
    return this.reports.debt(code, termCode)
  }
}
