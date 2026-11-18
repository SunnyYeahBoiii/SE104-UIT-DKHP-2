'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Clock3, Search, X } from 'lucide-react'

import { Banner, Button, Card, Input } from '@/components/ui'
import { api } from '@/lib/auth'
import {
  ATTEMPT_LABELS,
  DAY_LABELS,
  PHASE_LABELS,
  formatCountdown,
  isPracticeGroup,
  PRACTICE_MODE_LABELS,
  retakeSplitHint,
  sectionDays,
  type FormRow,
  type RegistrationOverview,
  type RegistrationResult,
} from '@/lib/registration'

type Filters = {
  q: string
  available: boolean
  day: number | null
  courseType: string
  reserved: boolean
}

const EMPTY_FILTERS: Filters = {
  q: '',
  available: false,
  day: null,
  courseType: '',
  reserved: false,
}

function queryOf(filters: Filters): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.available) params.set('available', 'true')
  if (filters.day) params.set('day', String(filters.day))
  if (filters.courseType) params.set('courseType', filters.courseType)
  if (filters.reserved) params.set('reserved', 'true')
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function RegistrationPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [data, setData] = useState<RegistrationOverview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [results, setResults] = useState<RegistrationResult[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<FormRow | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [nowMs, setNowMs] = useState(0)
  const keyRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    const load = () => {
      void api<RegistrationOverview>(`/registration${queryOf(filters)}`)
        .then((response) => {
          if (active) {
            setData(response)
            setNowMs(Date.parse(response.now))
            setLoadError(null)
          }
        })
        .catch((error: unknown) => {
          if (active)
            setLoadError(error instanceof Error ? error.message : 'Không tải được danh sách lớp.')
        })
    }
    load()
    const timer = setInterval(load, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [filters, reloadToken])

  useEffect(() => {
    const timer = setInterval(() => setNowMs((value) => value + 1000), 1000)
    return () => clearInterval(timer)
  }, [])

  const refresh = () => setReloadToken((value) => value + 1)
  const canWrite = data?.permission.state === 'OPEN'
  const selectedSections = (data?.sections ?? []).filter((section) => selected.includes(section.id))
  const selectedCredits = selectedSections.reduce((sum, section) => sum + section.credits, 0)
  const countdown = data?.permission.countdownTo
    ? formatCountdown(Date.parse(data.permission.countdownTo) - nowMs)
    : null

  const toggle = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const submit = async () => {
    if (selected.length === 0 || !canWrite) return
    keyRef.current ??= crypto.randomUUID()
    setSubmitting(true)
    setNotice(null)
    try {
      const response = await api<{ results: RegistrationResult[] }>('/registration/requests', {
        method: 'POST',
        headers: { 'Idempotency-Key': keyRef.current },
        body: JSON.stringify({ sectionIds: selected }),
      })
      keyRef.current = null
      setResults(response.results)
      const wins = response.results.filter((result) => result.ok).length
      setNotice(`Đã đăng ký ${wins}/${response.results.length} lớp.`)
      setSelected([])
      refresh()
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `${error.message} Đã giữ khoá chống lặp; bấm lại sẽ không đăng ký trùng.`
          : 'Không gửi được đăng ký. Vui lòng thử lại.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    setNotice(null)
    try {
      const response = await api<{ cancelledEnrollments: { sectionCode: string }[] }>(
        `/registration/enrollments/${cancelTarget.id}/cancel`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      )
      setNotice(
        `Đã huỷ ${response.cancelledEnrollments.length} dòng, gồm ${cancelTarget.sectionCode}. Chỗ đã được trả ngay.`,
      )
      setCancelTarget(null)
      refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không huỷ được lớp.')
    } finally {
      setCancelling(false)
    }
  }

  if (loadError) return <Banner tone="danger">{loadError}</Banner>
  if (!data)
    return (
      <Card>
        <p className="text-sm text-muted">Đang tải danh sách lớp…</p>
      </Card>
    )

  const full = (section: (typeof data.sections)[number]) => section.remaining === 0
  const retakeHint = retakeSplitHint(data.sections)

  return (
    <div className="space-y-5 pb-32">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-ink">Đăng ký học phần</h1>
          {data.term ? (
            <span className="rounded-sm bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
              {PHASE_LABELS[data.term.phase] ?? data.term.phase}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {data.term ? `${data.term.name} · ` : ''}
          <span className="font-mono">{data.term?.code ?? ''}</span> ·{' '}
          {data.student.trainingSystemName}{' '}
          <span className="font-mono">{data.student.trainingSystemCode}</span>
        </p>
      </header>

      <Banner
        tone={canWrite ? 'info' : 'warning'}
        action={
          countdown ? (
            <span
              data-testid="countdown"
              className="tabular inline-flex items-center gap-1 font-mono"
            >
              <Clock3 size={16} /> {countdown}
            </span>
          ) : null
        }
      >
        <span data-testid="permission-message">{data.permission.message}</span>
      </Banner>

      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {retakeHint ? <Banner tone="info">{retakeHint}</Banner> : null}

      {results && results.length > 0 ? (
        <Card>
          <h2 className="text-base font-semibold text-ink">Kết quả từng lớp</h2>
          <ul className="mt-3 space-y-2">
            {results.map((result) => (
              <li
                key={result.sectionId}
                data-testid={`result-${result.code ?? 'ok'}`}
                className={`rounded-sm border p-3 text-sm ${result.ok ? 'border-success-600/30 bg-success-50 text-success-700' : 'border-danger-600/30 bg-danger-50 text-danger-700'}`}
              >
                <span className="font-semibold">
                  {result.ok ? (
                    <Check size={16} className="mr-1 inline" />
                  ) : (
                    <X size={16} className="mr-1 inline" />
                  )}
                  {result.sectionCode}
                </span>
                {result.message ? <span className="mt-1 block">{result.message}</span> : null}
                {result.exit ? (
                  <span className="mt-1 block text-xs font-medium">Lối ra: {result.exit}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-ink">Môn mở trong kỳ</h2>
        <p className="mt-1 text-xs text-muted">
          Lớp LT và nhóm thực hành là hai dòng riêng. Huỷ một trong hai thì huỷ luôn cái kia.
        </p>
        <div className="mt-3 grid gap-3">
          <div className="relative">
            <Search size={18} className="absolute top-3.5 left-3 text-muted" />
            <Input
              aria-label="Tìm mã hoặc tên môn"
              placeholder="Tìm mã hoặc tên môn"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={filters.available}
              onClick={() => setFilters({ ...filters, available: !filters.available })}
              className={`min-h-11 rounded-sm border px-3 text-sm font-medium ${filters.available ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
            >
              Còn chỗ
            </button>
            <button
              type="button"
              aria-pressed={filters.courseType === 'THEORY'}
              onClick={() =>
                setFilters({
                  ...filters,
                  courseType: filters.courseType === 'THEORY' ? '' : 'THEORY',
                })
              }
              className={`min-h-11 rounded-sm border px-3 text-sm font-medium ${filters.courseType === 'THEORY' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
            >
              LT
            </button>
            <button
              type="button"
              aria-pressed={filters.courseType === 'PRACTICE'}
              onClick={() =>
                setFilters({
                  ...filters,
                  courseType: filters.courseType === 'PRACTICE' ? '' : 'PRACTICE',
                })
              }
              className={`min-h-11 rounded-sm border px-3 text-sm font-medium ${filters.courseType === 'PRACTICE' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
            >
              TH
            </button>
            <button
              type="button"
              aria-pressed={filters.reserved}
              onClick={() => setFilters({ ...filters, reserved: !filters.reserved })}
              className={`min-h-11 rounded-sm border px-3 text-sm font-medium ${filters.reserved ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
            >
              Dành cho Khoá {data.student.cohortCode.replace(/^K/, '')}
            </button>
            {Object.entries(DAY_LABELS).map(([day, label]) => (
              <button
                key={day}
                type="button"
                aria-pressed={filters.day === Number(day)}
                onClick={() =>
                  setFilters({ ...filters, day: filters.day === Number(day) ? null : Number(day) })
                }
                className={`min-h-11 min-w-11 rounded-sm border px-2 text-sm font-medium ${filters.day === Number(day) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {data.sections.length === 0 ? (
          <p className="mt-4 rounded-sm bg-neutral-50 p-4 text-sm text-muted">
            Không có lớp phù hợp. Thử đổi bộ lọc hoặc tìm tên môn khác.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.sections.map((section) => {
              const group = isPracticeGroup(section)
              const parent = group
                ? data.sections.find((item) => item.id === section.parentSectionId)
                : undefined
              const mode = parent?.practiceMode ?? section.practiceMode
              const chosen = selected.includes(section.id)
              const disabled = !canWrite || full(section) || section.registered
              const percent = section.capacity
                ? Math.round((section.enrolledCount / section.capacity) * 100)
                : 0
              return (
                <li
                  key={section.id}
                  data-testid={`section-${section.code}`}
                  className={`rounded-md border p-4 ${group ? 'ml-2 border-l-2 border-brand-200' : ''} ${chosen ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-brand-700">
                        {section.courseCode}
                        <span className="text-muted"> · {section.code}</span>
                      </p>
                      <p className="text-sm font-medium text-ink">{section.courseName}</p>
                      {group || mode ? (
                        <p className="mt-1 text-xs font-medium text-brand-700">
                          {group ? 'Nhóm thực hành · ' : 'Có nhóm thực hành · '}
                          {PRACTICE_MODE_LABELS[mode ?? ''] ?? 'Theo lịch'}
                        </p>
                      ) : null}
                    </div>
                    <span className="tabular rounded-sm bg-neutral-50 px-2 py-1 text-xs text-muted">
                      {section.credits} TC · {ATTEMPT_LABELS[section.attemptType]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {sectionDays(section)} · {section.lecturer ?? 'Chưa phân công'}
                    {section.language ? ` · ${section.language}` : ''}
                  </p>
                  {section.reservedAdmissionYear ? (
                    <p className="mt-1 text-xs text-muted">
                      Dành cho khoá {section.reservedAdmissionYear}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="tabular text-xs text-muted">
                      Còn {section.remaining}/{section.capacity}
                    </span>
                  </div>
                  {full(section) || section.registered ? (
                    <p className="mt-2 text-xs font-semibold text-warning-700">
                      {full(section) ? 'Đã đầy' : 'Đã đăng ký · ' + section.code}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Chọn lớp ${section.code}`}
                    aria-pressed={chosen}
                    disabled={disabled}
                    onClick={() => toggle(section.id)}
                    className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold ${chosen ? 'bg-brand-700 text-white' : 'border border-brand-200 bg-surface text-brand-700'} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {chosen ? <Check size={16} /> : null}
                    {chosen ? 'Đã chọn' : 'Chọn lớp'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Phiếu đăng ký học phần</h2>
          <span data-testid="credit-total" className="tabular text-sm font-semibold text-brand-700">
            {data.form.totalCredits}/{data.form.maxCredits} tín chỉ
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{
              width: `${Math.min(100, (data.form.totalCredits / Math.max(1, data.form.maxCredits)) * 100)}%`,
            }}
          />
        </div>
        {data.form.rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Bạn chưa đăng ký lớp nào. Tìm môn theo mã hoặc tên để bắt đầu.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.form.rows.map((row) => (
              <li
                key={row.id}
                data-testid={`active-${row.sectionCode}`}
                className="flex items-center justify-between gap-2 rounded-sm border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-ink">{row.sectionCode}</p>
                  <p className="truncate text-xs text-muted">
                    {row.courseName} · {row.credits} TC · {ATTEMPT_LABELS[row.attemptType]}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  aria-label={`Huỷ lớp ${row.sectionCode}`}
                  disabled={!canWrite}
                  onClick={() => setCancelTarget(row)}
                >
                  Huỷ lớp
                </Button>
              </li>
            ))}
          </ul>
        )}
        <details data-testid="cancelled-list" className="mt-4 rounded-sm bg-neutral-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted">
            Đã huỷ ({data.form.cancelled.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.form.cancelled.map((row) => (
              <li
                key={row.id}
                data-testid={`cancelled-${row.sectionCode}`}
                className="text-sm text-muted line-through"
              >
                {row.sectionCode} · {row.courseName}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {selected.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-[720px] px-4">
          <div className="flex items-center justify-between gap-3 rounded-md border border-brand-200 bg-surface p-3 shadow-lg">
            <div className="text-sm">
              <p className="font-semibold text-ink">Đã chọn {selected.length} lớp</p>
              <p className="tabular text-muted">{selectedCredits} tín chỉ</p>
            </div>
            <Button
              aria-label={`Đăng ký ${selected.length} lớp`}
              loading={submitting}
              onClick={() => void submit()}
            >
              Đăng ký {selected.length} lớp
            </Button>
          </div>
        </div>
      ) : null}

      {cancelTarget ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Huỷ lớp"
            className="w-full max-w-md rounded-t-lg bg-surface p-5 shadow-lg sm:rounded-lg"
          >
            <h2 className="text-lg font-semibold text-ink">Huỷ lớp {cancelTarget.sectionCode}?</h2>
            <p className="mt-2 text-sm text-muted">
              Huỷ lớp LT thì huỷ luôn nhóm thực hành con; huỷ nhóm thực hành thì huỷ luôn lớp LT
              cha. Chỗ của cả hai được trả ngay; muốn sang lớp khác bạn phải đăng ký lại.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelTarget(null)}>
                Giữ lại
              </Button>
              <Button
                variant="danger"
                loading={cancelling}
                aria-label="Xác nhận huỷ"
                onClick={() => void cancel()}
              >
                Xác nhận huỷ
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
