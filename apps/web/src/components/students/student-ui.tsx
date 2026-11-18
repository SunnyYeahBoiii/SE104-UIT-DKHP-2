'use client'

import { Copy, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { Banner, Button, Field, Input } from '@/components/ui'
import {
  beforeAfterRows,
  formatMoney,
  type Catalogs,
  type Student,
  type StudentPayload,
  type TuitionPreviewTerm,
} from '@/lib/students'

export function StudentForm({
  initial,
  catalogs,
  editing = false,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Student
  catalogs: Catalogs
  editing?: boolean
  busy: boolean
  error: string
  onSubmit: (value: StudentPayload) => void
  onCancel: () => void
}) {
  const [studentCode, setStudentCode] = useState(initial?.studentCode ?? '')
  const [fullName, setFullName] = useState(initial?.fullName ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [cohortId, setCohortId] = useState(String(initial?.cohort.id ?? ''))
  const [systemId, setSystemId] = useState(String(initial?.trainingSystem.id ?? ''))
  const [groupIds, setGroupIds] = useState<number[]>(
    initial?.priorityGroups.map((group) => group.id) ?? [],
  )
  const [duplicate, setDuplicate] = useState(false)

  const checkDuplicate = async (code: string) => {
    if (!editing && /^\d{8}$/.test(code)) {
      const { exists } = await (await fetch(`/api/students/exists/${code}`)).json()
      setDuplicate(Boolean(exists))
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      studentCode,
      fullName,
      email,
      cohortId: Number(cohortId),
      trainingSystemId: Number(systemId),
      priorityGroupIds: groupIds,
    })
  }

  const applied = catalogs.priorityGroups.find((group) => groupIds.includes(group.id))
  const toggle = (id: number) =>
    setGroupIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Field
        label="MSSV"
        hint={
          editing ? 'Không sửa được sau khi tạo.' : 'Gồm đúng 8 chữ số. Không sửa được sau khi tạo.'
        }
      >
        <Input
          name="studentCode"
          aria-label="MSSV"
          placeholder="Ví dụ: 25520999"
          className="font-mono"
          value={studentCode}
          disabled={editing}
          onChange={(event) => setStudentCode(event.target.value)}
          onBlur={(event) => void checkDuplicate(event.target.value)}
          required
        />
      </Field>
      {duplicate ? (
        <Banner tone="danger">MSSV này đã tồn tại. Vui lòng chọn mã khác.</Banner>
      ) : null}
      <Field label="Họ tên">
        <Input
          name="fullName"
          aria-label="Họ tên"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </Field>
      <Field label="Email">
        <Input
          name="email"
          type="email"
          aria-label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Khoá tuyển sinh">
        <select
          name="cohortId"
          aria-label="Khoá tuyển sinh"
          className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
          value={cohortId}
          onChange={(event) => setCohortId(event.target.value)}
          required
        >
          <option value="">Chọn khoá</option>
          {catalogs.cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.code} · {cohort.admissionYear}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Hệ đào tạo">
        <select
          name="trainingSystemId"
          aria-label="Hệ đào tạo"
          className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
          value={systemId}
          onChange={(event) => setSystemId(event.target.value)}
          required
        >
          <option value="">Chọn hệ đào tạo</option>
          {catalogs.trainingSystems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.code} · {system.name}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">Đối tượng ưu tiên</legend>
        <div className="grid gap-2">
          {catalogs.priorityGroups.map((group) => (
            <label key={group.id} className="flex items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="size-5 accent-brand-600"
                checked={groupIds.includes(group.id)}
                onChange={() => toggle(group.id)}
              />
              {group.name} · {group.discountRate}%
            </label>
          ))}
        </div>
        {applied ? (
          <p className="rounded-sm bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Đang áp dụng: {applied.name} ({applied.discountRate}%)
          </p>
        ) : null}
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" loading={busy} disabled={duplicate}>
          Lưu
        </Button>
      </div>
    </form>
  )
}

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-neutral-950/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-surface p-6 shadow-lg"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-neutral-100"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function OneTimeSecretDialog({
  password,
  onClose,
}: {
  password: string
  onClose: () => void
}) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="one-time-title"
        className="w-full max-w-lg space-y-4 rounded-md border border-line bg-surface p-6 shadow-lg"
      >
        <h2 id="one-time-title" className="text-xl font-semibold text-ink">
          Mật khẩu ban đầu
        </h2>
        <Banner tone="warning">
          Mật khẩu này chỉ hiện một lần. Đóng hộp thoại là không xem lại được; dùng “Đặt lại mật
          khẩu” nếu cần mật khẩu mới.
        </Banner>
        <div className="flex gap-2">
          <input
            aria-label="Mật khẩu ban đầu"
            readOnly
            value={password}
            className="h-12 w-full rounded-sm border border-neutral-200 bg-neutral-50 px-3 font-mono text-ink"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigator.clipboard?.writeText(password)}
          >
            <Copy size={16} /> Sao chép
          </Button>
        </div>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-5 accent-brand-600"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
          />
          Tôi đã lưu
        </label>
        <div className="flex justify-end">
          <Button type="button" disabled={!saved} onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A.3.5 BeforeAfter: the five tuition figures the officer compares before confirming HP-12. */
export function BeforeAfter({ term }: { term: TuitionPreviewTerm }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs text-muted">
          <tr>
            <th className="p-2">Khoản mục</th>
            <th className="p-2 text-right">Trước</th>
            <th className="p-2 text-right">Sau</th>
          </tr>
        </thead>
        <tbody>
          {beforeAfterRows(term).map((row) => (
            <tr key={row.key} className="border-t border-line">
              <td className="p-2 text-ink">{row.label}</td>
              <td className="p-2 text-right text-muted tabular-nums">{formatMoney(row.before)}</td>
              <td className="p-2 text-right tabular-nums">
                <span
                  className={
                    row.delta > 0
                      ? 'text-danger-700'
                      : row.delta < 0
                        ? 'text-success-700'
                        : 'text-ink'
                  }
                >
                  {formatMoney(row.after)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function NoticeDialog({
  title,
  message,
  onClose,
}: {
  title: string
  message: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg space-y-4 rounded-md border border-line bg-surface p-6 shadow-lg"
      >
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <Banner tone="warning">{message}</Banner>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Đã hiểu
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  requireCode,
  busy,
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  requireCode?: string
  busy: boolean
  tone?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const ready = !requireCode || typed === requireCode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg space-y-4 rounded-md border border-line bg-surface p-6 shadow-lg"
      >
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <div className="text-sm text-ink">{message}</div>
        {requireCode ? (
          <Field label="Gõ lại MSSV để xác nhận">
            <Input
              aria-label="Gõ lại MSSV để xác nhận"
              className="font-mono"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={requireCode}
            />
          </Field>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Huỷ
          </Button>
          <Button type="button" variant={tone} disabled={!ready} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
