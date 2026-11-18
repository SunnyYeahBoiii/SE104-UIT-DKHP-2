import { HttpException, Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import { SEPAY_API_KEY_PARAMETER, sepayPayload, type SepayPayload } from './sepay.validation'

export const SEPAY_API_BASE_URL = 'https://api.sepay.vn'

/** SePay's list API expects local bank time, not UTC. */
export function sepayDateTime(moment: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(moment)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`
}

/** D1 of DFD 26: incoming transfers in the comparison window, normalized like a webhook payload. */
@Injectable()
export class SepayApiClient {
  constructor(private readonly prisma: PrismaService) {}

  async listTransactions(from: Date, to: Date): Promise<SepayPayload[]> {
    const parameter = await this.prisma.systemParameter.findUniqueOrThrow({
      where: { key: SEPAY_API_KEY_PARAMETER },
    })
    const apiKey = typeof parameter.value === 'string' ? parameter.value : ''
    const base = (process.env.SEPAY_API_BASE_URL ?? SEPAY_API_BASE_URL).replace(/\/$/, '')
    const url = new URL(`${base}/user/v1/transaction`)
    url.searchParams.set('startDate', sepayDateTime(from))
    url.searchParams.set('endDate', sepayDateTime(to))
    url.searchParams.set('transferType', 'in')

    const response = await fetch(url, {
      headers: { authorization: `Apikey ${apiKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok)
      throw new HttpException(
        { code: 'SEPAY_API_UNAVAILABLE', message: 'Không lấy được danh sách giao dịch SePay.' },
        502,
      )
    const body: unknown = await response.json()
    const rows = Array.isArray(body) ? body : (body as { transactions?: unknown[] }).transactions
    if (!Array.isArray(rows))
      throw new HttpException(
        { code: 'SEPAY_API_INVALID', message: 'Dữ liệu danh sách SePay không hợp lệ.' },
        502,
      )
    return rows.map((row) => sepayPayload(row))
  }
}
