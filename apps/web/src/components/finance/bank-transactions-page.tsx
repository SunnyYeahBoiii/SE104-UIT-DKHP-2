'use client'

import { ChevronRight, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Banner, Button, Card, Field, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/auth'
import {
  mergeSuggestions,
  STATUS_CLASS,
  STATUS_LABEL,
  type DebtPreview,
  type StudentOption,
  type TermOption,
  type TransactionDetail,
  type TransactionList,
} from '@/lib/bank-transactions'
import { dateTime, money, type PaymentResult } from '@/lib/receipt'

type Tab = 'UNMATCHED' | 'ALL' | 'IGNORED'

const TABS: { key: Tab; label: string; testId: string }[] = [
  { key: 'UNMATCHED', label: 'Chưa khớp', testId: 'tx-tab-unmatched' },
  { key: 'ALL', label: 'Tất cả', testId: 'tx-tab-all' },
  { key: 'IGNORED', label: 'Bỏ qua', testId: 'tx-tab-ignored' },
]

export function BankTransactionsPage() {
  const [tab, setTab] = useState<Tab>('UNMATCHED')
  const [list, setList] = useState<TransactionList>({ items: [], unmatchedCount: 0 })
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [terms, setTerms] = useState<TermOption[]>([])
  const [codeOptions, setCodeOptions] = useState<StudentOption[]>([])
  const [query, setQuery] = useState('')
  const [queryOptions, setQueryOptions] = useState<StudentOption[]>([])
  const [student, setStudent] = useState<StudentOption | null>(null)
  const [termCode, setTermCode] = useState('')
  const [preview, setPreview] = useState<DebtPreview | null>(null)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const fetchList = useCallback(
    () => api<TransactionList>(`/bank-transactions?status=${tab}`),
    [tab],
  )

  useEffect(() => {
    void fetchList()
      .then(setList)
      .catch((cause: unknown) =>
        setError(cause instanceof ApiError ? cause.message : 'Không tải được danh sách giao dịch.'),
      )
    void api<TermOption[]>('/bank-transactions/terms')
      .then(setTerms)
      .catch(() => undefined)
  }, [fetchList])

  useEffect(() => {
    if (!detail) return
    void Promise.all(
      detail.suggestedStudentCodes.map((code) =>
        api<StudentOption[]>(`/bank-transactions/students?q=${encodeURIComponent(code)}`).catch(
          () => [],
        ),
      ),
    ).then((groups) => setCodeOptions(groups.flat()))
  }, [detail])

  useEffect(() => {
    if (!query.trim()) return
    let active = true
    const timer = window.setTimeout(() => {
      void api<StudentOption[]>(`/bank-transactions/students?q=${encodeURIComponent(query)}`)
        .then((options) => {
          if (active) setQueryOptions(options)
        })
        .catch(() => undefined)
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (!detail || !student || !termCode) return
    let active = true
    void api<DebtPreview>(
      `/bank-transactions/${detail.id}/preview?studentCode=${encodeURIComponent(student.studentCode)}&termCode=${encodeURIComponent(termCode)}`,
    )
      .then((value) => {
        if (active) setPreview(value)
      })
      .catch(() => {
        if (active) setPreview(null)
      })
    return () => {
      active = false
    }
  }, [detail, student, termCode])

  const suggestions = useMemo(
    () =>
      mergeSuggestions(detail?.suggestedStudentCodes ?? [], query, [
        ...codeOptions,
        ...(query.trim() ? queryOptions : []),
      ]),
    [detail, query, codeOptions, queryOptions],
  )

  const open = async (id: number) => {
    setError('')
    setQuery('')
    setStudent(null)
    setPreview(null)
    setResult(null)
    setReason('')
    setConfirming(false)
    setTermCode('')
    try {
      setDetail(await api<TransactionDetail>(`/bank-transactions/${id}`))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không tải được chi tiết giao dịch.')
    }
  }

  const refresh = useCallback(async () => {
    setList(await fetchList())
    window.dispatchEvent(new Event('dkhp:transactions-changed'))
  }, [fetchList])

  const assign = async () => {
    if (!detail || !student || !termCode || busy) return
    setBusy(true)
    setError('')
    try {
      const payment = await api<PaymentResult>(`/bank-transactions/${detail.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ studentCode: student.studentCode, termCode }),
      })
      setResult(payment)
      setConfirming(false)
      const updated = await api<TransactionDetail>(`/bank-transactions/${detail.id}`)
      setDetail(updated)
      await refresh()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không gán được giao dịch.')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  const ignore = async () => {
    if (!detail || !reason.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/bank-transactions/${detail.id}/ignore`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      })
      setDetail(await api<TransactionDetail>(`/bank-transactions/${detail.id}`))
      await refresh()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không bỏ qua được giao dịch.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Giao dịch ngân hàng</h1>
        <p className="mt-1 text-sm text-muted">
          Gán giao dịch chuyển khoản chưa khớp cho sinh viên, hoặc bỏ qua kèm lý do.
        </p>
      </div>

      <div role="tablist" aria-label="Trạng thái giao dịch" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            data-testid={item.testId}
            onClick={() => setTab(item.key)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-sm px-4 text-sm font-medium ${tab === item.key ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-ink hover:bg-brand-50'}`}
          >
            {item.label}
            {item.key === 'UNMATCHED' ? (
              <span
                data-testid="tx-unmatched-count"
                className="rounded-full bg-warning-50 px-2 py-0.5 text-xs text-warning-700"
              >
                {list.unmatchedCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table data-testid="tx-table" className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="sticky top-0 bg-brand-50 text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-3">Thời điểm ngân hàng</th>
                <th className="px-3 py-3 text-right">Số tiền</th>
                <th className="px-3 py-3">Nội dung</th>
                <th className="px-3 py-3">Mã thanh toán</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Sinh viên · Học kỳ</th>
                <th className="px-3 py-3">Phiếu thu</th>
                <th className="px-3 py-3">Nguồn</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr
                  key={row.id}
                  data-testid="tx-row"
                  onClick={() => void open(row.id)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-brand-50"
                >
                  <td className="px-3 py-3 whitespace-nowrap">{dateTime(row.transactionDate)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {money(row.amount)}
                  </td>
                  <td className="max-w-64 truncate px-3 py-3">{row.content}</td>
                  <td className="px-3 py-3 font-mono text-xs">{row.code ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span
                      data-testid="tx-status"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {row.studentCode ? `${row.studentCode} · ${row.termCode ?? ''}` : '—'}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{row.receiptNumber ?? '—'}</td>
                  <td className="px-3 py-3">Webhook · {row.gateway}</td>
                  <td className="px-3 py-3">
                    <ChevronRight size={16} className="text-muted" />
                  </td>
                </tr>
              ))}
              {list.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    data-testid="tx-empty"
                    className="px-3 py-8 text-center text-muted"
                  >
                    Không còn giao dịch chưa khớp
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {detail ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="presentation">
          <aside
            data-testid="tx-drawer"
            role="dialog"
            aria-label="Chi tiết giao dịch"
            className="h-full w-full max-w-xl space-y-5 overflow-y-auto bg-surface p-6 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Chi tiết giao dịch</h2>
                <p className="font-mono text-xs text-muted">SePay #{detail.sepayId}</p>
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết"
                data-testid="tx-close"
                onClick={() => setDetail(null)}
                className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-neutral-100"
              >
                <X size={20} />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Số tiền</dt>
                <dd className="text-lg font-semibold tabular-nums">{money(detail.amount)}</dd>
              </div>
              <div>
                <dt className="text-muted">Trạng thái</dt>
                <dd>{STATUS_LABEL[detail.status]}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Nội dung chuyển khoản</dt>
                <dd>{detail.content}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Thời điểm ngân hàng ghi nhận</dt>
                <dd>{dateTime(detail.transactionDate)}</dd>
              </div>
              {detail.ignoreReason ? (
                <div className="col-span-2">
                  <dt className="text-muted">Lý do bỏ qua</dt>
                  <dd data-testid="tx-ignore-reason-view">{detail.ignoreReason}</dd>
                </div>
              ) : null}
            </dl>

            <details className="rounded-sm border border-line p-3 text-sm">
              <summary className="cursor-pointer font-medium">Dữ liệu gốc từ SePay</summary>
              <pre data-testid="tx-raw" className="mt-3 overflow-x-auto text-xs">
                {JSON.stringify(detail.rawPayload, null, 2)}
              </pre>
            </details>

            <section data-testid="tx-history" className="space-y-2">
              <h3 className="text-sm font-semibold">Lịch sử xử lý</h3>
              {detail.history.length ? (
                detail.history.map((entry, index) => (
                  <p key={`${entry.action}-${index}`} className="text-xs text-muted">
                    {entry.action} · {entry.actorName ?? 'Hệ thống'} · {dateTime(entry.createdAt)}
                  </p>
                ))
              ) : (
                <p className="text-xs text-muted">Chưa có thao tác nào.</p>
              )}
            </section>

            {detail.status === 'UNMATCHED' ? (
              <Card className="space-y-4">
                <h3 className="text-sm font-semibold">Gán cho sinh viên</h3>
                {detail.suggestedStudentCodes.length ? (
                  <p data-testid="tx-suggested-codes" className="text-xs text-muted">
                    Gợi ý từ nội dung: {detail.suggestedStudentCodes.join(', ')}
                  </p>
                ) : null}
                <Field label="MSSV hoặc họ tên" hint="Chọn sinh viên từ danh sách gợi ý.">
                  <div className="relative">
                    <Input
                      data-testid="tx-student-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={student ? student.studentCode : '24520007'}
                    />
                    <Search size={18} className="absolute top-3 right-3 text-muted" />
                  </div>
                </Field>
                {suggestions.length ? (
                  <ul
                    data-testid="tx-suggestions"
                    className="divide-y divide-line rounded-sm border border-line"
                  >
                    {suggestions.map((option) => (
                      <li key={option.studentCode}>
                        <button
                          type="button"
                          data-testid="tx-suggestion"
                          onClick={() => {
                            setStudent(option)
                            setQuery(option.studentCode)
                            setQueryOptions([])
                            setPreview(null)
                          }}
                          className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-brand-50"
                        >
                          <span className="font-mono">{option.studentCode}</span>
                          <span className="text-muted">{option.fullName}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Field label="Học kỳ">
                  <select
                    data-testid="tx-term"
                    value={termCode}
                    onChange={(event) => {
                      setTermCode(event.target.value)
                      setPreview(null)
                    }}
                    className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-base"
                  >
                    <option value="">Chọn học kỳ</option>
                    {terms.map((term) => (
                      <option key={term.code} value={term.code}>
                        {term.name} · {term.code}
                      </option>
                    ))}
                  </select>
                </Field>
                {preview ? (
                  <div
                    data-testid="tx-preview"
                    className="rounded-sm border border-line p-3 text-sm"
                  >
                    <h4 className="font-semibold">Công nợ trước → sau</h4>
                    <p className="tabular-nums">
                      Còn lại trước: {money(preview.before.outstandingAmount)} → sau:{' '}
                      <strong data-testid="tx-preview-after">
                        {money(preview.after.outstandingAmount)}
                      </strong>
                    </p>
                    {preview.after.outstandingAmount < 0 ? (
                      <Banner tone="warning">
                        <span data-testid="tx-credit-balance">
                          Phát sinh số dư có {money(-preview.after.outstandingAmount)}, tự trừ vào
                          học kỳ sau.
                        </span>
                      </Banner>
                    ) : null}
                    <Button
                      data-testid="tx-assign-open"
                      className="mt-3 w-full"
                      disabled={!student}
                      onClick={() => setConfirming(true)}
                    >
                      Gán cho sinh viên
                    </Button>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {result ? (
              <Card data-testid="tx-result" className="space-y-2 text-sm">
                <h3 data-testid="tx-receipt" className="font-semibold">
                  Phiếu thu {result.receipt.number}
                </h3>
                <p className="tabular-nums">{money(result.receipt.amount)}</p>
                {result.settled ? (
                  <Banner tone="info">
                    <span data-testid="tx-settled">
                      Đã đóng đủ. Email xác nhận sẽ gửi tới sinh viên.
                    </span>
                  </Banner>
                ) : null}
              </Card>
            ) : null}

            {detail.status === 'UNMATCHED' ? (
              <Card className="space-y-3">
                <h3 className="text-sm font-semibold">Bỏ qua giao dịch</h3>
                <Field label="Lý do (bắt buộc)">
                  <textarea
                    data-testid="tx-ignore-reason"
                    value={reason}
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    className="w-full rounded-sm border border-neutral-200 p-3 text-base"
                    placeholder="Không phải học phí"
                  />
                </Field>
                <Button
                  data-testid="tx-ignore-submit"
                  variant="secondary"
                  disabled={!reason.trim() || busy}
                  loading={busy}
                  onClick={() => void ignore()}
                >
                  Bỏ qua
                </Button>
              </Card>
            ) : null}
          </aside>
        </div>
      ) : null}

      {confirming && detail && student ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-testid="tx-assign-confirm"
            role="dialog"
            className="w-full max-w-md space-y-3 rounded-md bg-surface p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">Xác nhận gán giao dịch</h2>
            <p className="text-sm text-muted">
              {student.studentCode} · {preview?.termName} · {money(detail.amount)}
            </p>
            <p className="text-sm font-medium text-danger-700">
              Phiếu thu và dòng ghi có sẽ được tạo trong cùng một giao dịch.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Hủy
              </Button>
              <Button data-testid="tx-assign-ok" loading={busy} onClick={() => void assign()}>
                Xác nhận gán
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
