'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Banner, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import { EMPTY_FILTERS, type FinanceFilters, type FinanceOverview } from '@/lib/finance'
import { money } from '@/lib/tuition'

function StatCard({
  label,
  value,
  detail,
  testId,
}: {
  label: string
  value: string
  detail?: string
  testId?: string
}) {
  return (
    <div
      data-testid={testId ?? `stat-${label}`}
      className="rounded-md border border-line bg-surface p-4"
    >
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="tabular mt-1 text-2xl font-bold text-ink">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted">{detail}</div> : null}
    </div>
  )
}

/** D.4.1: how much has been collected, how much is left, and what needs attention. */
export function FinanceOverview() {
  const [filters, setFilters] = useState<FinanceFilters>(EMPTY_FILTERS)
  const [termCode, setTermCode] = useState('20262')
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api<FinanceFilters>('/finance/filters')
      .then(setFilters)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void api<FinanceOverview>(`/finance/overview?termCode=${termCode}`)
      .then((data) => {
        setOverview(data)
        setError('')
      })
      .catch((cause: Error) => setError(cause.message))
  }, [termCode])

  const stats = overview?.stats
  const daily = overview?.daily ?? []
  const target = Math.max(stats?.mustPay ?? 0, ...daily.map((day) => day.cumulative), 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Tổng quan thu học phí</h1>
        <label className="flex items-center gap-2 text-sm text-muted">
          Học kỳ
          <select
            aria-label="Chọn học kỳ tổng quan"
            value={termCode}
            onChange={(event) => setTermCode(event.target.value)}
            className="h-11 rounded-sm border border-neutral-200 bg-surface px-2 text-ink"
          >
            {filters.terms.map((term) => (
              <option key={term.code} value={term.code}>
                {term.name} · {term.code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {overview && stats ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Số tiền phải đóng" value={money(stats.mustPay)} />
            <StatCard
              label="Đã thu"
              value={money(stats.collected)}
              detail={`Chuyển khoản ${money(stats.collectedByChannel.bankTransfer)} · Tại quầy ${money(stats.collectedByChannel.counter)}`}
            />
            <StatCard label="Số tiền còn lại" value={money(stats.remaining)} />
            <StatCard
              label="Tỉ lệ đã đóng đủ"
              value={`${stats.settledRatio}%`}
              detail={`${stats.settledCount}/${stats.studentCount} sinh viên`}
            />
          </section>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                Tiền về theo ngày · {overview.term.name}
              </h2>
              <span className="tabular text-xs text-muted">Mục tiêu {money(stats.mustPay)}</span>
            </div>
            <div
              data-testid="finance-daily-chart"
              className="mt-4 flex h-48 items-end gap-1 border-b border-line"
            >
              {daily.map((day) => (
                <div
                  key={day.date}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${day.date}: ${money(day.total)}`}
                >
                  <div
                    className="w-full bg-brand-200"
                    style={{ height: `${(day.bankTransfer / target) * 100}%` }}
                  />
                  <div
                    className="w-full bg-brand-600"
                    style={{ height: `${(day.counter / target) * 100}%` }}
                  />
                </div>
              ))}
              {daily.length === 0 ? (
                <p className="pb-2 text-sm text-muted">Chưa có tiền về trong học kỳ này.</p>
              ) : null}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>{daily[0]?.date}</span>
              <span>{daily.at(-1)?.date}</span>
            </div>
            {daily.length > 0 ? (
              <svg
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                className="mt-3 h-16 w-full"
                aria-label="Đường luỹ kế so với số tiền phải đóng"
              >
                <line
                  x1="0"
                  x2="100"
                  y1={40 - (stats.mustPay / target) * 40}
                  y2={40 - (stats.mustPay / target) * 40}
                  stroke="#94a0b8"
                  strokeDasharray="2 2"
                  strokeWidth="0.5"
                />
                <polyline
                  fill="none"
                  stroke="#1a56e8"
                  strokeWidth="1"
                  points={daily
                    .map(
                      (day, index) =>
                        `${((index + 0.5) / daily.length) * 100},${40 - (day.cumulative / target) * 40}`,
                    )
                    .join(' ')}
                />
              </svg>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Việc cần xử lý</h2>
            <ul data-testid="finance-todos" className="space-y-3">
              {overview.todos.map((todo) => (
                <li key={todo.key} className="rounded-sm border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={todo.href}
                      className="text-sm font-semibold text-brand-600 underline"
                    >
                      {todo.title}
                    </Link>
                    <span className="tabular rounded-sm bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                      {todo.count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{todo.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Hạn đóng:{' '}
              {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(
                new Date(overview.term.tuitionDeadline),
              )}{' '}
              · Còn nợ {stats.overdueCount} sinh viên{' '}
              <Link
                className="text-brand-700 underline"
                href={`/staff/bm7?termCode=${overview.term.code}`}
              >
                xem BM7
              </Link>
            </p>
          </Card>
        </>
      ) : null}
    </div>
  )
}
