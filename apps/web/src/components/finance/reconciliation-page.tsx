'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Banner, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import {
  displayDay,
  reconciliationNote,
  type ReconciliationList,
  type ReconciliationRunDetail,
  type ReconciliationRunSummary,
} from '@/lib/reconciliation'
import { money } from '@/lib/tuition'

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted'
const TD = 'px-3 py-2 text-sm text-ink'

function StatusChip({ row }: { row: ReconciliationRunSummary }) {
  const tone =
    row.status === 'MATCHED'
      ? 'border-success-600/30 bg-success-50 text-success-700'
      : 'border-warning-600/30 bg-warning-50 text-warning-700'
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tone}`}>
      {row.statusLabel}
    </span>
  )
}

export function ReconciliationPage() {
  const [list, setList] = useState<ReconciliationList | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api<ReconciliationList>('/finance/reconciliation')
      .then((data) => {
        setList(data)
        setError('')
      })
      .catch((cause: Error) => setError(cause.message))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Đối soát</h1>
      <Banner tone="info">{reconciliationNote}</Banner>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card>
        <div className="overflow-x-auto rounded-md border border-line">
          <table
            data-testid="reconciliation-runs-table"
            className="w-full min-w-[800px] border-collapse"
          >
            <thead className="bg-neutral-50">
              <tr>
                {[
                  'Ngày',
                  'Giao dịch ngân hàng',
                  'Giao dịch hệ thống',
                  'Đã tự ghi bù',
                  'Lệch còn lại',
                  'Trạng thái',
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
                  data-testid={`reconciliation-run-${row.id}`}
                  className="border-t border-line"
                >
                  <td className={`${TD} font-mono`}>
                    <Link
                      className="text-brand-700 underline"
                      href={`/staff/reconciliation/${row.id}`}
                    >
                      {displayDay(row.date)}
                    </Link>
                  </td>
                  <td className={`${TD} tabular text-right`}>{row.bankCount}</td>
                  <td className={`${TD} tabular text-right`}>{row.systemCount}</td>
                  <td className={`${TD} tabular text-right`}>{row.backfilledCount}</td>
                  <td className={`${TD} tabular text-right`}>{row.residualCount}</td>
                  <td className={TD}>
                    <StatusChip row={row} />
                  </td>
                </tr>
              ))}
              {list?.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${TD} text-muted`}>
                    Chưa có lần đối soát nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Chỉ xem. Chỗ lệch còn lại được xử lý ngoài hệ thống.
        </p>
      </Card>
    </div>
  )
}

export function ReconciliationDetail({ id }: { id: number }) {
  const [run, setRun] = useState<ReconciliationRunDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api<ReconciliationRunDetail>(`/finance/reconciliation/${id}`)
      .then((data) => {
        setRun(data)
        setError('')
      })
      .catch((cause: Error) => setError(cause.message))
  }, [id])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">
          Chi tiết đối soát {run ? displayDay(run.date) : ''}
        </h1>
        <Link className="text-sm text-brand-700 underline" href="/staff/reconciliation">
          ← Danh sách lần đối soát
        </Link>
      </div>
      <Banner tone="info">{reconciliationNote}</Banner>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {run ? (
        <>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['Ngân hàng', String(run.bankCount)],
                ['Hệ thống', String(run.systemCount)],
                ['Tự ghi bù', String(run.backfilledCount)],
                ['Lệch còn lại', String(run.residualCount)],
                ['Trạng thái', run.statusLabel],
              ].map(([label, value]) => (
                <div key={label} className="rounded-sm border border-line p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p
                    data-testid={`reconciliation-stat-${label}`}
                    className="tabular text-lg font-semibold text-ink"
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Đã tự ghi bù</h2>
            <div className="overflow-x-auto rounded-md border border-line">
              <table
                data-testid="reconciliation-backfilled"
                className="w-full min-w-[760px] border-collapse"
              >
                <thead className="bg-neutral-50">
                  <tr>
                    {['Mã giao dịch', 'MSSV', 'Họ tên', 'Số tiền', 'Phiếu thu'].map((header) => (
                      <th key={header} scope="col" className={TH}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.backfilled.map((row) => (
                    <tr key={row.transactionId} className="border-t border-line">
                      <td className={`${TD} font-mono`}>{row.sepayId}</td>
                      <td className={`${TD} font-mono`}>{row.studentCode ?? '—'}</td>
                      <td className={TD}>{row.studentName ?? '—'}</td>
                      <td className={`${TD} tabular text-right`}>{money(row.amount)}</td>
                      <td className={TD}>
                        {row.receiptNumber ? (
                          <Link
                            className="text-brand-700 underline"
                            href={`/staff/receipts?receipt=${encodeURIComponent(row.receiptNumber)}`}
                          >
                            {row.receiptNumber}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {run.backfilled.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`${TD} text-muted`}>
                        Không có giao dịch nào được tự ghi bù trong lần này.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Lệch còn lại</h2>
            <div className="overflow-x-auto rounded-md border border-line">
              <table
                data-testid="reconciliation-discrepancies"
                className="w-full min-w-[760px] border-collapse"
              >
                <thead className="bg-neutral-50">
                  <tr>
                    {['Loại lệch', 'Mã giao dịch', 'Ngân hàng', 'Hệ thống', 'Diễn giải'].map(
                      (header) => (
                        <th key={header} scope="col" className={TH}>
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {run.discrepancies.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className={TD}>{row.typeLabel}</td>
                      <td className={`${TD} font-mono`}>{row.sepayId ?? '—'}</td>
                      <td className={`${TD} tabular text-right`}>
                        {row.bankAmount === null ? '—' : money(row.bankAmount)}
                      </td>
                      <td className={`${TD} tabular text-right`}>
                        {row.systemAmount === null ? '—' : money(row.systemAmount)}
                      </td>
                      <td className={TD}>{row.detail ?? '—'}</td>
                    </tr>
                  ))}
                  {run.discrepancies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={`${TD} text-muted`}>
                        Không còn chỗ lệch nào.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Chỉ đọc; không có nút thao tác. Sai sót được xử lý ngoài hệ thống.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  )
}
