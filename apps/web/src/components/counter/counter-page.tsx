'use client'

import { Printer, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Banner, Button, Card, Field, Input } from '@/components/ui'
import { ReceiptPrint, type ReceiptFormat } from '@/components/receipt/receipt-print'
import { api, ApiError } from '@/lib/auth'
import {
  amountInWords,
  dateTime,
  money,
  remainingAfter,
  type CounterStudent,
  type PaymentResult,
  type ShiftReceipts,
} from '@/lib/receipt'

export function CounterPage() {
  const searchRef = useRef<HTMLInputElement>(null)
  const idempotencyKey = useRef(crypto.randomUUID())
  const [code, setCode] = useState('')
  const [student, setStudent] = useState<CounterStudent | null>(null)
  const [termCode, setTermCode] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [shift, setShift] = useState<ShiftReceipts | null>(null)
  const [format, setFormat] = useState<ReceiptFormat>('a5')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const loadShift = useCallback(async () => {
    try {
      setShift(await api<ShiftReceipts>('/counter/receipts'))
    } catch {
      setShift(null)
    }
  }, [])

  const search = useCallback(async (studentCode: string) => {
    try {
      const found = await api<CounterStudent>(`/counter/students/${studentCode}`)
      setStudent(found)
      setTermCode(found.defaultTermCode ?? found.debts[0]?.code ?? '')
      setAmount(String(found.debts[0]?.outstandingAmount ?? ''))
      setResult(null)
      setError('')
      setNote('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không tìm thấy sinh viên.')
    }
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
    let active = true
    void api<ShiftReceipts>('/counter/receipts')
      .then((data) => {
        if (active) setShift(data)
      })
      .catch(() => undefined)
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!/^\d{8}$/.test(code)) return
    const timer = window.setTimeout(() => void search(code), 200)
    return () => window.clearTimeout(timer)
  }, [code, search])

  const debt = student?.debts.find((row) => row.code === termCode) ?? null
  const paid = Number(amount)
  const remaining = debt && Number.isFinite(paid) ? remainingAfter(debt.outstandingAmount, paid) : 0
  const overpay = debt !== null && remaining < 0

  const nextStudent = useCallback(() => {
    setCode('')
    setStudent(null)
    setTermCode('')
    setAmount('')
    setNote('')
    setResult(null)
    setConfirming(false)
    setError('')
    idempotencyKey.current = crypto.randomUUID()
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const submit = useCallback(async () => {
    if (!student || !termCode || !Number.isSafeInteger(paid) || paid <= 0) return
    setSubmitting(true)
    setError('')
    try {
      const payment = await api<PaymentResult>('/counter/payments', {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey.current },
        body: JSON.stringify({
          studentCode: student.studentCode,
          termCode,
          amount: paid,
          note: note || undefined,
        }),
      })
      setResult(payment)
      setConfirming(false)
      idempotencyKey.current = crypto.randomUUID()
      await loadShift()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không ghi nhận được thanh toán.')
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }, [student, termCode, paid, note, loadShift])

  const print = useCallback((next: ReceiptFormat) => {
    setFormat(next)
    window.setTimeout(() => window.print(), 50)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (event.key === 'Escape') {
        if (confirming && !submitting) setConfirming(false)
        else if (!submitting) nextStudent()
        return
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        if (submitting) return
        if (confirming) void submit()
        else if (student && debt) setConfirming(true)
        return
      }
      if (event.key.toLowerCase() === 'p' && (event.ctrlKey || event.metaKey) && result) {
        event.preventDefault()
        print(format)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming, submitting, student, debt, result, format, nextStudent, submit, print])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Thu tại quầy</h1>
          <p className="mt-1 text-sm text-muted">
            Gõ mã số sinh viên, ghi nhận và in phiếu thu BM6.
          </p>
        </div>
        <p className="text-xs text-muted">
          Phím tắt: <kbd>/</kbd> tìm · <kbd>Ctrl+Enter</kbd> ghi nhận · <kbd>Esc</kbd> sinh viên
          tiếp theo · <kbd>Ctrl+P</kbd> in
        </p>
      </div>

      <Card className="space-y-4">
        <Field label="MSSV" hint="Tự tìm khi gõ đủ 8 số, hoặc nhấn Enter.">
          <div className="relative">
            <Input
              ref={searchRef}
              data-testid="counter-search"
              inputMode="numeric"
              autoComplete="off"
              placeholder="24520001"
              className="pr-12 font-mono text-2xl tracking-widest"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void search(code)
              }}
            />
            <Search size={20} className="absolute top-4 right-4 text-muted" strokeWidth={1.5} />
          </div>
        </Field>
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </Card>

      {student ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="space-y-4">
            <div data-testid="counter-student-card">
              <h2 className="text-lg font-semibold text-ink">{student.fullName}</h2>
              <p className="font-mono text-sm text-muted">
                {student.studentCode} · Khoá {student.cohortCode} · {student.trainingSystemCode}
              </p>
              <p className="mt-1 text-xs text-muted">
                {student.priority
                  ? `Đối tượng ưu tiên: ${student.priority.name} (${student.priority.rate}%)`
                  : 'Không có đối tượng ưu tiên'}
                {student.email ? ` · ${student.email}` : ''}
              </p>
            </div>
            <div data-testid="counter-debts">
              <h3 className="mb-2 text-sm font-semibold text-ink">Công nợ từng học kỳ</h3>
              {student.debts.length === 0 ? (
                <p className="text-sm text-muted">Không còn học kỳ nào phải đóng.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-2">Học kỳ</th>
                      <th className="py-2 text-right">Phải đóng</th>
                      <th className="py-2 text-right">Đã thu</th>
                      <th className="py-2 text-right">Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.debts.map((row) => (
                      <tr key={row.code} className="border-b border-line last:border-0">
                        <td className="py-2">
                          {row.name}
                          {row.phase === 'IN_PROGRESS' && now > Date.parse(row.tuitionDeadline) ? (
                            <span className="ml-2 rounded-full bg-danger-50 px-2 py-0.5 text-xs text-danger-700">
                              Quá hạn
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">{money(row.netAmount)}</td>
                        <td className="py-2 text-right tabular-nums">{money(row.paidAmount)}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {money(row.outstandingAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-ink">Phiếu thu mới</h2>
            <Field label="Học kỳ">
              <select
                data-testid="counter-term"
                value={termCode}
                onChange={(event) => {
                  setTermCode(event.target.value)
                  const next = student.debts.find((row) => row.code === event.target.value)
                  if (next) setAmount(String(next.outstandingAmount))
                }}
                className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-base text-ink"
              >
                {student.debts.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.name} · {row.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền thu" hint="Mặc định bằng số tiền còn lại; có thể sửa.">
              <Input
                data-testid="counter-amount"
                inputMode="numeric"
                type="number"
                min={1}
                step={1000}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Còn lại sau lần thu</span>
              <strong
                data-testid="counter-remaining"
                className={`text-xl tabular-nums ${remaining < 0 ? 'text-brand-700' : 'text-ink'}`}
              >
                {money(remaining)}
              </strong>
            </div>
            {overpay ? (
              <Banner tone="warning">
                <span data-testid="counter-overpay">
                  Thừa {money(-remaining)} sẽ thành số dư có, tự trừ vào học kỳ sau. Không hoàn
                  tiền.
                </span>
              </Banner>
            ) : null}
            <Field label="Ghi chú (tuỳ chọn)">
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ghi chú tại quầy"
              />
            </Field>
            <Button
              data-testid="counter-submit"
              className="w-full"
              disabled={!debt || !Number.isSafeInteger(paid) || paid <= 0 || submitting}
              onClick={() => setConfirming(true)}
            >
              Ghi nhận thanh toán
            </Button>
          </Card>
        </div>
      ) : null}

      {result ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 data-testid="counter-receipt" className="text-lg font-semibold text-ink">
                Phiếu thu {result.receipt.number}
              </h2>
              <p className="text-sm text-muted">
                {money(result.receipt.amount)} · {result.receipt.amountInWords}
              </p>
            </div>
            <div className="print-hide flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => print('a5')}>
                <Printer size={16} /> In (A5)
              </Button>
              <Button variant="secondary" onClick={() => print('80mm')}>
                <Printer size={16} /> In (80 mm)
              </Button>
              <Button onClick={nextStudent}>Sinh viên tiếp theo (Esc)</Button>
            </div>
          </div>
          {result.settled ? (
            <Banner tone="info">
              <span data-testid="counter-settled">
                Đã đóng đủ. Email xác nhận sẽ gửi tới sinh viên.
              </span>
            </Banner>
          ) : null}
          {result.creditBalance > 0 ? (
            <Banner tone="warning">
              Số dư có {money(result.creditBalance)} sẽ được trừ vào học kỳ sau.
            </Banner>
          ) : null}
          <ReceiptPrint receipt={result.receipt} format={format} />
        </Card>
      ) : null}

      <section data-testid="counter-shift" className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Phiếu thu ca này</h2>
          <strong data-testid="counter-shift-total" className="tabular-nums">
            {money(shift?.totalAmount ?? 0)}
          </strong>
        </div>
        <Card className="divide-y divide-line p-0">
          {shift?.receipts.length ? (
            shift.receipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-sm text-ink">{receipt.number}</p>
                  <p className="text-xs text-muted">
                    {receipt.studentCode} · {receipt.studentName} · {dateTime(receipt.paidAt)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{money(receipt.amount)}</span>
              </div>
            ))
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Chưa có phiếu thu nào trong ca này.</p>
          )}
        </Card>
      </section>

      {confirming && debt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            data-testid="counter-confirm"
            className="w-full max-w-md rounded-md bg-surface p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold text-ink">Xác nhận thu học phí</h2>
            <p className="mt-2 text-sm text-muted">
              {student!.fullName} · {student!.studentCode} · {debt.name}
            </p>
            <p
              data-testid="counter-confirm-amount"
              className="mt-4 text-3xl font-bold text-ink tabular-nums"
            >
              {money(paid)}
            </p>
            <p data-testid="counter-confirm-words" className="text-sm text-muted">
              {amountInWords(paid)}
            </p>
            {overpay ? (
              <Banner tone="warning">
                Thừa {money(-remaining)} sẽ thành số dư có, tự trừ vào học kỳ sau.
              </Banner>
            ) : null}
            <p className="mt-4 text-sm font-medium text-danger-700">
              Phiếu thu không huỷ được sau khi ghi nhận.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" disabled={submitting} onClick={() => setConfirming(false)}>
                Hủy
              </Button>
              <Button
                data-testid="counter-confirm-ok"
                loading={submitting}
                onClick={() => void submit()}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
