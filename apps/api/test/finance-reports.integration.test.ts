import 'reflect-metadata'

// This suite owns Redis DB 15; the other suites use 2/7/9/14.
process.env.REDIS_URL = 'redis://localhost:6379/15'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import ExcelJS from 'exceljs'
import type { AddressInfo } from 'node:net'

import { AppModule } from '../src/app.module'
import { LedgerEntryType } from '../src/generated/prisma/enums'
import { PrismaService } from '../src/prisma/prisma.service'
import { bm7FromTotals, ledgerTotals } from '../src/tuition/tuition.service'

const PASSWORD = 'Dkhp@2026'

type Bm7Row = {
  studentCode: string
  grossAmount: number
  discountAmount: number
  netAmount: number
  paidAmount: number
  outstandingAmount: number
}
type Bm7Report = {
  rows: Bm7Row[]
  totals: { grossAmount: number; netAmount: number; outstandingAmount: number }
  term: { code: string }
}

describe('finance reports (integration: Postgres dkhp_w57, seeded data)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let cookie: string

  const send = (path: string) => fetch(`${baseUrl}${path}`, { headers: { cookie } })
  const json = async (path: string) => {
    const response = await send(path)
    expect(response.status).toBe(200)
    return response.json() as Promise<Record<string, unknown>>
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    await app.listen(0)
    const address = (app.getHttpServer() as { address(): AddressInfo | null }).address()
    baseUrl = `http://127.0.0.1:${address?.port ?? 3001}/api`
    prisma = app.get(PrismaService)

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'tv.lan', password: PASSWORD }),
    })
    expect(login.status).toBe(200)
    const session = (login.headers.get('set-cookie') ?? '')
      .split(/,\s*/)
      .find((part) => part.startsWith('dkhp_session='))!
      .split(';')[0]!
    cookie = session
  })

  afterAll(async () => {
    await app.close()
  })

  it('HP-09/HP-10: every BM7 figure equals the recomputed sum of the seeded ledger', async () => {
    const report = (await json('/finance/bm7?termCode=20262')) as unknown as Bm7Report
    const term = await prisma.term.findUniqueOrThrow({ where: { termCode: '20262' } })
    expect(report.rows.length).toBeGreaterThan(0)

    for (const row of report.rows) {
      const student = await prisma.student.findUniqueOrThrow({
        where: { studentCode: row.studentCode },
      })
      const entries = await prisma.ledgerEntry.findMany({
        where: { studentId: student.id, termId: term.id },
        select: { type: true, direction: true, amount: true },
      })
      expect(bm7FromTotals(ledgerTotals(entries))).toEqual({
        grossAmount: row.grossAmount,
        discountAmount: row.discountAmount,
        netAmount: row.netAmount,
        paidAmount: row.paidAmount,
        outstandingAmount: row.outstandingAmount,
      })
      expect(row.outstandingAmount).toBeGreaterThan(0)
      expect(row.netAmount).toBeLessThanOrEqual(row.grossAmount)
    }
    expect(report.totals.grossAmount).toBe(
      report.rows.reduce((sum, row) => sum + row.grossAmount, 0),
    )
    expect(report.totals.netAmount).toBe(report.rows.reduce((sum, row) => sum + row.netAmount, 0))
    expect(report.totals.outstandingAmount).toBe(
      report.rows.reduce((sum, row) => sum + row.outstandingAmount, 0),
    )
    const demo = report.rows.find((row) => row.studentCode === '24520009')!
    expect(demo.grossAmount).toBe(15_162_000)
    expect(demo.netAmount).toBe(15_162_000)
    expect(demo.outstandingAmount).toBe(15_081_000)
    expect(report.rows.find((row) => row.studentCode === '24520002')).toBeUndefined()
  })

  it('D.4.8: BM7 filters narrow the report by khoá, hệ and đối tượng ưu tiên', async () => {
    const all = (await json('/finance/bm7?termCode=20262')) as unknown as Bm7Report
    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { code: 'K19' } })
    const narrowed = (await json(
      `/finance/bm7?termCode=20262&cohortId=${cohort.id}`,
    )) as unknown as Bm7Report
    expect(narrowed.rows.length).toBeLessThan(all.rows.length)
    expect(narrowed.rows.every((row) => row.studentCode.startsWith('24520'))).toBe(true)

    const priority = await prisma.priorityGroup.findFirstOrThrow({
      where: { discountRate: 80 },
    })
    const discount = (await json(
      `/finance/bm7?termCode=20262&priorityGroupId=${priority.id}`,
    )) as unknown as Bm7Report
    expect(discount.rows).toHaveLength(0) // the 80% student has settled this term
    expect((await send('/finance/bm7?termCode=20262&cohortId=x')).status).toBe(400)
  })

  it('D.4.3: the ledger supports all 9 types, explains rows, groups recalculation and links receipts', async () => {
    const debt = (await json('/finance/students/24520013/debt?termCode=20262')) as {
      ledgerTypes: { type: string; label: string }[]
      selected: { ledger: { type: string; group: string | null; actor: string }[] }
      totalOutstanding: number
    }
    expect(debt.ledgerTypes).toHaveLength(9)
    expect(new Set(debt.ledgerTypes.map((item) => item.type))).toEqual(
      new Set(Object.values(LedgerEntryType)),
    )
    expect(debt.ledgerTypes.every((item) => item.label.length > 0)).toBe(true)
    expect(debt.totalOutstanding).toBeGreaterThan(0)
    const ledger = debt.selected.ledger
    expect(ledger.some((row) => row.type === LedgerEntryType.BASE_TUITION_REVERSAL)).toBe(true)
    expect(ledger.some((row) => row.group !== null)).toBe(true)
    expect(ledger.every((row) => row.actor.length > 0)).toBe(true)

    const paid = (await json('/finance/students/24520002/debt?termCode=20262')) as {
      selected: {
        ledger: {
          type: string
          receipt: {
            number: string
            bankTransactionId: number | null
            bankTransactionCode: string | null
          } | null
        }[]
      }
    }
    const payment = paid.selected.ledger.find((row) => row.type === LedgerEntryType.PAYMENT)!
    expect(payment.receipt?.number).toMatch(/^PT-20262-/)
    expect(payment.receipt?.bankTransactionId).toBeGreaterThan(0)

    // NFR-10: no write surface for the append-only ledger.
    expect([403, 404]).toContain(
      (await fetch(`${baseUrl}/finance/ledger`, { method: 'POST' })).status,
    )
  })

  it('D.4.6: receipts filter by term, channel, collector and date range and carry the filtered total', async () => {
    const all = (await json('/finance/receipts')) as {
      items: { amount: number }[]
      totalAmount: number
      count: number
    }
    expect(all.count).toBe(15)
    expect(all.totalAmount).toBe(all.items.reduce((sum, row) => sum + row.amount, 0))

    const bank = (await json('/finance/receipts?termCode=20262&channel=BANK_TRANSFER')) as {
      items: { channel: string; termCode: string; amount: number }[]
      totalAmount: number
    }
    expect(bank.items.length).toBeGreaterThan(0)
    expect(
      bank.items.every((row) => row.channel === 'BANK_TRANSFER' && row.termCode === '20262'),
    ).toBe(true)
    expect(bank.totalAmount).toBe(bank.items.reduce((sum, row) => sum + row.amount, 0))

    const cashier = await prisma.user.findUniqueOrThrow({ where: { username: 'tv.lan' } })
    const counter = (await json(`/finance/receipts?channel=COUNTER&collectorId=${cashier.id}`)) as {
      items: { channel: string; collector: string }[]
    }
    expect(counter.items.length).toBeGreaterThan(0)
    expect(
      counter.items.every((row) => row.channel === 'COUNTER' && row.collector === 'Ngô Thị Lan'),
    ).toBe(true)

    const day = (await json('/finance/receipts?from=2027-01-06&to=2027-01-06')) as {
      items: unknown[]
    }
    expect(day.items).toHaveLength(2)
  })

  it('D.4.1: overview stats, daily collections and todos match the ledger and receipts', async () => {
    const overview = (await json('/finance/overview?termCode=20262')) as {
      stats: {
        mustPay: number
        collected: number
        collectedByChannel: { counter: number; bankTransfer: number }
        remaining: number
        settledCount: number
        studentCount: number
        settledRatio: number
      }
      daily: { cumulative: number; total: number }[]
      todos: { key: string; count: number }[]
    }
    const term = await prisma.term.findUniqueOrThrow({ where: { termCode: '20262' } })
    const entries = await prisma.ledgerEntry.groupBy({
      by: ['studentId'],
      where: { termId: term.id },
    })
    let mustPay = 0
    let remaining = 0
    for (const group of entries) {
      const rows = await prisma.ledgerEntry.findMany({
        where: { termId: term.id, studentId: group.studentId },
        select: { type: true, direction: true, amount: true },
      })
      const bm7 = bm7FromTotals(ledgerTotals(rows))
      mustPay += bm7.netAmount
      remaining += bm7.outstandingAmount
    }
    expect(overview.stats.mustPay).toBe(mustPay)
    expect(overview.stats.remaining).toBe(remaining)
    expect(overview.stats.studentCount).toBe(entries.length)

    const receipts = await prisma.receipt.findMany({
      where: { termId: term.id },
      select: { amount: true },
    })
    expect(overview.stats.collected).toBe(
      receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0),
    )
    expect(overview.daily.at(-1)?.cumulative).toBe(overview.stats.collected)
    expect(overview.daily.reduce((sum, day) => sum + day.total, 0)).toBe(overview.stats.collected)

    const todos = new Map(overview.todos.map((todo) => [todo.key, todo.count]))
    expect(todos.get('unmatched')).toBe(2)
    expect(todos.get('fees')).toBe(1)
    expect(todos.has('overdue')).toBe(true)
    expect(todos.get('overdue')).toBeGreaterThanOrEqual(0)
  })

  it('NFR-12: the BM7 export is a real landscape xlsx with a repeating header and a total row', async () => {
    const response = await send('/finance/bm7/export?termCode=20262')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet')
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.subarray(0, 2).toString()).toBe('PK')

    const book = new ExcelJS.Workbook()
    await book.xlsx.load(bytes as never)
    const sheet = book.getWorksheet('BM7')!
    expect(sheet.pageSetup.orientation).toBe('landscape')
    expect(sheet.pageSetup.printTitlesRow).toBe('5:5')
    expect(sheet.getRow(5).getCell(3).value).toBe('Họ tên')
    const report = (await json('/finance/bm7?termCode=20262')) as unknown as Bm7Report
    expect(sheet.getRow(6 + report.rows.length).getCell(3).value).toBe('TỔNG')
    expect(sheet.getRow(6 + report.rows.length).getCell(9).value).toBe(
      report.totals.outstandingAmount,
    )
  })
})
