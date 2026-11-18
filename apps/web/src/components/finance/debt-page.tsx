'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Banner, Button, Card, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/auth'
import { groupDebtLedger, longDate, type DebtOverview } from '@/lib/finance'
import { money, signedMoney } from '@/lib/tuition'

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted'
const TD = 'px-3 py-2 text-sm text-ink'

export function DebtPage() {
  const [query, setQuery] = useState('')
  const [termCode, setTermCode] = useState('')
  const [debt, setDebt] = useState<DebtOverview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = (code: string, term?: string) => {
    if (!/^\d{8}$/.test(code)) {
      setError('Nhập mã số sinh viên gồm 8 chữ số.')
      return
    }
    setLoading(true)
    void api<DebtOverview>(`/finance/students/${code}/debt${term ? `?termCode=${term}` : ''}`)
      .then((data) => {
        setDebt(data)
        setTermCode(data.selected?.code ?? '')
        setError('')
      })
      .catch((cause: Error) => {
        setDebt(null)
        setError(cause instanceof ApiError ? cause.message : 'Không tải được công nợ.')
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Công nợ sinh viên</h1>
      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            load(query.trim())
          }}
        >
          <label className="min-w-56 flex-1 space-y-1">
            <span className="block text-sm font-medium text-ink">Mã số sinh viên</span>
            <Input
              aria-label="Mã số sinh viên"
              inputMode="numeric"
              placeholder="Ví dụ 24520009"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button type="submit" loading={loading}>
            Xem công nợ
          </Button>
        </form>
      </Card>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {debt ? (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {debt.student.fullName} · {debt.student.studentCode}
                </h2>
                <p className="text-sm text-muted">
                  Khoá {debt.student.cohortCode} · Hệ {debt.student.trainingSystemCode}
                  {debt.student.priority
                    ? ` · ${debt.student.priority.name} (giảm ${debt.student.priority.rate}%)`
                    : ''}
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs text-muted">Tổng còn nợ mọi học kỳ</p>
                  <p data-testid="debt-total" className="tabular text-xl font-bold text-ink">
                    {money(debt.totalOutstanding)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Số dư có</p>
                  <p data-testid="debt-credit" className="tabular text-xl font-bold text-brand-700">
                    {money(debt.creditBalance)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted">
                Học kỳ
                <select
                  aria-label="Học kỳ công nợ"
                  value={termCode}
                  onChange={(event) => {
                    setTermCode(event.target.value)
                    load(debt.student.studentCode, event.target.value)
                  }}
                  className="h-11 rounded-sm border border-neutral-200 bg-surface px-2 text-ink"
                >
                  {debt.terms.map((term) => (
                    <option key={term.code} value={term.code}>
                      {term.name} · {term.code} ({money(term.outstandingAmount)})
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-muted">Trạng thái học kỳ: {debt.selected?.phase}</span>
            </div>
          </Card>

          {debt.selected ? (
            <>
              <Card>
                <h2 className="mb-3 text-lg font-semibold text-ink">Tóm tắt BM7 theo học kỳ</h2>
                <dl data-testid="debt-bm7" className="grid gap-3 sm:grid-cols-4">
                  {[
                    ['Số tiền đăng ký', debt.selected.bm7.grossAmount],
                    ['Số tiền phải đóng', debt.selected.bm7.netAmount],
                    ['Đã thanh toán', debt.selected.bm7.paidAmount],
                    ['Số tiền còn lại', debt.selected.bm7.outstandingAmount],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-sm border border-line p-3">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="tabular mt-1 text-lg font-bold text-ink">
                        {money(Number(value))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-ink">Sổ cái công nợ</h2>
                <p className="mt-1 text-xs text-muted">{debt.note}</p>
                <div data-testid="debt-ledger-types" className="mt-3 flex flex-wrap gap-2">
                  {debt.ledgerTypes.map((item) => (
                    <span
                      key={item.type}
                      className="rounded-sm border border-line px-2 py-1 text-xs text-muted"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 overflow-x-auto rounded-md border border-line">
                  <table data-testid="debt-ledger" className="w-full min-w-[980px] border-collapse">
                    <thead className="bg-neutral-50">
                      <tr>
                        {[
                          'Thời điểm',
                          'Loại dòng',
                          'Diễn giải',
                          'Ghi nợ',
                          'Ghi có',
                          'Số dư luỹ kế',
                          'Người tạo',
                          'Liên quan',
                        ].map((header) => (
                          <th key={header} scope="col" className={TH}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {groupDebtLedger(debt.selected.ledger).map((group, index) => (
                      <tbody key={group.title ?? index}>
                        {group.title ? (
                          <tr className="bg-brand-50">
                            <th
                              scope="colgroup"
                              colSpan={8}
                              className="px-3 py-2 text-left text-xs font-semibold text-brand-800"
                            >
                              {group.title}
                            </th>
                          </tr>
                        ) : null}
                        {group.rows.map((row) => (
                          <tr
                            key={row.id}
                            data-testid={`ledger-row-${row.id}`}
                            className="border-t border-line"
                          >
                            <td className={`${TD} tabular whitespace-nowrap`}>
                              {longDate(row.at)}
                            </td>
                            <td className={TD}>{row.typeLabel}</td>
                            <td className={TD}>
                              <span>{row.description}</span>
                              {row.detail ? (
                                <span className="block text-xs text-muted">{row.detail}</span>
                              ) : null}
                            </td>
                            <td className={`${TD} tabular text-right`}>
                              {row.debit ? money(row.debit) : '—'}
                            </td>
                            <td className={`${TD} tabular text-right`}>
                              {row.credit ? money(row.credit) : '—'}
                            </td>
                            <td className={`${TD} tabular text-right font-semibold`}>
                              {signedMoney(row.balance)}
                            </td>
                            <td className={TD}>{row.actor}</td>
                            <td className={TD}>
                              {row.receipt ? (
                                <Link
                                  className="text-brand-700 underline"
                                  href={`/staff/receipts?receipt=${encodeURIComponent(row.receipt.number)}`}
                                >
                                  {row.receipt.number}
                                </Link>
                              ) : null}
                              {row.receipt?.bankTransactionId ? (
                                <Link
                                  className="ml-2 text-brand-700 underline"
                                  href={`/staff/bank?transaction=${row.receipt.bankTransactionId}`}
                                >
                                  Giao dịch{' '}
                                  {row.receipt.bankTransactionCode ?? row.receipt.bankTransactionId}
                                </Link>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Không có thao tác sửa, xoá hay tạo dòng sổ cái.
                </p>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
