'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { TermTimeline } from '@/components/terms/term-timeline'
import { Banner, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import type { OverviewResponse } from '@/lib/monitor'
import type { TermsResponse, TermView } from '@/lib/terms'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div data-testid={`stat-${label}`} className="rounded-md border border-line bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="tabular mt-1 text-2xl font-bold text-ink">{value}</div>
    </div>
  )
}

function cardsFor(overview: OverviewResponse): { label: string; value: string | number }[] {
  const stats = overview.stats
  if (stats.phase === 'PREPARATION')
    return [
      { label: 'Thời khoá biểu', value: stats.timetableImported ? 'Đã nhập' : 'Chưa nhập' },
      { label: 'Môn mở', value: stats.offeredCourses },
      { label: 'Lớp', value: stats.sections },
      { label: 'Trùng lịch', value: stats.clashes },
    ]
  if (stats.phase === 'REGISTRATION' || stats.phase === 'ADJUSTMENT')
    return [
      { label: 'Sinh viên đã có phiếu', value: `${stats.studentsWithForm}/${stats.totalStudents}` },
      { label: 'Lớp đầy', value: stats.fullSections },
      { label: 'Lớp dưới 10 sinh viên', value: stats.smallSections },
    ]
  return [{ label: 'Dưới tín chỉ tối thiểu', value: stats.underCredits }]
}

/** C.4.1: where the term stands, what the phase cares about, and today's open work. */
export function StaffOverview() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [term, setTerm] = useState<TermView | null>(null)
  const [inProgress, setInProgress] = useState<TermView[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void Promise.all([
      api<OverviewResponse>('/monitor/overview'),
      api<TermsResponse>('/academics/terms'),
    ])
      .then(([summary, terms]) => {
        if (!alive) return
        setOverview(summary)
        const focus = terms.terms.find((item) => item.code === summary.focusTerm?.code) ?? null
        setTerm(focus)
        setInProgress(terms.terms.filter((item) => item.phase === 'IN_PROGRESS'))
        setError('')
      })
      .catch((cause: Error) => {
        if (alive) setError(cause.message)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Tổng quan</h1>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {term ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">
              Học kỳ {term.code} · {term.phase}
            </h2>
            <Link href={`/staff/terms/${term.code}`} className="text-sm text-brand-600 underline">
              Xem mốc thời gian
            </Link>
          </div>
          <TermTimeline
            now={overview?.now ?? new Date().toISOString()}
            milestones={term.milestones}
            editable={term.editable}
            slots={term.slots}
            invalidRanges={[]}
          />
        </Card>
      ) : null}
      {inProgress.map((item) => (
        <Card key={item.code}>
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Học kỳ đang học {item.code} · {item.phase}
          </h2>
          <TermTimeline
            now={overview?.now ?? new Date().toISOString()}
            milestones={item.milestones}
            editable={item.editable}
            slots={item.slots}
            invalidRanges={[]}
          />
        </Card>
      ))}
      {overview ? (
        <>
          <section
            aria-label="Thống kê theo giai đoạn"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {cardsFor(overview).map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} />
            ))}
          </section>
          <Card>
            <h2 className="mb-3 text-lg font-semibold text-ink">Việc cần xử lý</h2>
            <ul data-testid="staff-todos" className="space-y-3">
              {overview.todos.map((todo) => (
                <li key={todo.key} className="rounded-sm border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={todo.href}
                      className="text-sm font-semibold text-brand-600 underline"
                    >
                      {todo.title}
                    </Link>
                    <span className="tabular rounded-sm bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                      {todo.count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{todo.detail}</p>
                </li>
              ))}
              {overview.todos.length === 0 ? (
                <li className="text-sm text-muted">Không có việc nào tồn đọng.</li>
              ) : null}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  )
}
