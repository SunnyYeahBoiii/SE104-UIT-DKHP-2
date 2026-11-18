'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ApiError, api } from '@/lib/auth'
import {
  filterSections,
  secondsSince,
  updatedLabel,
  type MonitorFilter,
  type MonitorResponse,
  type MonitorSection,
  type UnderCreditResponse,
} from '@/lib/monitor'
import type { TermView } from '@/lib/terms'
import { Banner, Card } from '@/components/ui'

const TH = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase'
const TD = 'px-3 py-2 text-sm text-ink'
const FILTERS: { value: MonitorFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'full', label: 'Đã đầy' },
  { value: 'nearFull', label: '≥ 90%' },
  { value: 'small', label: '< 10 sinh viên' },
]

/** C.4.8: one polled read, named filters, inline capacity edits and the post-chốt tab. */
export function RegistrationMonitor() {
  const [terms, setTerms] = useState<TermView[]>([])
  const [termCode, setTermCode] = useState('')
  const [data, setData] = useState<MonitorResponse | null>(null)
  const [under, setUnder] = useState<UnderCreditResponse | null>(null)
  const [tab, setTab] = useState<'sections' | 'under'>('sections')
  const [filter, setFilter] = useState<MonitorFilter>('all')
  const [course, setCourse] = useState('')
  const [system, setSystem] = useState('')
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null)
  const [cellError, setCellError] = useState<{ id: number; message: string } | null>(null)
  const [fetchedAt, setFetchedAt] = useState(new Date().toISOString())
  const [tick, setTick] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void api<{ terms: TermView[] }>('/academics/terms')
      .then((response) => {
        if (!alive) return
        const open = response.terms.filter((term) => term.phase !== 'CLOSED')
        setTerms(open)
        const preferred =
          open.find((term) => term.phase === 'REGISTRATION' || term.phase === 'ADJUSTMENT') ??
          open.find((term) => term.phase === 'IN_PROGRESS') ??
          open[0]
        // Only a default: a late response must never override a term the user already picked.
        if (preferred) setTermCode((current) => current || preferred.code)
      })
      .catch((cause: Error) => {
        if (alive) setError(cause.message)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!termCode) return
    let alive = true
    const load = async () => {
      try {
        const response = await api<MonitorResponse>(`/monitor/${termCode}/sections`)
        if (!alive) return
        setData(response)
        setFetchedAt(new Date().toISOString())
        setError('')
      } catch (cause) {
        if (alive) setError((cause as Error).message)
      }
    }
    void load()
    const timer = setInterval(() => void load(), Math.max(1, data?.pollIntervalSeconds ?? 5) * 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [termCode, data?.pollIntervalSeconds])

  useEffect(() => {
    if (!termCode || tab !== 'under') return
    let alive = true
    void api<UnderCreditResponse>(`/monitor/${termCode}/under-credits`)
      .then((response) => {
        if (alive) setUnder(response)
      })
      .catch((cause: Error) => {
        if (alive) setError(cause.message)
      })
    return () => {
      alive = false
    }
  }, [termCode, tab])

  const courses = [...new Set((data?.sections ?? []).map((section) => section.courseCode))].sort()
  const systems = [...new Set((data?.sections ?? []).map((section) => section.systemCode))].sort()
  const rows = filterSections(data?.sections ?? [], filter, course, system)

  const commit = async (section: MonitorSection) => {
    const draft = editing
    setEditing(null)
    if (!draft || draft.id !== section.id) return
    const capacity = Number(draft.value)
    if (!Number.isInteger(capacity)) {
      setCellError({ id: section.id, message: 'Sĩ số phải là số nguyên.' })
      return
    }
    try {
      const updated = await api<{ capacity: number }>(
        `/monitor/${termCode}/sections/${section.id}/capacity`,
        { method: 'PATCH', body: JSON.stringify({ capacity }) },
      )
      setData((previous) =>
        previous
          ? {
              ...previous,
              sections: previous.sections.map((item) =>
                item.id === section.id
                  ? {
                      ...item,
                      capacity: updated.capacity,
                      fillPercent: Math.min(
                        100,
                        Math.round((item.enrolledCount / updated.capacity) * 100),
                      ),
                    }
                  : item,
              ),
            }
          : previous,
      )
      setCellError(null)
    } catch (cause) {
      const failure = cause as ApiError
      const fields = failure.body?.fieldErrors as Record<string, string> | undefined
      setCellError({
        id: section.id,
        message: fields?.capacity ?? failure.message,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Theo dõi đăng ký</h1>
        <div className="flex items-center gap-3">
          <select
            aria-label="Học kỳ"
            value={termCode}
            onChange={(event) => setTermCode(event.target.value)}
            className="h-11 rounded-sm border border-line bg-surface px-3 text-sm"
          >
            {terms.map((term) => (
              <option key={term.code} value={term.code}>
                {term.code} · {term.phase}
              </option>
            ))}
          </select>
          <span data-testid="updated-ago" role="status" className="text-xs text-muted">
            {updatedLabel(secondsSince(fetchedAt, tick))}
          </span>
        </div>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card>
        <div role="tablist" aria-label="Chế độ xem" className="flex gap-4 border-b border-line">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sections'}
            onClick={() => setTab('sections')}
            className={`min-h-11 border-b-2 px-1 text-sm ${
              tab === 'sections'
                ? 'border-brand-500 font-semibold text-brand-600'
                : 'border-transparent text-muted'
            }`}
          >
            Lớp học phần
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'under'}
            onClick={() => setTab('under')}
            className={`min-h-11 border-b-2 px-1 text-sm ${
              tab === 'under'
                ? 'border-brand-500 font-semibold text-brand-600'
                : 'border-transparent text-muted'
            }`}
          >
            Dưới tín chỉ tối thiểu
          </button>
        </div>

        {tab === 'sections' ? (
          <div role="tabpanel" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={`min-h-11 rounded-sm border px-3 text-sm ${
                    filter === item.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-line text-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <select
                aria-label="Lọc theo môn"
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                className="h-11 rounded-sm border border-line bg-surface px-3 text-sm"
              >
                <option value="">Tất cả môn</option>
                {courses.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                aria-label="Lọc theo hệ"
                value={system}
                onChange={(event) => setSystem(event.target.value)}
                className="h-11 rounded-sm border border-line bg-surface px-3 text-sm"
              >
                <option value="">Tất cả hệ</option>
                {systems.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div role="region" aria-label="Bảng theo dõi đăng ký" className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={TH}>Mã lớp</th>
                    <th className={TH}>Môn</th>
                    <th className={TH}>Hệ</th>
                    <th className={TH}>Giảng viên</th>
                    <th className={TH}>Đã đăng ký / Sĩ số</th>
                    <th className={TH}>Sửa sĩ số</th>
                    <th className={TH}>BB01</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((section) => (
                    <tr key={section.id} className="border-t border-line">
                      <td className={`${TD} font-mono`}>{section.code}</td>
                      <td className={TD}>{section.courseCode}</td>
                      <td className={TD}>{section.systemCode}</td>
                      <td className={TD}>{section.lecturerName ?? '—'}</td>
                      <td className={TD}>
                        <div className="tabular">
                          {section.enrolledCount} / {section.capacity}
                        </div>
                        <div
                          aria-label={`Độ đầy ${section.code}`}
                          className="mt-1 h-1.5 w-28 rounded-sm bg-neutral-100"
                        >
                          <div
                            className={`h-1.5 rounded-sm ${
                              section.fillPercent >= 90 ? 'bg-danger-600' : 'bg-brand-500'
                            }`}
                            style={{ width: `${section.fillPercent}%` }}
                          />
                        </div>
                      </td>
                      <td className={TD}>
                        <input
                          aria-label={`Sĩ số ${section.code}`}
                          type="number"
                          min={1}
                          value={editing?.id === section.id ? editing.value : section.capacity}
                          onFocus={() =>
                            setEditing({ id: section.id, value: String(section.capacity) })
                          }
                          onChange={(event) =>
                            setEditing({ id: section.id, value: event.target.value })
                          }
                          onBlur={() => void commit(section)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void commit(section)
                          }}
                          className="tabular h-9 w-20 rounded-sm border border-line bg-surface px-2 text-sm"
                        />
                        {cellError?.id === section.id ? (
                          <span role="alert" className="ml-2 text-xs text-danger-600">
                            {cellError.message}
                          </span>
                        ) : null}
                      </td>
                      <td className={TD}>
                        <Link
                          aria-label={`BB01 ${section.code}`}
                          href={`/staff/sections/${section.code}?term=${termCode}`}
                          className="text-brand-600 underline"
                        >
                          BB01
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div role="tabpanel" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Cảnh báo sau khi chốt phiếu · tối thiểu {under?.term.minCredits ?? 14} tín chỉ.
              </p>
              <a
                aria-label="Xuất Excel danh sách dưới tín chỉ tối thiểu"
                href={`/api/monitor/${termCode}/under-credits/export`}
                download
                className="min-h-11 rounded-sm bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Xuất Excel
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={TH}>STT</th>
                    <th className={TH}>MSSV</th>
                    <th className={TH}>Họ tên</th>
                    <th className={TH}>Khoá</th>
                    <th className={TH}>Tổng tín chỉ</th>
                  </tr>
                </thead>
                <tbody>
                  {(under?.rows ?? []).map((row) => (
                    <tr key={row.studentCode} className="border-t border-line">
                      <td className={`${TD} tabular`}>{row.stt}</td>
                      <td className={`${TD} font-mono`}>{row.studentCode}</td>
                      <td className={TD}>{row.fullName}</td>
                      <td className={TD}>{row.cohortCode}</td>
                      <td className={`${TD} tabular`}>{row.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(under?.rows ?? []).length === 0 ? (
                <p className="py-4 text-sm text-muted">
                  Không có sinh viên dưới tín chỉ tối thiểu.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
