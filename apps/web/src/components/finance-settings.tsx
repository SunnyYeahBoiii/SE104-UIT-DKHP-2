'use client'

import { AlertTriangle, Pencil, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api, ApiError } from '@/lib/auth'
import { Banner, Button, Card, Field, Input } from './ui'

type CreditRates = { theoryCreditRate: number; practiceCreditRate: number }
type ReceivingAccount = { gateway: string; accountNumber: string; accountName: string }
type FeeSchedule = {
  id: number
  cohortId: number
  cohortCode: string
  admissionYear: number
  trainingSystemId: number
  trainingSystemCode: string
  trainingSystemName: string
  baseTuition: number
  theoryCreditRate: number
  practiceCreditRate: number
  studentCount: number
  updatedAt: string
}
type MissingFee = {
  cohortId: number
  cohortCode: string
  admissionYear: number
  trainingSystemId: number
  trainingSystemCode: string
  trainingSystemName: string
  studentCount: number
}
type Deadline = { id: number; termCode: string; type: string; tuitionDeadline: string }
type History = {
  id: number
  action: string
  entityType: string
  entityId: string | null
  actorName: string | null
  createdAt: string
  before: Record<string, number | string | null> | null
  after: Record<string, number | string | null> | null
}
type Settings = {
  defaults: CreditRates
  feeSchedules: FeeSchedule[]
  missingFeeSchedules: MissingFee[]
  receivingAccount: ReceivingAccount
  tuitionDeadlines: Deadline[]
  history: History[]
}
type FeeForm = {
  cohortId: string
  trainingSystemId: string
  baseTuition: string
  theoryCreditRate: string
  practiceCreditRate: string
}
type Confirmation = { title: string; message: string; run: () => Promise<void> }

const EMPTY_FEE: FeeForm = {
  cohortId: '',
  trainingSystemId: '',
  baseTuition: '',
  theoryCreditRate: '',
  practiceCreditRate: '',
}
const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted'
const TD = 'px-4 py-3 text-sm text-ink'
const ACTION_LABELS: Record<string, string> = {
  FEE_SCHEDULE_CREATE: 'Thêm bảng phí',
  FEE_SCHEDULE_UPDATE: 'Sửa bảng phí',
  DEFAULT_CREDIT_RATE_UPDATE: 'Đổi đơn giá mặc định',
  RECEIVING_ACCOUNT_UPDATE: 'Đổi tài khoản nhận',
}
const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`
const datetime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )

export function FinanceSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rates, setRates] = useState({ theoryCreditRate: '', practiceCreditRate: '' })
  const [account, setAccount] = useState<ReceivingAccount>({
    gateway: '',
    accountNumber: '',
    accountName: '',
  })
  const [drawer, setDrawer] = useState<{ id?: number } | null>(null)
  const [fee, setFee] = useState<FeeForm>(EMPTY_FEE)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await api<Settings>('/finance/settings')
      setSettings(next)
      setRates({
        theoryCreditRate: String(next.defaults.theoryCreditRate),
        practiceCreditRate: String(next.defaults.practiceCreditRate),
      })
      setAccount(next.receivingAccount)
      setError('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không tải được thiết lập học phí.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const run = async (work: () => Promise<void>, message: string) => {
    setSaving(true)
    try {
      await work()
      setConfirmation(null)
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : message)
      setConfirmation(null)
    } finally {
      setSaving(false)
    }
  }

  const openFee = (row?: FeeSchedule) => {
    if (row) {
      setFee({
        cohortId: String(row.cohortId),
        trainingSystemId: String(row.trainingSystemId),
        baseTuition: String(row.baseTuition),
        theoryCreditRate: String(row.theoryCreditRate),
        practiceCreditRate: String(row.practiceCreditRate),
      })
    } else {
      setFee({
        ...EMPTY_FEE,
        theoryCreditRate: String(settings?.defaults.theoryCreditRate ?? ''),
        practiceCreditRate: String(settings?.defaults.practiceCreditRate ?? ''),
      })
    }
    setError('')
    setDrawer({ id: row?.id })
  }

  const validFee = () => {
    const values = [fee.baseTuition, fee.theoryCreditRate, fee.practiceCreditRate]
    if (!fee.cohortId || !fee.trainingSystemId || values.some((value) => value === ''))
      return 'Vui lòng điền đầy đủ thông tin bảng phí.'
    if (values.some((value) => !Number.isSafeInteger(Number(value)) || Number(value) < 0))
      return 'Tiền phải là số nguyên đồng, không âm.'
    if (Number(fee.theoryCreditRate) <= 0 || Number(fee.practiceCreditRate) <= 0)
      return 'Đơn giá tín chỉ phải lớn hơn 0.'
    return ''
  }

  const feeBody = () => ({
    cohortId: Number(fee.cohortId),
    trainingSystemId: Number(fee.trainingSystemId),
    baseTuition: Number(fee.baseTuition),
    theoryCreditRate: Number(fee.theoryCreditRate),
    practiceCreditRate: Number(fee.practiceCreditRate),
  })

  const askSaveFee = () => {
    const invalid = validFee()
    if (invalid) {
      setError(invalid)
      return
    }
    const id = drawer?.id
    setConfirmation({
      title: id ? 'Xác nhận sửa bảng phí' : 'Xác nhận thêm bảng phí',
      message:
        'Thay đổi không hồi tố. Dòng đăng ký đã chốt đơn giá lúc đăng ký; học phí cố định đã ghi nợ không đổi.',
      run: async () => {
        await api(`/finance/fee-schedules${id ? `/${id}` : ''}`, {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(feeBody()),
        })
        setDrawer(null)
      },
    })
  }

  const askSaveRates = () => {
    const theory = Number(rates.theoryCreditRate)
    const practice = Number(rates.practiceCreditRate)
    if (
      !Number.isSafeInteger(theory) ||
      !Number.isSafeInteger(practice) ||
      theory <= 0 ||
      practice <= 0
    ) {
      setError('Đơn giá tín chỉ phải là số nguyên đồng lớn hơn 0.')
      return
    }
    setConfirmation({
      title: 'Xác nhận đổi đơn giá mặc định',
      message: 'Chỉ là giá điền sẵn khi lập bảng phí mới. Bảng phí đã có không đổi theo.',
      run: async () => {
        await api('/finance/settings/credit-rates', {
          method: 'PATCH',
          body: JSON.stringify({ theoryCreditRate: theory, practiceCreditRate: practice }),
        })
      },
    })
  }

  const askSaveAccount = () => {
    if (
      !account.gateway.trim() ||
      !/^\d+$/.test(account.accountNumber) ||
      !account.accountName.trim()
    ) {
      setError('Ngân hàng và chủ tài khoản là bắt buộc; số tài khoản chỉ gồm chữ số.')
      return
    }
    setConfirmation({
      title: 'Xác nhận đổi tài khoản nhận học phí',
      message:
        'QR học phí và kiểm tra webhook dùng tài khoản mới ngay sau khi lưu. Giao dịch vào tài khoản cũ sẽ bị từ chối.',
      run: async () => {
        await api('/finance/receiving-account', {
          method: 'PATCH',
          body: JSON.stringify(account),
        })
      },
    })
  }

  const missing = settings?.missingFeeSchedules ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Bảng phí và tham số</h1>
        <p className="mt-1 text-sm text-muted">
          Phòng Tài vụ quản lý đơn giá, bảng phí và tài khoản nhận học phí. Mọi thay đổi đều có xác
          nhận và được ghi vào nhật ký kiểm toán.
        </p>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? <p className="text-sm text-muted">Đang tải…</p> : null}
      {!loading && settings ? (
        <>
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Đơn giá tín chỉ mặc định</h2>
              <p className="mt-1 text-sm text-muted">
                Chỉ là giá điền sẵn khi lập bảng phí mới. Bảng phí đã có không đổi theo.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Đơn giá LT (đồng)">
                <Input
                  aria-label="Đơn giá LT mặc định"
                  type="number"
                  min={1}
                  step={1}
                  value={rates.theoryCreditRate}
                  onChange={(event) => setRates({ ...rates, theoryCreditRate: event.target.value })}
                />
              </Field>
              <Field label="Đơn giá TH (đồng)">
                <Input
                  aria-label="Đơn giá TH mặc định"
                  type="number"
                  min={1}
                  step={1}
                  value={rates.practiceCreditRate}
                  onChange={(event) =>
                    setRates({ ...rates, practiceCreditRate: event.target.value })
                  }
                />
              </Field>
            </div>
            <Button onClick={askSaveRates}>Lưu đơn giá mặc định</Button>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Bảng phí theo (khoá, hệ)</h2>
                <p className="mt-1 text-sm text-muted">
                  Thay đổi không hồi tố. Dòng đăng ký đã chốt đơn giá lúc đăng ký; học phí cố định
                  đã ghi nợ không đổi.
                </p>
              </div>
              <Button onClick={() => openFee()}>
                <Plus size={18} /> Thêm bảng phí
              </Button>
            </div>
            {missing.length ? (
              <Banner tone="danger">
                {missing.map((item) => (
                  <div key={`${item.cohortId}:${item.trainingSystemId}`}>
                    {item.cohortCode} · {item.trainingSystemCode} có {item.studentCount} sinh viên
                    nhưng chưa có bảng phí. Học kỳ chính kế tiếp sẽ không chuyển sang Đăng ký được.
                  </div>
                ))}
              </Banner>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={TH}>Khoá</th>
                    <th className={TH}>Hệ đào tạo</th>
                    <th className={TH}>Học phí cố định / học kỳ chính</th>
                    <th className={TH}>Đơn giá LT</th>
                    <th className={TH}>Đơn giá TH</th>
                    <th className={TH}>Số sinh viên</th>
                    <th className={TH}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.feeSchedules.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className={TD}>
                        <span className="font-medium">{row.cohortCode}</span>
                      </td>
                      <td className={TD}>{row.trainingSystemCode}</td>
                      <td className={TD}>{money(row.baseTuition)}</td>
                      <td className={TD}>{money(row.theoryCreditRate)}</td>
                      <td className={TD}>{money(row.practiceCreditRate)}</td>
                      <td className={TD}>{row.studentCount}</td>
                      <td className={TD}>
                        <Button
                          variant="ghost"
                          aria-label={`Sửa bảng phí ${row.cohortCode} ${row.trainingSystemCode}`}
                          onClick={() => openFee(row)}
                        >
                          <Pencil size={16} /> Sửa
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {missing.map((item) => (
                    <tr
                      key={`missing-${item.cohortId}-${item.trainingSystemId}`}
                      className="border-danger-200 border-t bg-danger-50"
                    >
                      <td className={`${TD} font-medium text-danger-700`}>{item.cohortCode}</td>
                      <td className={`${TD} text-danger-700`}>{item.trainingSystemCode}</td>
                      <td className={TD} colSpan={4}>
                        <span className="inline-flex items-center gap-2 text-danger-700">
                          <AlertTriangle size={16} /> Chưa có bảng phí. Học kỳ chính kế tiếp sẽ
                          không chuyển sang Đăng ký được.
                        </span>
                      </td>
                      <td className={TD} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Tài khoản nhận học phí</h2>
              <p className="mt-1 text-sm text-muted">
                Mã QR học phí và webhook SePay kiểm tra tài khoản này.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ngân hàng">
                <Input
                  aria-label="Ngân hàng"
                  value={account.gateway}
                  onChange={(event) => setAccount({ ...account, gateway: event.target.value })}
                />
              </Field>
              <Field label="Số tài khoản">
                <Input
                  aria-label="Số tài khoản"
                  value={account.accountNumber}
                  onChange={(event) =>
                    setAccount({ ...account, accountNumber: event.target.value })
                  }
                />
              </Field>
              <Field label="Chủ tài khoản">
                <Input
                  aria-label="Chủ tài khoản"
                  value={account.accountName}
                  onChange={(event) => setAccount({ ...account, accountName: event.target.value })}
                />
              </Field>
            </div>
            <Button onClick={askSaveAccount}>Lưu tài khoản nhận</Button>
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Hạn đóng học phí</h2>
              <p className="mt-1 text-sm text-muted">Do Phòng Đào tạo đặt.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={TH}>Học kỳ</th>
                    <th className={TH}>Hạn đóng</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.tuitionDeadlines.map((term) => (
                    <tr key={term.id} className="border-t border-line">
                      <td className={TD}>{term.termCode}</td>
                      <td className={TD}>{datetime(term.tuitionDeadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Lịch sử thay đổi</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={TH}>Thời điểm</th>
                    <th className={TH}>Thay đổi</th>
                    <th className={TH}>Người thực hiện</th>
                    <th className={TH}>Giá trị mới</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.history.map((item) => (
                    <tr key={item.id} className="border-t border-line">
                      <td className={TD}>{datetime(item.createdAt)}</td>
                      <td className={TD}>{ACTION_LABELS[item.action] ?? item.action}</td>
                      <td className={TD}>{item.actorName ?? 'Hệ thống'}</td>
                      <td className={TD}>
                        {item.after
                          ? Object.entries(item.after)
                              .map(([key, value]) => `${key}: ${value ?? '—'}`)
                              .join(', ')
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Bảng phí"
            className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-line bg-surface p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">
                {drawer.id ? 'Sửa bảng phí' : 'Thêm bảng phí'}
              </h2>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setDrawer(null)}
                className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-neutral-100"
              >
                <X size={20} />
              </button>
            </div>
            <Field label="Khoá tuyển sinh">
              <select
                aria-label="Khoá tuyển sinh"
                value={fee.cohortId}
                onChange={(event) => setFee({ ...fee, cohortId: event.target.value })}
                className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
              >
                <option value="">Chọn khoá</option>
                {settings?.feeSchedules.map((row) => (
                  <option key={`fee-${row.cohortId}-${row.trainingSystemId}`} value={row.cohortId}>
                    {row.cohortCode}
                  </option>
                ))}
                {settings?.missingFeeSchedules.map((row) => (
                  <option
                    key={`missing-${row.cohortId}-${row.trainingSystemId}`}
                    value={row.cohortId}
                  >
                    {row.cohortCode}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hệ đào tạo">
              <select
                aria-label="Hệ đào tạo"
                value={fee.trainingSystemId}
                onChange={(event) => setFee({ ...fee, trainingSystemId: event.target.value })}
                className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
              >
                <option value="">Chọn hệ</option>
                {settings?.feeSchedules.map((row) => (
                  <option
                    key={`fee-${row.cohortId}-${row.trainingSystemId}`}
                    value={row.trainingSystemId}
                  >
                    {row.trainingSystemCode}
                  </option>
                ))}
                {settings?.missingFeeSchedules.map((row) => (
                  <option
                    key={`missing-${row.cohortId}-${row.trainingSystemId}`}
                    value={row.trainingSystemId}
                  >
                    {row.trainingSystemCode}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Học phí cố định mỗi học kỳ chính (đồng)">
              <Input
                aria-label="Học phí cố định"
                type="number"
                min={0}
                step={1}
                value={fee.baseTuition}
                onChange={(event) => setFee({ ...fee, baseTuition: event.target.value })}
              />
            </Field>
            <Field
              label="Đơn giá tín chỉ LT (đồng)"
              hint={drawer.id ? undefined : 'Điền sẵn từ đơn giá mặc định.'}
            >
              <Input
                aria-label="Đơn giá LT"
                type="number"
                min={1}
                step={1}
                value={fee.theoryCreditRate}
                onChange={(event) => setFee({ ...fee, theoryCreditRate: event.target.value })}
              />
            </Field>
            <Field
              label="Đơn giá tín chỉ TH (đồng)"
              hint={drawer.id ? undefined : 'Điền sẵn từ đơn giá mặc định.'}
            >
              <Input
                aria-label="Đơn giá TH"
                type="number"
                min={1}
                step={1}
                value={fee.practiceCreditRate}
                onChange={(event) => setFee({ ...fee, practiceCreditRate: event.target.value })}
              />
            </Field>
            <div className="mt-auto flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDrawer(null)}>
                Huỷ
              </Button>
              <Button onClick={askSaveFee}>Lưu</Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmation ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={confirmation.title}
            className="w-full max-w-md space-y-4 rounded-md border border-line bg-surface p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-ink">{confirmation.title}</h2>
            <p className="text-sm text-muted">{confirmation.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmation(null)}>
                Huỷ
              </Button>
              <Button
                loading={saving}
                onClick={() => {
                  const next = confirmation
                  void run(next.run, 'Không lưu được. Vui lòng thử lại.')
                }}
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
