import { Controller, Get, HttpException, Param, UseGuards } from '@nestjs/common'

import { Roles } from '../auth/auth.guard'
import { CsrfGuard } from '../auth/csrf.guard'
import { Role } from '../generated/prisma/enums'
import { ReconciliationService } from './reconciliation.service'

/** TT-08: the finance office only reads reconciliation results; there is no action endpoint. */
@Controller('finance/reconciliation')
@Roles(Role.FINANCE_OFFICE)
@UseGuards(CsrfGuard)
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get()
  list() {
    return this.reconciliation.list()
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    const runId = Number(id)
    if (!Number.isSafeInteger(runId) || runId <= 0)
      throw new HttpException(
        { code: 'RECONCILIATION_NOT_FOUND', message: 'Không tìm thấy lần đối soát.' },
        404,
      )
    return this.reconciliation.detail(runId)
  }
}
