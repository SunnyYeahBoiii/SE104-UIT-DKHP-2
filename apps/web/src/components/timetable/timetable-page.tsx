'use client'

import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

import { ScheduleGrid } from '@/components/timetable/schedule-grid'
import { SectionForm } from '@/components/timetable/section-form'
import { Banner, Button, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import {
  cohortLabel,
  fileToBase64,
  MODE_LABELS,
  PHASE_LABELS,
  reportCsv,
  draftFromSection,
  emptyDraft,
  type EditorResponse,
  type EditorSection,
  type ImportIssue,
  type ImportResult,
  type OverviewResponse,
  type PreviewResponse,
  type SectionDraft,
  type TermOption,
} from '@/lib/timetable'

const STEPS = ['Chọn tệp', 'Kiểm tra', 'Xác nhận', 'Kết quả'] as const
const TH = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase'
const TD = 'px-3 py-2 text-sm text-ink'

type TermsResponse = { terms: TermOption[] }

function IssueTable({ issues, tone }: { issues: ImportIssue[]; tone: 'danger' | 'warning' }) {
  if (issues.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-sm border border-line">
      <table className="w-full min-w-[560px] border-collapse">
        <thead className="bg-neutral-50">
          <tr>
            <th className={TH}>Dòng</th>
            <th className={TH}>Cột</th>
            <th className={TH}>Lý do</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={`${issue.row}:${issue.column}:${index}`} className="border-t border-line">
              <td className={`${TD} tabular`}>{issue.row.toLocaleString('vi-VN')}</td>
              <td className={TD}>
                <span
                  className={`rounded-sm px-2 py-1 font-mono text-xs ${
                    tone === 'danger'
                      ? 'bg-danger-50 text-danger-700'
                      : 'bg-warning-50 text-warning-700'
                  }`}
                >
                  {issue.column}
                </span>
              </td>
              <td className={TD}>{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TimetablePage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [terms, setTerms] = useState<TermOption[]>([])
  const [code, setCode] = useState('')
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [step, setStep] = useState(-1)
  const [fileName, setFileName] = useState('')
  const [base64, setBase64] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'offered' | 'sections' | 'schedule'>('offered')
  const [filters, setFilters] = useState({ system: '', course: '', cohort: '', warning: false })
  const [editor, setEditor] = useState<EditorResponse | null>(null)
  const [draft, setDraft] = useState<SectionDraft | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creditsDraft, setCreditsDraft] = useState<Record<number, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [originalCode, setOriginalCode] = useState('')

  useEffect(() => {
    void api<TermsResponse>('/academics/terms')
      .then((data) => {
        setTerms(data.terms)
        const preferred = data.terms.find((term) => term.phase === 'PREPARATION') ?? data.terms[0]
        if (preferred) setCode(preferred.code)
      })
      .catch((cause: Error) => setError(cause.message))
  }, [])

  useEffect(() => {
    if (!code) return
    let cancelled = false
    const load = async () => {
      try {
        const [data, editData] = await Promise.all([
          api<OverviewResponse>(`/timetable/${code}`),
          api<EditorResponse>(`/timetable/${code}/editor`),
        ])
        if (!cancelled) {
          setOverview(data)
          setEditor(editData)
        }
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [code])

  const canImport = overview?.term.canImport ?? false
  const lockReason =
    editor?.term.reason ?? overview?.term.reason ?? 'Chọn một học kỳ để xem thời khoá biểu.'

  const resetImport = () => {
    setStep(-1)
    setFileName('')
    setBase64('')
    setPreview(null)
    setResult(null)
    setConfirmed(false)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const chooseFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Chỉ nhận tệp .xlsx theo mẫu của trường.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const encoded = await fileToBase64(file)
      const data = await api<PreviewResponse>(`/timetable/${code}/preview`, {
        method: 'POST',
        body: JSON.stringify({ fileBase64: encoded, fileName: file.name }),
      })
      setFileName(file.name)
      setBase64(encoded)
      setPreview(data)
      setResult(null)
      setConfirmed(false)
      setStep(data.errors.length > 0 ? 1 : 2)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void chooseFile(file)
  }

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void chooseFile(file)
  }

  const runImport = async () => {
    if (!preview || !base64) return
    setBusy(true)
    setError('')
    try {
      const data = await api<ImportResult>(`/timetable/${code}/import`, {
        method: 'POST',
        body: JSON.stringify({ fileBase64: base64, fileName, confirmReplace: confirmed }),
      })
      setResult(data)
      setStep(3)
      const [fresh, editData] = await Promise.all([
        api<OverviewResponse>(`/timetable/${code}`),
        api<EditorResponse>(`/timetable/${code}/editor`),
      ])
      setOverview(fresh)
      setEditor(editData)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const downloadReport = () => {
    if (!preview) return
    const url = URL.createObjectURL(
      new Blob([reportCsv(preview)], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `bao-cao-loi-tkb-${code}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const editSections = editor?.sections ?? []

  const refreshEditor = async () => {
    const [fresh, editData] = await Promise.all([
      api<OverviewResponse>(`/timetable/${code}`),
      api<EditorResponse>(`/timetable/${code}/editor`),
    ])
    setOverview(fresh)
    setEditor(editData)
  }

  const openSection = (section: EditorSection) => {
    setDraft(draftFromSection(section))
    setEditingId(section.id)
    setOriginalCode(section.code)
    setIsNew(false)
    setDeleteConfirm(false)
    setDrawerOpen(true)
  }

  const openNewSection = () => {
    if (!editor) return
    setDraft(emptyDraft(editor.options))
    setEditingId(null)
    setOriginalCode('')
    setIsNew(true)
    setDeleteConfirm(false)
    setDrawerOpen(true)
  }

  const changeDraft = (next: SectionDraft) => {
    setDraft(next)
    if (next.code !== originalCode) {
      setEditingId(null)
      setIsNew(true)
    }
  }

  const saveSection = async () => {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      if (isNew || editingId === null)
        await api(`/timetable/${code}/sections`, { method: 'POST', body: JSON.stringify(draft) })
      else
        await api(`/timetable/${code}/sections/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(draft),
        })
      await refreshEditor()
      setDrawerOpen(false)
      setDraft(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const deleteSection = async () => {
    if (!draft || editingId === null) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api(`/timetable/${code}/sections/${editingId}`, { method: 'DELETE' })
      await refreshEditor()
      setDrawerOpen(false)
      setDraft(null)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const saveCredits = async (offeringId: number, value: string) => {
    const credits = Number(value)
    if (!Number.isInteger(credits) || credits < 0) {
      setError('Tín chỉ phải là số nguyên không âm.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api(`/timetable/${code}/offered-courses/${offeringId}/credits`, {
        method: 'PATCH',
        body: JSON.stringify({ credits }),
      })
      await refreshEditor()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const sections = editSections
  const systems = [...new Set(sections.map((section) => section.systemCode))].sort()
  const courses = [...new Set(sections.map((section) => section.courseCode))].sort()
  const cohorts = [
    ...new Set(sections.map((section) => section.reservedAdmissionYear).filter((y) => y !== null)),
  ].sort((a, b) => a - b)
  const filtered = sections.filter(
    (section) =>
      (!filters.system || section.systemCode === filters.system) &&
      (!filters.course || section.courseCode === filters.course) &&
      (!filters.cohort || section.reservedAdmissionYear === Number(filters.cohort)) &&
      (!filters.warning || section.hasWarning),
  )

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Thời khoá biểu và lớp</h1>
          <p className="mt-1 text-sm text-muted">
            Nhập thời khoá biểu học kỳ từ tệp Excel của trường; xem môn mở và lớp học phần sau khi
            nhập.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-ink" htmlFor="timetable-term">
            Học kỳ
          </label>
          <select
            id="timetable-term"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setError('')
              resetImport()
            }}
            className="h-11 rounded-sm border border-neutral-200 bg-surface px-3 text-sm text-ink"
          >
            {terms.map((term) => (
              <option key={term.code} value={term.code}>
                {term.code} · {PHASE_LABELS[term.phase]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!canImport && overview ? <Banner tone="warning">{lockReason}</Banner> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Nhập thời khoá biểu</h2>
            <p className="mt-1 text-sm text-muted">
              {overview
                ? `Đã có ${overview.counts.offeredCourses} môn mở · ${overview.counts.sections} lớp · ${overview.counts.meetings} buổi học.`
                : 'Chưa có thời khoá biểu cho học kỳ này.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/tkb-mau.xlsx"
              download
              className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-brand-700 underline hover:text-brand-800"
            >
              <Download size={16} /> Tải tệp mẫu
            </a>
            <Button
              onClick={() => {
                setStep(0)
                setError('')
              }}
              disabled={!canImport}
              title={canImport ? undefined : lockReason}
            >
              <UploadCloud size={18} />
              {overview && overview.counts.sections > 0
                ? 'Nhập lại thời khoá biểu'
                : 'Nhập thời khoá biểu'}
            </Button>
          </div>
        </div>

        {step >= 0 ? (
          <div className="mt-6 space-y-5">
            <ol aria-label="Các bước nhập thời khoá biểu" className="flex flex-wrap gap-2">
              {STEPS.map((label, index) => (
                <li
                  key={label}
                  aria-current={index === step ? 'step' : undefined}
                  className={`rounded-sm border px-3 py-2 text-sm ${
                    index === step
                      ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800'
                      : index < step
                        ? 'border-brand-200 text-brand-700'
                        : 'border-line text-muted'
                  }`}
                >
                  {index + 1}. {label}
                </li>
              ))}
            </ol>

            {step === 0 ? (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-brand-200 bg-brand-50/40 px-6 py-10 text-center"
              >
                <FileSpreadsheet size={36} className="text-brand-600" />
                <p className="font-medium text-ink">Kéo tệp .xlsx vào đây hoặc chọn tệp</p>
                <p className="text-sm text-muted">Theo đúng mẫu thời khoá biểu của trường.</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  aria-label="Chọn tệp Excel thời khoá biểu"
                  onChange={onInput}
                  className="text-sm text-ink"
                />
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setStep(-1)}>
                    Huỷ
                  </Button>
                  <Button
                    onClick={() => setStep(preview && preview.errors.length === 0 ? 2 : 1)}
                    disabled={!preview}
                  >
                    Tiếp tục
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 1 && preview ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-ink">
                  {fileName} · {preview.rowCount.toLocaleString('vi-VN')} dòng ·{' '}
                  <span className="text-danger-700">{preview.errors.length} lỗi</span> ·{' '}
                  <span className="text-warning-700">{preview.warnings.length} cảnh báo</span>
                </p>
                {preview.errors.length > 0 ? (
                  <>
                    <IssueTable issues={preview.errors} tone="danger" />
                    <Banner tone="danger">
                      Nhập theo kiểu tất cả hoặc không: sửa hết lỗi rồi tải lại. Chưa ghi dữ liệu
                      nào.
                    </Banner>
                  </>
                ) : (
                  <Banner tone="info">Tệp hợp lệ. Xem cảnh báo rồi tiếp tục xác nhận.</Banner>
                )}
                {preview.warnings.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium text-ink">Cảnh báo trùng lịch (không chặn nhập)</h3>
                    <IssueTable issues={preview.warnings} tone="warning" />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={downloadReport}>
                    <Download size={16} /> Tải báo cáo lỗi
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    Chọn tệp khác
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={preview.errors.length > 0}>
                    Tiếp tục
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 && preview ? (
              <div className="space-y-4">
                <p className="text-ink">
                  Sẽ tạo {preview.summary?.offeredCourses ?? 0} môn mở,{' '}
                  {preview.summary?.sections ?? 0} lớp, {preview.summary?.practiceGroups ?? 0} nhóm
                  thực hành và {preview.summary?.meetings ?? 0} buổi học.
                </p>
                {preview.errors.length > 0 ? (
                  <Banner tone="danger">
                    Nhập theo kiểu tất cả hoặc không: sửa hết lỗi rồi tải lại.
                  </Banner>
                ) : null}
                {preview.existing.sections > 0 ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Xác nhận thay thời khoá biểu"
                    className="rounded-sm border border-danger-600/40 bg-danger-50 p-4"
                  >
                    <p className="font-medium text-danger-700">
                      Thay toàn bộ {preview.existing.offeredCourses} môn mở và{' '}
                      {preview.existing.sections} lớp hiện có?
                    </p>
                    <label className="mt-3 flex items-center gap-2 text-sm text-danger-700">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      Tôi xác nhận thay toàn bộ thời khoá biểu của học kỳ {code}.
                    </label>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(preview.errors.length > 0 ? 1 : 0)}
                  >
                    Quay lại
                  </Button>
                  <Button
                    onClick={runImport}
                    variant="danger"
                    loading={busy}
                    disabled={
                      preview.errors.length > 0 || (preview.existing.sections > 0 && !confirmed)
                    }
                  >
                    Nhập
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 && result ? (
              <div className="space-y-4">
                <Banner tone="info">
                  Đã nhập thời khoá biểu học kỳ {result.termCode}: {result.counts.offeredCourses}{' '}
                  môn mở, {result.counts.sections} lớp, {result.counts.practiceGroups} nhóm thực
                  hành, {result.counts.meetings} buổi học.
                </Banner>
                {result.warnings.length > 0 ? (
                  <p className="text-sm text-warning-700">
                    {result.warnings.length} cảnh báo trùng phòng/trùng giảng viên (không chặn
                    nhập).
                  </p>
                ) : null}
                <Button onClick={resetImport}>Xem thời khoá biểu</Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {overview && overview.counts.sections > 0 ? (
        <Card>
          <div
            role="tablist"
            aria-label="Bảng thời khoá biểu"
            className="flex gap-2 border-b border-line"
          >
            {(
              [
                ['offered', `Môn mở (${overview.counts.offeredCourses})`],
                ['sections', `Lớp học phần (${overview.counts.sections})`],
                ['schedule', 'Lịch tổng'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`px-4 py-3 text-sm font-medium ${
                  tab === value ? 'border-b-2 border-brand-600 text-brand-700' : 'text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'offered' ? (
            <div role="tabpanel" className="overflow-x-auto pt-4">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={TH}>Mã môn</th>
                    <th className={TH}>Tên môn</th>
                    <th className={TH}>Loại</th>
                    <th className={TH}>Tín chỉ kỳ này</th>
                    <th className={TH}>Mặc định</th>
                    <th className={TH}>Số lớp</th>
                    <th className={TH}>Tổng sĩ số</th>
                  </tr>
                </thead>
                <tbody>
                  {(editor?.options.offerings ?? []).map((course) => (
                    <tr key={course.id} className="border-t border-line">
                      <td className={`${TD} font-mono`}>{course.code}</td>
                      <td className={TD}>{course.name}</td>
                      <td className={TD}>{course.type === 'THEORY' ? 'LT' : 'TH'}</td>
                      <td className={`${TD} tabular font-semibold`}>
                        {editor?.term.canEdit ? (
                          <input
                            aria-label={`Tín chỉ ${course.code}`}
                            type="number"
                            min={0}
                            value={creditsDraft[course.id] ?? String(course.credits)}
                            onChange={(event) =>
                              setCreditsDraft({ ...creditsDraft, [course.id]: event.target.value })
                            }
                            onBlur={(event) => {
                              if (event.target.value !== String(course.credits))
                                void saveCredits(course.id, event.target.value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur()
                            }}
                            className="tabular h-10 w-20 rounded-sm border border-neutral-200 bg-surface px-2 text-sm"
                          />
                        ) : (
                          course.credits
                        )}
                      </td>
                      <td className={`${TD} tabular text-muted`}>{course.defaultCredits}</td>
                      <td className={`${TD} tabular`}>{course.sectionCount}</td>
                      <td className={`${TD} tabular`}>
                        {sections
                          .filter((section) => section.courseCode === course.code)
                          .reduce((sum, section) => sum + section.capacity, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === 'sections' ? (
            <div role="tabpanel" className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={openNewSection}
                  disabled={!editor?.term.canEdit}
                  title={editor?.term.canEdit ? undefined : lockReason}
                >
                  Thêm lớp
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  aria-label="Lọc theo hệ"
                  value={filters.system}
                  onChange={(e) => setFilters({ ...filters, system: e.target.value })}
                  className="h-11 rounded-sm border border-neutral-200 bg-surface px-3 text-sm"
                >
                  <option value="">Tất cả hệ</option>
                  {systems.map((system) => (
                    <option key={system} value={system}>
                      {system}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Lọc theo môn"
                  value={filters.course}
                  onChange={(e) => setFilters({ ...filters, course: e.target.value })}
                  className="h-11 rounded-sm border border-neutral-200 bg-surface px-3 text-sm"
                >
                  <option value="">Tất cả môn</option>
                  {courses.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Lọc theo khoá dành cho"
                  value={filters.cohort}
                  onChange={(e) => setFilters({ ...filters, cohort: e.target.value })}
                  className="h-11 rounded-sm border border-neutral-200 bg-surface px-3 text-sm"
                >
                  <option value="">Tất cả khoá</option>
                  {cohorts.map((year) => (
                    <option key={year} value={year}>
                      {cohortLabel(year)}
                    </option>
                  ))}
                </select>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={filters.warning}
                    onChange={(e) => setFilters({ ...filters, warning: e.target.checked })}
                  />
                  Có cảnh báo
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className={TH}>Mã lớp</th>
                      <th className={TH}>Môn</th>
                      <th className={TH}>Hệ</th>
                      <th className={TH}>Giảng viên</th>
                      <th className={TH}>Sĩ số</th>
                      <th className={TH}>Đã đăng ký</th>
                      <th className={TH}>Khoá dành cho</th>
                      <th className={TH}>Ngôn ngữ</th>
                      <th className={TH}>Buổi học</th>
                      <th className={TH}>Hình thức</th>
                      <th className={TH}>Cảnh báo</th>
                      <th className={TH}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((section) => (
                      <tr key={section.id} className="border-t border-line">
                        <td className={`${TD} font-mono`}>{section.code}</td>
                        <td className={TD}>{section.courseCode}</td>
                        <td className={TD}>{section.systemCode}</td>
                        <td className={TD}>{section.lecturerCode ?? '—'}</td>
                        <td className={`${TD} tabular`}>{section.capacity}</td>
                        <td className={`${TD} tabular`}>{section.enrolledCount}</td>
                        <td className={TD}>{cohortLabel(section.reservedAdmissionYear)}</td>
                        <td className={TD}>{section.language ?? '—'}</td>
                        <td className={`${TD} tabular`}>{section.meetings.length}</td>
                        <td className={TD}>
                          {section.practiceMode ? MODE_LABELS[section.practiceMode] : '—'}
                        </td>
                        <td className={TD}>
                          {section.hasWarning ? (
                            <span
                              title={section.meetings
                                .flatMap((meeting) => meeting.warnings)
                                .map((warning) => warning.message)
                                .join('\n')}
                              className="rounded-sm bg-warning-50 px-2 py-1 text-xs text-warning-700"
                            >
                              Có
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={TD}>
                          <Button variant="link" onClick={() => openSection(section)}>
                            Sửa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    Không có lớp phù hợp bộ lọc.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div role="tabpanel" className="pt-4">
              <ScheduleGrid
                sections={sections}
                rooms={editor?.options.rooms ?? []}
                lecturers={editor?.options.lecturers ?? []}
              />
            </div>
          )}
        </Card>
      ) : null}

      {draft ? (
        <SectionForm
          open={drawerOpen}
          title={isNew ? 'Thêm lớp học phần' : `Sửa lớp ${draft.code}`}
          draft={draft}
          options={
            editor?.options ?? { offerings: [], lecturers: [], rooms: [], systems: [], cohorts: [] }
          }
          sections={sections}
          termStart={editor?.term.startDate ?? ''}
          canEdit={editor?.term.canEdit ?? false}
          lockReason={editor?.term.reason ?? null}
          warnings={
            sections
              .find((section) => section.code === draft.code)
              ?.meetings.flatMap((meeting) => meeting.warnings) ?? []
          }
          busy={saving}
          error={error}
          onClose={() => {
            setDrawerOpen(false)
            setDeleteConfirm(false)
          }}
          onChange={changeDraft}
          onSave={() => void saveSection()}
          onDelete={() => void deleteSection()}
        />
      ) : null}
    </div>
  )
}
