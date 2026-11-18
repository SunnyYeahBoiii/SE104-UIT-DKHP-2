'use client'

import { AlertTriangle, Check, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ApiError, api } from '@/lib/auth'
import {
  formatVn,
  isoFromVnInput,
  vnInputValue,
  type CreditLimits,
  type MilestoneField,
  type SlotView,
  type TermView,
  type TermsResponse,
} from '@/lib/terms'
import { Banner, Button, Card, Field, Input } from '@/components/ui'
import { TermTimeline } from './term-timeline'

const MILESTONES: { field: MilestoneField; label: string }[] = [
  { field: 'registrationStartAt', label: 'Bắt đầu Đăng ký' },
  { field: 'registrationEndAt', label: 'Kết thúc Đăng ký' },
  { field: 'adjustmentStartAt', label: 'Bắt đầu Điều chỉnh' },
  { field: 'adjustmentEndAt', label: 'Kết thúc Điều chỉnh' },
  { field: 'tuitionDeadline', label: 'Hạn đóng học phí' },
]

const PHASE_LABELS: Record<string, string> = {
  PREPARATION: 'Chuẩn bị',
  REGISTRATION: 'Đăng ký',
  ADJUSTMENT: 'Điều chỉnh',
  IN_PROGRESS: 'Đang học',
  CLOSED: 'Kết thúc',
}

const TYPE_LABELS: Record<string, string> = { FIRST: 'HK1', SECOND: 'HK2', SUMMER: 'HK hè' }

type Preview = {
  ok: boolean
  issues: { code: string; message: string; fields: string[] }[]
  fieldErrors: Record<string, string>
  invalidRanges: { startAt: string; endAt: string }[]
}

type SlotDraft = { id?: number; startAt: string; endAt: string; cohortIds: number[] }

function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return (error.body.fieldErrors as Record<string, string> | undefined) ?? {}
}

export function TermsPage({ initialCode }: { initialCode?: string }) {
  const [data, setData] = useState<TermsResponse | null>(null)
  const [selectedCode, setSelectedCode] = useState(initialCode ?? '')
  const [draftState, setDraftState] = useState<{
    code: string
    values: Record<MilestoneField, string>
  } | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{
    tone: 'info' | 'warning' | 'danger'
    text: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [editLimits, setEditLimits] = useState(false)
  const [limits, setLimits] = useState<CreditLimits | null>(null)
  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const reload = async () => {
    const response = await api<TermsResponse>('/academics/terms')
    setData(response)
    return response
  }

  useEffect(() => {
    void api<TermsResponse>('/academics/terms')
      .then((response) => {
        setData(response)
        if (!initialCode)
          setSelectedCode(
            response.terms.find((term) => term.phase === 'REGISTRATION')?.code ??
              response.terms[0]?.code ??
              '',
          )
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu.'),
      )
  }, [initialCode])

  const term = useMemo(
    () => data?.terms.find((item) => item.code === selectedCode),
    [data, selectedCode],
  )
  // Keep edits keyed by term instead of copying server state in an effect: switching terms simply
  // falls back to that term's saved milestones.
  const draft = draftState?.code === selectedCode ? draftState.values : (term?.milestones ?? null)

  const selectTerm = (code: string) => {
    setSelectedCode(code)
    setDraftState(null)
    setPreview(null)
    setServerErrors({})
    setBanner(null)
    setSlotDraft(null)
  }

  useEffect(() => {
    if (!selectedCode || !draft) return
    let stale = false
    void api<Preview>(`/academics/terms/${selectedCode}/milestones/preview`, {
      method: 'POST',
      body: JSON.stringify(draft),
    })
      .then((result) => {
        if (!stale) setPreview(result)
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [selectedCode, draft])

  const grouped = useMemo(() => {
    const years = new Map<number, TermView[]>()
    for (const item of data?.terms ?? []) {
      const list = years.get(item.startYear) ?? []
      list.push(item)
      years.set(item.startYear, list)
    }
    return [...years.entries()]
  }, [data])

  const changeMilestone = (field: MilestoneField, value: string) => {
    if (!draft) return
    try {
      setDraftState({ code: selectedCode, values: { ...draft, [field]: isoFromVnInput(value) } })
    } catch {
      setBanner({ tone: 'danger', text: 'Thời điểm không hợp lệ.' })
    }
  }

  const saveMilestones = async () => {
    if (!term || !draft) return
    setSaving(true)
    setServerErrors({})
    setBanner(null)
    try {
      await api(`/academics/terms/${term.code}/milestones`, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      })
      await reload()
      setDraftState(null)
      setBanner({ tone: 'info', text: 'Đã lưu mốc thời gian; nhật ký kiểm toán đã ghi nhận.' })
    } catch (error) {
      setServerErrors(fieldErrorsFrom(error))
      setBanner({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Không lưu được mốc thời gian.',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveLimits = async () => {
    if (!limits) return
    setSaving(true)
    try {
      const result = await api<{ appliedTo: string[] }>('/academics/credit-limits', {
        method: 'PUT',
        body: JSON.stringify(limits),
      })
      await reload()
      setEditLimits(false)
      setBanner({
        tone: 'info',
        text: `Giá trị mới áp cho học kỳ đang Chuẩn bị: ${result.appliedTo.join(', ') || 'không có'}. Học kỳ đã mở đăng ký giữ giá trị cũ.`,
      })
    } catch (error) {
      setBanner({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Không lưu được giới hạn tín chỉ.',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveSlot = async () => {
    if (!term || !slotDraft) return
    setSaving(true)
    try {
      const body = JSON.stringify({
        startAt: slotDraft.startAt,
        endAt: slotDraft.endAt,
        cohortIds: slotDraft.cohortIds,
      })
      await api(
        slotDraft.id
          ? `/academics/terms/${term.code}/slots/${slotDraft.id}`
          : `/academics/terms/${term.code}/slots`,
        {
          method: slotDraft.id ? 'PATCH' : 'POST',
          body,
        },
      )
      await reload()
      setSlotDraft(null)
      setBanner({ tone: 'info', text: 'Đã lưu khung giờ đăng ký.' })
    } catch (error) {
      setServerErrors(fieldErrorsFrom(error))
      setBanner({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Không lưu được khung giờ.',
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteSlot = async (id: number) => {
    if (!term) return
    try {
      await api(`/academics/terms/${term.code}/slots/${id}`, { method: 'DELETE' })
      await reload()
      setBanner({ tone: 'info', text: 'Đã xoá khung giờ.' })
    } catch (error) {
      setBanner({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Không xoá được khung giờ.',
      })
    }
  }

  const openSlot = (slot?: SlotView) => {
    setServerErrors({})
    setSlotDraft(
      slot
        ? {
            id: slot.id,
            startAt: isoFromVnInput(vnInputValue(slot.startAt)),
            endAt: isoFromVnInput(vnInputValue(slot.endAt)),
            cohortIds: [...slot.cohortIds],
          }
        : {
            startAt: isoFromVnInput(
              vnInputValue(term?.milestones.registrationStartAt ?? new Date().toISOString()),
            ),
            endAt: isoFromVnInput(
              vnInputValue(term?.milestones.registrationEndAt ?? new Date().toISOString()),
            ),
            cohortIds: [],
          },
    )
  }

  const changeSlotTime = (field: 'startAt' | 'endAt', value: string) => {
    if (!slotDraft || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return
    setSlotDraft({ ...slotDraft, [field]: isoFromVnInput(value) })
  }

  if (loadError) return <Banner tone="danger">{loadError}</Banner>
  if (!data || !term || !draft)
    return (
      <Card>
        <p className="text-sm text-muted">Đang tải học kỳ…</p>
      </Card>
    )

  const errors = { ...(preview?.fieldErrors ?? {}), ...serverErrors }
  const invalidRanges = preview?.invalidRanges ?? []
  const cohortCode = (id: number) =>
    data.cohorts.find((cohort) => cohort.id === id)?.code ?? String(id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Học kỳ và khung giờ</h1>
          <p className="mt-1 text-sm text-muted">
            Năm học và học kỳ là dữ liệu nền. Giai đoạn chuyển tự động theo mốc thời gian.
          </p>
        </div>
        <span className="rounded-sm border border-line bg-surface px-3 py-2 text-xs text-muted">
          Bây giờ: {formatVn(data.now)} · giờ Việt Nam
        </span>
      </div>

      {banner ? <Banner tone={banner.tone}>{banner.text}</Banner> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Giới hạn tín chỉ</h2>
            <p className="text-sm text-muted">
              Tối thiểu {data.creditLimits.minCredits} · tối đa học kỳ chính{' '}
              {data.creditLimits.mainTermMaxCredits} · tối đa hè{' '}
              {data.creditLimits.summerMaxCredits}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setLimits({ ...data.creditLimits })
              setEditLimits(true)
            }}
          >
            <Pencil size={16} /> Sửa
          </Button>
        </div>
        {editLimits && limits ? (
          <div
            role="dialog"
            aria-label="Sửa giới hạn tín chỉ"
            className="mt-4 space-y-4 rounded-md border border-brand-200 bg-brand-50 p-4"
          >
            <p className="text-sm text-brand-900">
              Giá trị mới áp cho các học kỳ đang ở Chuẩn bị:{' '}
              {data.terms
                .filter((item) => item.phase === 'PREPARATION')
                .map((item) => `${TYPE_LABELS[item.type]} ${item.startYear}–${item.startYear + 1}`)
                .join(', ') || 'không có'}
              . Học kỳ đã mở đăng ký giữ giá trị cũ.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tối thiểu học kỳ chính">
                <Input
                  type="number"
                  aria-label="Tín chỉ tối thiểu"
                  value={limits.minCredits}
                  onChange={(event) =>
                    setLimits({ ...limits, minCredits: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Tối đa học kỳ chính">
                <Input
                  type="number"
                  aria-label="Tín chỉ tối đa học kỳ chính"
                  value={limits.mainTermMaxCredits}
                  onChange={(event) =>
                    setLimits({ ...limits, mainTermMaxCredits: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Tối đa học kỳ hè">
                <Input
                  type="number"
                  aria-label="Tín chỉ tối đa học kỳ hè"
                  value={limits.summerMaxCredits}
                  onChange={(event) =>
                    setLimits({ ...limits, summerMaxCredits: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void saveLimits()} loading={saving}>
                <Check size={16} /> Lưu
              </Button>
              <Button variant="ghost" onClick={() => setEditLimits(false)}>
                <X size={16} /> Hủy
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold text-ink">Danh sách học kỳ</h2>
          <div className="space-y-4">
            {grouped.map(([year, items]) => (
              <div key={year}>
                <p className="mb-2 text-xs font-semibold text-muted uppercase">
                  {year}–{year + 1}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.code}>
                      <button
                        type="button"
                        onClick={() => selectTerm(item.code)}
                        aria-current={item.code === term.code ? 'true' : undefined}
                        className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm ${item.code === term.code ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink hover:bg-neutral-50'}`}
                      >
                        <span className="font-mono">
                          {item.code} · {TYPE_LABELS[item.type]}
                        </span>
                        <span className="text-xs text-muted">{PHASE_LABELS[item.phase]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                {TYPE_LABELS[term.type]} {term.startYear}–{term.startYear + 1}{' '}
                <span className="font-mono text-muted">{term.code}</span>
              </h2>
              <span className="rounded-sm bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                {PHASE_LABELS[term.phase]}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Giới hạn tín chỉ của học kỳ: {term.minCredits} / {term.maxCredits} (chỉ đọc).
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {MILESTONES.map(({ field, label }) => {
                const locked = !term.editable[field]
                const tip = locked
                  ? field.endsWith('StartAt') &&
                    !term.editable[field.replace('StartAt', 'EndAt') as MilestoneField]
                    ? 'Khoảng đã kết thúc, không sửa được.'
                    : 'Đã bắt đầu, chỉ sửa được ngày kết thúc.'
                  : null
                return (
                  <Field key={field} label={label}>
                    <div className="relative">
                      <Input
                        type="datetime-local"
                        aria-label={label}
                        value={vnInputValue(draft[field])}
                        disabled={locked}
                        onChange={(event) => changeMilestone(field, event.target.value)}
                        className={errors[field] ? 'border-danger-600' : ''}
                      />
                      {tip ? (
                        <span title={tip} className="absolute top-3 right-3 text-danger-600">
                          <Lock size={16} role="img" aria-label={tip} />
                        </span>
                      ) : null}
                    </div>
                    {errors[field] ? (
                      <span role="alert" className="text-xs text-danger-700">
                        {errors[field]}
                      </span>
                    ) : null}
                  </Field>
                )
              })}
            </div>

            {preview?.issues.some((issue) => issue.code === 'TERM_OVERLAP') ? (
              <div className="mt-4">
                <Banner tone="danger">
                  {preview.issues.find((issue) => issue.code === 'TERM_OVERLAP')?.message}
                </Banner>
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => void saveMilestones()}
                disabled={preview?.ok === false}
                loading={saving}
              >
                Lưu mốc thời gian
              </Button>
              <span className="text-xs text-muted">Giá trị mới không được ở quá khứ.</span>
            </div>

            <div className="mt-6 border-t border-line pt-4">
              <TermTimeline
                now={data.now}
                milestones={draft}
                editable={term.editable}
                slots={term.slots}
                invalidRanges={invalidRanges}
              />
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">Khung giờ đăng ký</h2>
                <p className="text-xs text-muted">
                  Giai đoạn Điều chỉnh mở cho mọi khoá; khung giờ chỉ chia trong Đăng ký.
                </p>
              </div>
              <Button variant="secondary" onClick={() => openSlot()}>
                <Plus size={16} /> Thêm khung giờ
              </Button>
            </div>

            {term.cohortsWithoutSlots.length > 0 ? (
              <div className="mt-3">
                <Banner tone="warning">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={16} /> Khoá chưa có khung giờ:{' '}
                    {term.cohortsWithoutSlots.map(cohortCode).join(', ')}.
                  </span>
                </Banner>
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-2">Khoá</th>
                    <th>Thời gian (giờ VN)</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {term.slots.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted">
                        Chưa có khung giờ nào.
                      </td>
                    </tr>
                  ) : (
                    term.slots.map((slot) => (
                      <tr key={slot.id} className="border-t border-line">
                        <td className="py-2 font-medium">
                          {slot.cohortIds.map(cohortCode).join(', ')}
                        </td>
                        <td className="tabular py-2">
                          {formatVn(slot.startAt)} – {formatVn(slot.endAt)}
                        </td>
                        <td className="py-2 text-xs text-muted">
                          {slot.state === 'UPCOMING'
                            ? 'Chưa bắt đầu'
                            : slot.state === 'ONGOING'
                              ? 'Đang diễn ra'
                              : 'Đã kết thúc'}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              aria-label={`Sửa khung ${slot.name}`}
                              disabled={slot.state === 'PAST'}
                              onClick={() => openSlot(slot)}
                              className="text-brand-700 disabled:opacity-40"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Xoá khung ${slot.name}`}
                              disabled={!slot.canDelete}
                              onClick={() => void deleteSlot(slot.id)}
                              className="text-danger-600 disabled:opacity-40"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {slotDraft ? (
              <div
                role="dialog"
                aria-label="Khung giờ đăng ký"
                className="mt-4 space-y-4 rounded-md border border-brand-200 bg-neutral-25 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bắt đầu (giờ VN)">
                    <Input
                      type="datetime-local"
                      aria-label="Bắt đầu khung giờ"
                      value={vnInputValue(slotDraft.startAt)}
                      onChange={(event) => changeSlotTime('startAt', event.target.value)}
                    />
                  </Field>
                  <Field label="Kết thúc (giờ VN)">
                    <Input
                      type="datetime-local"
                      aria-label="Kết thúc khung giờ"
                      value={vnInputValue(slotDraft.endAt)}
                      onChange={(event) => changeSlotTime('endAt', event.target.value)}
                    />
                  </Field>
                </div>
                {errors.cohortIds || errors.startAt || errors.endAt ? (
                  <p role="alert" className="text-xs text-danger-700">
                    {errors.cohortIds ?? errors.startAt ?? errors.endAt}
                  </p>
                ) : null}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink">Khoá tuyển sinh</legend>
                  <div className="flex flex-wrap gap-3">
                    {data.cohorts.map((cohort) => (
                      <label key={cohort.id} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          aria-label={`Khoá ${cohort.code}`}
                          checked={slotDraft.cohortIds.includes(cohort.id)}
                          onChange={(event) =>
                            setSlotDraft({
                              ...slotDraft,
                              cohortIds: event.target.checked
                                ? [...slotDraft.cohortIds, cohort.id]
                                : slotDraft.cohortIds.filter((id) => id !== cohort.id),
                            })
                          }
                        />
                        {cohort.code}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex gap-2">
                  <Button onClick={() => void saveSlot()} loading={saving}>
                    Lưu khung giờ
                  </Button>
                  <Button variant="ghost" onClick={() => setSlotDraft(null)}>
                    <X size={16} /> Hủy
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}
