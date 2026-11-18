'use client'

import { useEffect, useState } from 'react'

import { Banner, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import type { RosterResponse } from '@/lib/monitor'

const TH = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase'
const TD = 'px-3 py-2 text-sm text-ink'

/** C.4.7 / BB01: the class roster with cancelled rows hidden until asked for. */
export function ClassRoster({ termCode, sectionCode }: { termCode: string; sectionCode: string }) {
  const [roster, setRoster] = useState<RosterResponse | null>(null)
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!termCode) return
    let alive = true
    const query = includeCancelled ? '?includeCancelled=true' : ''
    void api<RosterResponse>(`/monitor/${termCode}/roster/${sectionCode}${query}`)
      .then((response) => {
        if (alive) {
          setRoster(response)
          setError('')
        }
      })
      .catch((cause: Error) => {
        if (alive) setError(cause.message)
      })
    return () => {
      alive = false
    }
  }, [termCode, sectionCode, includeCancelled])

  const exportUrl = `/api/monitor/${termCode}/roster/${sectionCode}/export${
    includeCancelled ? '?includeCancelled=true' : ''
  }`

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">
        Danh sách sinh viên · <span className="font-mono">{sectionCode}</span>
      </h1>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted">
            {roster?.section.courseCode ?? '—'} · {roster?.section.courseName ?? ''} · sĩ số{' '}
            {roster?.section.capacity ?? '—'} · đã đăng ký {roster?.section.enrolledCount ?? '—'}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(event) => setIncludeCancelled(event.target.checked)}
              />
              Hiện dòng đã huỷ
            </label>
            <a
              aria-label="Xuất Excel BB01"
              href={exportUrl}
              download
              className="min-h-11 rounded-sm bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Xuất Excel
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="bg-neutral-50">
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>MSSV</th>
                <th className={TH}>Họ tên</th>
                <th className={TH}>Khoá</th>
                <th className={TH}>Hệ đào tạo</th>
                <th className={TH}>Hình thức học</th>
                <th className={TH}>Trạng thái dòng</th>
              </tr>
            </thead>
            <tbody>
              {(roster?.rows ?? []).map((row) => (
                <tr key={`${row.studentCode}-${row.status}`} className="border-t border-line">
                  <td className={`${TD} tabular`}>{row.stt}</td>
                  <td className={`${TD} font-mono`}>{row.studentCode}</td>
                  <td className={TD}>{row.fullName}</td>
                  <td className={TD}>{row.cohortCode}</td>
                  <td className={TD}>{row.systemCode}</td>
                  <td className={TD}>{row.attemptTypeLabel}</td>
                  <td className={TD}>{row.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(roster?.rows ?? []).length === 0 ? (
            <p className="py-4 text-sm text-muted">Không có dòng nào để hiển thị.</p>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
