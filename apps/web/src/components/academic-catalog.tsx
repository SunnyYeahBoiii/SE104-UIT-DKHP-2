'use client'

import { AlertTriangle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { api, ApiError } from '@/lib/auth'
import { Banner, Button, Card, Field, Input } from './ui'

type PriorityGroup = {
  id: number
  code: string
  name: string
  discountRate: number
  priority: number
  studentCount: number
  duplicatePriority: boolean
}

type Cohort = {
  id: number
  code: string
  admissionYear: number
  studentCount: number
  feeScheduleCount: number
  registrationSlotCount: number
}

type Catalog = { priorityGroups: PriorityGroup[]; cohorts: Cohort[] }
type Tab = 'groups' | 'cohorts'
type Drawer = { kind: 'priorityGroup'; id?: number } | { kind: 'cohort'; id?: number } | null

type FormState = {
  code: string
  name: string
  discountRate: string
  priority: string
  admissionYear: string
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  discountRate: '',
  priority: '',
  admissionYear: '',
}

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted'
const TD = 'px-4 py-3 text-sm text-ink'

export function AcademicCatalog() {
  const [tab, setTab] = useState<Tab>('groups')
  const [catalog, setCatalog] = useState<Catalog>({ priorityGroups: [], cohorts: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setCatalog(await api<Catalog>('/academic-catalog'))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh mục.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const openGroup = (group?: PriorityGroup) => {
    setForm(
      group
        ? {
            code: group.code,
            name: group.name,
            discountRate: String(group.discountRate),
            priority: String(group.priority),
            admissionYear: '',
          }
        : EMPTY_FORM,
    )
    setError('')
    setDrawer({ kind: 'priorityGroup', id: group?.id })
  }

  const openCohort = (cohort?: Cohort) => {
    setForm(
      cohort
        ? {
            code: cohort.code,
            name: '',
            discountRate: '',
            priority: '',
            admissionYear: String(cohort.admissionYear),
          }
        : EMPTY_FORM,
    )
    setError('')
    setDrawer({ kind: 'cohort', id: cohort?.id })
  }

  const save = async () => {
    if (!drawer) return
    const isGroup = drawer.kind === 'priorityGroup'
    const code = form.code.trim()
    const rate = Number(form.discountRate)
    const priority = Number(form.priority)
    const year = Number(form.admissionYear)
    if (!code || (isGroup && !form.name.trim())) {
      setError('Mã và tên không được để trống.')
      return
    }
    if (
      isGroup &&
      (!Number.isInteger(rate) || rate < 0 || rate > 100 || !Number.isInteger(priority))
    ) {
      setError('Tỉ lệ giảm phải là số nguyên từ 0 đến 100; độ ưu tiên phải là số nguyên.')
      return
    }
    if (!isGroup && !Number.isInteger(year)) {
      setError('Năm nhập học phải là số nguyên.')
      return
    }

    const body = isGroup
      ? { code, name: form.name.trim(), discountRate: rate, priority }
      : { code, admissionYear: year }
    const path = isGroup ? 'priority-groups' : 'cohorts'
    setSaving(true)
    try {
      await api(`/academic-catalog/${path}${drawer.id ? `/${drawer.id}` : ''}`, {
        method: drawer.id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      setDrawer(null)
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không lưu được. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (kind: 'priorityGroup' | 'cohort', id: number) => {
    const path = kind === 'priorityGroup' ? 'priority-groups' : 'cohorts'
    try {
      await api(`/academic-catalog/${path}/${id}`, { method: 'DELETE' })
      setError('')
      await load()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không xoá được. Vui lòng thử lại.')
    }
  }

  const duplicates = catalog.priorityGroups.filter((group) => group.duplicatePriority)
  const groupDeletionReason = (group: PriorityGroup) =>
    group.studentCount > 0 ? `Đang có ${group.studentCount} sinh viên thuộc đối tượng này.` : ''
  const cohortDeletionReason = (cohort: Cohort) => {
    const reasons: string[] = []
    if (cohort.studentCount > 0) reasons.push(`${cohort.studentCount} sinh viên`)
    if (cohort.feeScheduleCount > 0) reasons.push(`${cohort.feeScheduleCount} bảng phí`)
    if (cohort.registrationSlotCount > 0) reasons.push(`${cohort.registrationSlotCount} khung giờ`)
    return reasons.length ? `Đang có ${reasons.join(', ')}.` : ''
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Đối tượng ưu tiên và khoá</h1>
          <p className="mt-1 text-sm text-muted">
            Phòng Đào tạo quản lý danh mục dùng để tính học phí và mở đăng ký.
          </p>
        </div>
        <Button
          onClick={() => {
            if (tab === 'groups') openGroup()
            else openCohort()
          }}
        >
          <Plus size={18} /> {tab === 'groups' ? 'Thêm đối tượng' : 'Thêm khoá'}
        </Button>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? <p className="text-sm text-muted">Đang tải…</p> : null}

      {duplicates.length > 0 ? (
        <Banner tone="warning">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} /> Cùng độ ưu tiên:{' '}
            {duplicates.map((group) => group.name).join(', ')}. Chỉ cảnh báo, không chặn lưu.
          </span>
        </Banner>
      ) : null}

      <Card className="p-0">
        <div role="tablist" aria-label="Danh mục" className="flex border-b border-line">
          {(
            [
              ['groups', 'Đối tượng ưu tiên'],
              ['cohorts', 'Khoá tuyển sinh'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value)
                setError('')
              }}
              className={`min-h-12 px-5 text-sm font-semibold ${tab === value ? 'border-b-2 border-brand-600 text-brand-700' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="overflow-x-auto">
          {tab === 'groups' ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Tên đối tượng</th>
                  <th className={TH}>Tỉ lệ giảm</th>
                  <th className={TH}>Độ ưu tiên</th>
                  <th className={TH}>Số sinh viên đang thuộc</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {catalog.priorityGroups.map((group) => {
                  const reason = groupDeletionReason(group)
                  return (
                    <tr key={group.id} className="border-t border-line">
                      <td className={TD}>
                        <span className="font-medium">{group.name}</span>
                        <span className="ml-2 text-xs text-muted">{group.code}</span>
                      </td>
                      <td className={TD}>{group.discountRate}%</td>
                      <td className={TD}>
                        {group.priority}
                        {group.duplicatePriority ? (
                          <span className="ml-2 text-xs text-warning-700">trùng</span>
                        ) : null}
                      </td>
                      <td className={TD}>{group.studentCount}</td>
                      <td className={TD}>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            aria-label={`Sửa ${group.name}`}
                            onClick={() => openGroup(group)}
                          >
                            <Pencil size={16} /> Sửa
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Xoá ${group.name}`}
                            title={reason || 'Xoá đối tượng'}
                            disabled={Boolean(reason)}
                            onClick={() => void remove('priorityGroup', group.id)}
                          >
                            <Trash2 size={16} /> Xoá
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Tên khoá</th>
                  <th className={TH}>Năm nhập học</th>
                  <th className={TH}>Số sinh viên</th>
                  <th className={TH}>Số bảng phí</th>
                  <th className={TH}>Số khung giờ</th>
                  <th className={TH}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {catalog.cohorts.map((cohort) => {
                  const reason = cohortDeletionReason(cohort)
                  return (
                    <tr key={cohort.id} className="border-t border-line">
                      <td className={TD}>
                        <span className="font-medium">{cohort.code}</span>
                      </td>
                      <td className={TD}>{cohort.admissionYear}</td>
                      <td className={TD}>{cohort.studentCount}</td>
                      <td className={TD}>{cohort.feeScheduleCount}</td>
                      <td className={TD}>{cohort.registrationSlotCount}</td>
                      <td className={TD}>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            aria-label={`Sửa khoá ${cohort.code}`}
                            onClick={() => openCohort(cohort)}
                          >
                            <Pencil size={16} /> Sửa
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Xoá khoá ${cohort.code}`}
                            title={reason || 'Xoá khoá'}
                            disabled={Boolean(reason)}
                            onClick={() => void remove('cohort', cohort.id)}
                          >
                            <Trash2 size={16} /> Xoá
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={drawer.kind === 'priorityGroup' ? 'Đối tượng ưu tiên' : 'Khoá tuyển sinh'}
            className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-line bg-surface p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">
                {drawer.id ? 'Sửa' : 'Thêm'}{' '}
                {drawer.kind === 'priorityGroup' ? 'đối tượng ưu tiên' : 'khoá tuyển sinh'}
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

            <Field label={drawer.kind === 'priorityGroup' ? 'Mã đối tượng' : 'Mã khoá'}>
              <Input
                aria-label="Mã"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </Field>

            {drawer.kind === 'priorityGroup' ? (
              <>
                <Field label="Tên đối tượng">
                  <Input
                    aria-label="Tên đối tượng"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </Field>
                <Field
                  label="Tỉ lệ giảm (%)"
                  hint={
                    drawer.id
                      ? 'Không hồi tố. Chỉ áp cho khoản nợ phát sinh sau khi lưu.'
                      : 'Số nguyên từ 0 đến 100.'
                  }
                >
                  <Input
                    aria-label="Tỉ lệ giảm"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form.discountRate}
                    onChange={(event) => setForm({ ...form, discountRate: event.target.value })}
                  />
                </Field>
                <Field label="Độ ưu tiên" hint="Số nguyên; càng cao càng được áp dụng trước.">
                  <Input
                    aria-label="Độ ưu tiên"
                    type="number"
                    step={1}
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  />
                </Field>
              </>
            ) : (
              <Field label="Năm nhập học">
                <Input
                  aria-label="Năm nhập học"
                  type="number"
                  step={1}
                  value={form.admissionYear}
                  onChange={(event) => setForm({ ...form, admissionYear: event.target.value })}
                />
              </Field>
            )}

            <div className="mt-auto flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDrawer(null)}>
                Huỷ
              </Button>
              <Button loading={saving} onClick={() => void save()}>
                Lưu
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
