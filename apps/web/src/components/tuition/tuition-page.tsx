'use client'

import { Check, Copy, Download, Info } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Banner, Button, Card } from '@/components/ui'
import { api, ApiError } from '@/lib/auth'
import { formatCountdown } from '@/lib/registration'
import {
  dateTime,
  groupLedger,
  money,
  signedMoney,
  tuitionQrPayload,
  tuitionStatus,
  type LedgerRow,
  type TuitionOverview,
} from '@/lib/tuition'
import type { ReceiptDetail } from '@/lib/receipt'

function CopyField({
  label,
  value,
  onCopied,
}: {
  label: string
  value: string
  onCopied?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
    onCopied?.()
  }
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate font-mono text-sm text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Sao chép ${label}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-sm text-brand-700 hover:bg-brand-50"
      >
        {copied ? <Check size={18} /> : <Copy size={18} strokeWidth={1.5} />}
      </button>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  note,
  strong = false,
}: {
  label: string
  value: string
  note?: string | null
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className={strong ? 'text-sm font-semibold text-ink' : 'text-sm text-muted'}>
        {label}
        {note ? <span className="ml-1 text-xs text-muted">· {note}</span> : null}
      </span>
      <span
        className={`tabular-nums ${strong ? 'text-base font-semibold text-ink' : 'text-sm text-ink'}`}
      >
        {value}
      </span>
    </div>
  )
}

function LedgerItem({ row }: { row: LedgerRow }) {
  const positive = row.amount >= 0
  return (
    <li
      data-testid={`ledger-row-${row.id}`}
      className="relative border-l-2 border-brand-100 py-3 pl-4"
    >
      <span className="absolute top-4 -left-[5px] size-2 rounded-full bg-brand-500" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{row.label}</p>
          {row.detail ? <p className="text-xs text-muted">{row.detail}</p> : null}
          <p className="mt-1 text-xs text-muted">{dateTime(row.date)}</p>
        </div>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${positive ? 'text-danger-700' : 'text-success-700'}`}
        >
          {signedMoney(row.amount)}
        </span>
      </div>
    </li>
  )
}

export function TuitionPage() {
  const [data, setData] = useState<TuitionOverview | null>(null)
  const [termCode, setTermCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [receipts, setReceipts] = useState<ReceiptDetail[]>([])
  const [qr, setQr] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [arrived, setArrived] = useState<number | null>(null)
  const latest = useRef(0)
  const baseline = useRef(0)

  const load = useCallback(async (code?: string): Promise<TuitionOverview | null> => {
    const request = ++latest.current
    setLoading(true)
    let result: TuitionOverview | null = null
    try {
      const query = code ? `?termCode=${encodeURIComponent(code)}` : ''
      const next = await api<TuitionOverview>(`/tuition${query}`)
      result = next
      if (request !== latest.current) return null
      setData(next)
      setTermCode(next.selected?.code ?? '')
      setError('')
    } catch (cause) {
      if (request !== latest.current) return null
      setError(
        cause instanceof ApiError ? cause.message : 'Không tải được học phí. Vui lòng thử lại.',
      )
    } finally {
      if (request === latest.current) setLoading(false)
    }
    return result
  }, [])

  const refresh = useCallback(
    async (code?: string) => {
      const next = await load(code)
      const nextReceipts = await api<ReceiptDetail[]>('/tuition/receipts')
      setReceipts(nextReceipts)
      return { next, receipts: nextReceipts }
    },
    [load],
  )

  useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    void api<ReceiptDetail[]>('/tuition/receipts')
      .then(setReceipts)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const payment = data?.selected
    let active = true
    void Promise.resolve()
      .then(async () => {
        if (!payment || payment.bm7.outstandingAmount <= 0) {
          if (active) setQr('')
          return
        }
        const url = await QRCode.toDataURL(
          tuitionQrPayload(payment.payment, payment.bm7.outstandingAmount, payment.paymentCode),
          { width: 240, margin: 1 },
        )
        if (active) setQr(url)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [data])

  const startWaiting = useCallback(() => {
    const outstanding = data?.selected?.bm7.outstandingAmount ?? 0
    if (outstanding <= 0) return
    baseline.current = outstanding
    setArrived(null)
    setWaiting(true)
  }, [data])

  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => {
      void refresh(termCode)
        .then(({ next }) => {
          const current = next?.selected?.bm7.outstandingAmount
          if (current !== undefined && current < baseline.current) {
            setArrived(baseline.current - current)
            setWaiting(false)
          }
        })
        .catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [waiting, termCode, refresh])

  const saveQr = () => {
    if (!qr) return
    const link = document.createElement('a')
    link.href = qr
    link.download = `QR-${data?.selected?.paymentCode ?? 'hoc-phi'}.png`
    link.click()
    startWaiting()
  }

  const selected = data?.selected
  const status = selected ? tuitionStatus(selected.bm7, selected.tuitionDeadline, now) : null
  const remaining = selected ? Date.parse(selected.tuitionDeadline) - now : 0

  if (loading && !data)
    return <p className="py-10 text-center text-sm text-muted">Đang tải học phí…</p>
  if (error)
    return (
      <Banner tone="danger">
        {error}{' '}
        <Button variant="link" onClick={() => void load(termCode)}>
          Thử lại
        </Button>
      </Banner>
    )
  if (!data || !selected)
    return <Banner tone="info">Hiện chưa có khoản học phí nào để hiển thị.</Banner>

  const { bm7 } = selected
  const statusLabel = {
    OVERDUE: 'Quá hạn',
    OUTSTANDING: 'Còn nợ',
    SETTLED: 'Đã đóng đủ',
    CREDIT: 'Có số dư',
  }[status!]
  const statusStyle = {
    OVERDUE: 'bg-danger-50 text-danger-700 border-danger-600/30',
    OUTSTANDING: 'bg-warning-50 text-warning-700 border-warning-600/30',
    SETTLED: 'bg-success-50 text-success-700 border-success-600/30',
    CREDIT: 'bg-brand-50 text-brand-700 border-brand-600/30',
  }[status!]
  const amountStyle =
    status === 'OVERDUE'
      ? 'text-danger-700'
      : status === 'OUTSTANDING'
        ? 'text-warning-700'
        : status === 'CREDIT'
          ? 'text-brand-700'
          : 'text-success-700'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Học phí</h1>
        <p className="mt-1 text-sm text-muted">
          {data.student.fullName} · {data.student.studentCode}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Học kỳ</span>
        <select
          data-testid="tuition-term-select"
          value={termCode}
          onChange={(event) => {
            setTermCode(event.target.value)
            setWaiting(false)
            setArrived(null)
            void load(event.target.value)
          }}
          className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-base text-ink"
        >
          {data.terms.map((term) => (
            <option key={term.code} value={term.code}>
              {term.name} · {term.code}
              {term.outstandingAmount > 0 ? ' · Còn nợ' : ''}
            </option>
          ))}
        </select>
      </label>

      {status === 'OVERDUE' ? (
        <div data-testid="tuition-overdue">
          <Banner tone="danger">
            Học phí {selected.name} đã quá hạn từ {dateTime(selected.tuitionDeadline)}, còn{' '}
            {money(bm7.outstandingAmount)}. Hãy đóng ngay và liên hệ Phòng Tài vụ nếu cần hỗ trợ.
          </Banner>
        </div>
      ) : null}
      {status === 'SETTLED' ? (
        <div data-testid="tuition-settled">
          <Banner tone="info">
            Bạn đã đóng đủ học phí học kỳ này.
            {data.student.email ? ` Email xác nhận sẽ gửi tới ${data.student.email}.` : ''}
          </Banner>
        </div>
      ) : null}
      {status === 'CREDIT' ? (
        <div data-testid="tuition-credit">
          <Banner tone="info">
            Bạn có số dư có {money(-bm7.outstandingAmount)}. Khoản này sẽ được trừ vào học kỳ sau.
          </Banner>
        </div>
      ) : null}

      <div data-testid="tuition-bm7">
        <Card className="space-y-1">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="text-sm font-semibold text-ink">Tóm tắt học phí · {selected.name}</h2>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyle}`}>
              {statusLabel}
            </span>
          </div>
          <SummaryRow label="Số tiền đăng ký" value={money(bm7.grossAmount)} />
          <SummaryRow
            label="Giảm trừ"
            note={selected.priority ? selected.priority.name : null}
            value={`−${money(bm7.discountAmount)}`}
          />
          <SummaryRow label="Số tiền phải đóng" value={money(bm7.netAmount)} strong />
          <SummaryRow label="Đã thanh toán" value={`−${money(bm7.paidAmount)}`} />
          <div className="mt-2 flex items-end justify-between gap-3 border-t border-line pt-3">
            <span className="text-sm font-semibold text-ink">Số tiền còn lại</span>
            <strong
              data-testid="tuition-outstanding"
              className={`text-3xl font-semibold tabular-nums ${amountStyle}`}
            >
              {money(bm7.outstandingAmount)}
            </strong>
          </div>
          <div
            data-testid="tuition-deadline"
            className="flex items-center gap-2 pt-2 text-xs text-muted"
          >
            <Info size={16} strokeWidth={1.5} />
            <span>
              Hạn đóng: {dateTime(selected.tuitionDeadline)}
              {remaining > 0 ? ` · Còn ${formatCountdown(remaining)}` : ''}
            </span>
          </div>
        </Card>
      </div>

      {bm7.outstandingAmount > 0 ? (
        <div data-testid="tuition-qr-card" className="space-y-3">
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Cách đóng học phí</h2>
            <div className="flex flex-col items-center gap-3">
              {qr ? (
                <Image
                  data-testid="tuition-qr-image"
                  src={qr}
                  alt="QR học phí"
                  width={240}
                  height={240}
                  unoptimized
                  className="size-60 bg-white p-2"
                />
              ) : null}
              <Button variant="secondary" onClick={saveQr} data-testid="tuition-qr-save">
                <Download size={18} strokeWidth={1.5} />
                Lưu ảnh QR
              </Button>
            </div>
            <div className="border-t border-line pt-1">
              <CopyField
                label="Ngân hàng"
                value={selected.payment.gateway}
                onCopied={startWaiting}
              />
              <CopyField
                label="Số tài khoản"
                value={selected.payment.accountNumber}
                onCopied={startWaiting}
              />
              <CopyField
                label="Chủ tài khoản"
                value={selected.payment.accountName}
                onCopied={startWaiting}
              />
              <CopyField
                label="Số tiền"
                value={money(bm7.outstandingAmount)}
                onCopied={startWaiting}
              />
              <CopyField
                label="Nội dung chuyển khoản"
                value={selected.paymentCode}
                onCopied={startWaiting}
              />
            </div>
            <p className="text-xs text-muted">
              Giữ nguyên nội dung chuyển khoản để hệ thống tự ghi nhận. Có thể chuyển nhiều lần.
            </p>
          </Card>
        </div>
      ) : null}
      {waiting ? (
        <div data-testid="tuition-waiting">
          <Banner
            tone="info"
            action={
              <details>
                <summary className="cursor-pointer underline">
                  Tôi đã chuyển nhưng chưa thấy ghi nhận
                </summary>
                <p className="pt-1 text-xs">
                  Liên hệ Phòng Tài vụ, cung cấp nội dung chuyển khoản để được hỗ trợ.
                </p>
              </details>
            }
          >
            Đang chờ tiền về… Hệ thống sẽ tự kiểm tra định kỳ.
          </Banner>
        </div>
      ) : null}
      {arrived !== null ? (
        <div data-testid="tuition-arrived">
          <Banner
            tone="info"
            action={
              <Button variant="link" onClick={() => void refresh(termCode)}>
                Xem phiếu thu
              </Button>
            }
          >
            Đã nhận {money(arrived)}. {receipts[0] ? `Phiếu thu ${receipts[0].number}. ` : ''}
            {bm7.outstandingAmount <= 0 && data.student.email
              ? `Email xác nhận sẽ gửi tới ${data.student.email}.`
              : ''}
          </Banner>
        </div>
      ) : null}

      <section data-testid="tuition-ledger">
        <h2 className="mb-2 text-sm font-semibold text-ink">Sổ cái công nợ</h2>
        <Card>
          {groupLedger(selected.ledger).map((group, index) => (
            <div key={`${group.title ?? 'row'}-${index}`}>
              {group.title ? (
                <p className="pt-3 text-xs font-semibold tracking-wide text-brand-700 uppercase">
                  {group.title}
                </p>
              ) : null}
              <ul className={group.title ? '' : 'pt-1'}>
                {group.rows.map((row) => (
                  <LedgerItem key={row.id} row={row} />
                ))}
              </ul>
            </div>
          ))}
          {selected.ledger.length === 0 ? (
            <p className="py-4 text-sm text-muted">Học kỳ này chưa có khoản nào.</p>
          ) : null}
        </Card>
      </section>

      <section data-testid="tuition-receipts">
        <h2 className="mb-2 text-sm font-semibold text-ink">Phiếu thu của tôi</h2>
        <Card className="divide-y divide-line p-0">
          {receipts.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Chưa có phiếu thu nào.</p>
          ) : (
            receipts.map((receipt) => (
              <Link
                key={receipt.id}
                data-testid={`tuition-receipt-${receipt.number}`}
                href={`/student/receipts/${encodeURIComponent(receipt.number)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-50"
              >
                <span>
                  <span className="block font-mono text-sm text-ink">{receipt.number}</span>
                  <span className="block text-xs text-muted">
                    {receipt.termName} · {dateTime(receipt.paidAt)}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{money(receipt.amount)}</span>
              </Link>
            ))
          )}
        </Card>
      </section>
    </div>
  )
}
