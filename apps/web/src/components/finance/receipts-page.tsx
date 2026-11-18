'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Banner, Button, Card, Input } from '@/components/ui'
import { api } from '@/lib/auth'
import { EMPTY_FILTERS, type FinanceFilters, type ReceiptList } from '@/lib/finance'
import { money } from '@/lib/tuition'

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted'
const TD = 'px-3 py-2 text-sm text-ink'
const FIELD = 'h-11 w-full rounded-sm border border-neutral-200 bg-surface px-2 text-sm text-ink'

export function ReceiptsPage() {
  const [filters, setFilters] = useState<FinanceFilters>(EMPTY_FILTERS)
  const [termCode, setTermCode] = useState('')
  const [channel, setChannel] = useState('')
  const [collectorId, setCollectorId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [list, setList] = useState<ReceiptList | null>(null)
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState('')

  useEffect(() => {
    void api<FinanceFilters>('/finance/filters')
      .then((data) => {
        setFilters(data)
        const receipt = new URLSearchParams(window.location.search).get('receipt')
        if (receipt) setHighlight(receipt)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({
      termCode,
      channel,
      collectorId,
      from,
      to,
    }))
      if (value && value !== 'all') params.set(key, value)
    const query = params.toString()
    void api<ReceiptList>(`/finance/receipts${query ? `?${query}` : ''}`)
      .then((data) => {
        setList(data)
        setError('')
      })
      .catch((cause: Error) => setError(cause.message))
  }, [termCode, channel, collectorId, from, to])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Phiếu thu</h1>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Học kỳ</span>
            <select
              aria-label="Lọc theo học kỳ"
              className={FIELD}
              value={termCode}
              onChange={(event) => setTermCode(event.target.value)}
            >
              <option value="">Tất cả</option>
              {filters.terms.map((term) => (
                <option key={term.code} value={term.code}>
                  {term.name} · {term.code}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Kênh thu</span>
            <select
              aria-label="Lọc theo kênh thu"
              className={FIELD}
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="COUNTER">Tại quầy</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Người thu</span>
            <select
              aria-label="Lọc theo người thu"
              className={FIELD}
              value={collectorId}
              onChange={(event) => setCollectorId(event.target.value)}
            >
              <option value="">Tất cả</option>
              {filters.collectors.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Từ ngày</span>
            <Input
              aria-label="Từ ngày"
              type="date"
              className="h-11"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Đến ngày</span>
            <Input
              aria-label="Đến ngày"
              type="date"
              className="h-11"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p data-testid="receipts-total" className="tabular text-sm font-semibold text-ink">
            Tổng tiền theo bộ lọc: {money(list?.totalAmount ?? 0)} · {list?.count ?? 0} phiếu
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setTermCode('')
              setChannel('')
              setCollectorId('')
              setFrom('')
              setTo('')
            }}
          >
            Xoá lọc
          </Button>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto rounded-md border border-line">
          <table data-testid="receipts-table" className="w-full min-w-[920px] border-collapse">
            <thead className="bg-neutral-50">
              <tr>
                {[
                  'Số phiếu',
                  'Ngày thu',
                  'MSSV',
                  'Họ tên',
                  'Học kỳ',
                  'Số tiền',
                  'Kênh',
                  'Người thu',
                ].map((header) => (
                  <th key={header} scope="col" className={TH}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list?.items.map((row) => (
                <tr
                  key={row.id}
                  data-testid={`receipt-row-${row.receiptNumber}`}
                  className={`border-t border-line ${highlight === row.receiptNumber ? 'bg-brand-50' : ''}`}
                >
                  <td className={`${TD} font-mono`}>
                    <Link
                      className="text-brand-700 underline"
                      href={`/staff/receipts?receipt=${encodeURIComponent(row.receiptNumber)}`}
                    >
                      {row.receiptNumber}
                    </Link>
                  </td>
                  <td className={`${TD} tabular whitespace-nowrap`}>
                    {new Intl.DateTimeFormat('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(row.paidAt))}
                  </td>
                  <td className={`${TD} font-mono`}>{row.studentCode}</td>
                  <td className={TD}>{row.fullName}</td>
                  <td className={TD}>{row.termCode}</td>
                  <td className={`${TD} tabular text-right font-semibold`}>{money(row.amount)}</td>
                  <td className={TD}>{row.channelLabel}</td>
                  <td className={TD}>{row.collector ?? '—'}</td>
                </tr>
              ))}
              {list?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`${TD} text-muted`}>
                    Không có phiếu thu nào khớp bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Mở phiếu để xem như bản in; bản in lại có dấu “Bản sao”. Không có nút huỷ phiếu thu.
        </p>
      </Card>
    </div>
  )
}
