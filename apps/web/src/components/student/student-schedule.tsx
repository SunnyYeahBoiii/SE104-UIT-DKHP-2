'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { Banner, Button, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import { DAY_LABELS } from '@/lib/registration'
import { SLOT_TIMES, dayDate, type StudentTimetable } from '@/lib/schedule'

const DAYS = [2, 3, 4, 5, 6, 7, 8] as const
const SLOTS = Array.from({ length: 10 }, (_, index) => index + 1)

type Scope = 'current' | 'registering'

export function StudentSchedule() {
  const requested = useSearchParams().get('scope')
  const [scope, setScope] = useState<Scope>(requested === 'registering' ? 'registering' : 'current')
  const [data, setData] = useState<StudentTimetable | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [week, setWeek] = useState(1)
  const [day, setDay] = useState<number>(2)

  useEffect(() => {
    let active = true
    void api<StudentTimetable>(`/registration/timetable?scope=${scope}`)
      .then((response) => {
        if (!active) return
        setData(response)
        setError(null)
        setWeek(1)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được lịch học.')
      })
    return () => {
      active = false
    }
  }, [scope])

  if (error) return <Banner tone="danger">{error}</Banner>
  if (!data)
    return (
      <Card>
        <p className="text-sm text-muted">Đang tải lịch học…</p>
      </Card>
    )
  if (!data.term)
    return (
      <Card>
        <p className="text-sm text-muted">Chưa có học kỳ để hiển thị lịch học.</p>
      </Card>
    )

  const startDate = data.term.startDate
  const selectedDate = dayDate(startDate, week, day)
  const weekDays = DAYS.map((value) => ({ value, date: dayDate(startDate, week, value) }))
  const inWeek = (dayOfWeek: number, date: string) =>
    data.meetings.filter(
      (meeting) => meeting.dayOfWeek === dayOfWeek && meeting.dates.includes(date),
    )
  const daySessions = inWeek(day, selectedDate).sort((a, b) => a.startSlot - b.startSlot)

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Lịch học</h1>
          <p className="mt-1 text-sm text-muted">
            {data.term.name} · <span className="font-mono">{data.term.code}</span>
          </p>
        </div>
        <Button variant="secondary" data-testid="print-timetable" onClick={() => window.print()}>
          <Printer size={16} /> Xuất thời khoá biểu
        </Button>
      </header>

      <div className="print-hide flex flex-wrap gap-2" role="group" aria-label="Chọn học kỳ">
        <button
          type="button"
          aria-pressed={scope === 'current'}
          onClick={() => setScope('current')}
          className={`min-h-11 rounded-sm border px-3 text-sm font-medium ${scope === 'current' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
        >
          Học kỳ đang học
        </button>
        <button
          type="button"
          aria-pressed={scope === 'registering'}
          onClick={() => setScope('registering')}
          className={`min-h-11 rounded-sm border px-3 text-sm font-medium ${scope === 'registering' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
        >
          Học kỳ đang đăng ký
        </button>
      </div>

      <Card>
        <div className="print-hide flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="week-select">
            Tuần học
          </label>
          <select
            id="week-select"
            value={week}
            onChange={(event) => setWeek(Number(event.target.value))}
            className="h-11 rounded-sm border border-neutral-200 bg-surface px-3 text-sm text-ink"
          >
            {Array.from({ length: data.term.weekCount }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                Tuần {value}
              </option>
            ))}
          </select>
        </div>

        <div
          className="print-hide mt-3 flex gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Ngày trong tuần"
        >
          {weekDays.map(({ value, date }) => {
            const count = inWeek(value, date).length
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={day === value}
                aria-label={`${DAY_LABELS[value]} ${date}${count ? `, ${count} buổi` : ''}`}
                onClick={() => setDay(value)}
                className={`min-h-11 min-w-11 shrink-0 rounded-sm border px-2 text-sm font-medium ${day === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-surface text-muted'}`}
              >
                {DAY_LABELS[value]}
                <span
                  className={`mx-auto mt-0.5 block size-1.5 rounded-full ${count ? 'bg-brand-500' : 'bg-transparent'}`}
                />
              </button>
            )
          })}
        </div>

        <ul data-testid="mobile-sessions" className="mt-4 space-y-2 lg:hidden">
          {daySessions.length === 0 ? (
            <li className="rounded-sm bg-neutral-50 p-4 text-sm text-muted">
              {DAY_LABELS[day]} · {selectedDate}: không có buổi học nào.
            </li>
          ) : (
            daySessions.map((meeting) => (
              <li
                key={meeting.id}
                data-testid={`session-${meeting.sectionCode}`}
                className="rounded-sm border border-line p-3"
              >
                <p className="font-mono text-sm font-semibold text-brand-700">
                  {meeting.courseCode} · {meeting.sectionCode}
                </p>
                <p className="mt-1 text-sm text-ink">{meeting.courseName}</p>
                <p className="tabular mt-1 text-xs text-muted">
                  Tiết {meeting.startSlot}–{meeting.endSlot} · {SLOT_TIMES[meeting.startSlot]} ·{' '}
                  {meeting.room || 'Chưa xếp phòng'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {meeting.lecturer ?? 'Chưa phân công'} ·{' '}
                  {meeting.courseType === 'THEORY' ? 'LT' : 'TH'}
                </p>
              </li>
            ))
          )}
        </ul>

        <div className="print-area mt-4 hidden overflow-x-auto lg:block">
          <h2 className="mb-3 text-base font-semibold text-ink">
            BB02 · Thời khoá biểu tuần {week} · {data.term.name}
          </h2>
          <table data-testid="week-grid" className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                <th className="border border-line px-2 py-2 text-xs font-semibold text-muted">
                  Tiết
                </th>
                {weekDays.map(({ value, date }) => (
                  <th
                    key={value}
                    className={`border border-line px-2 py-2 text-center text-xs font-semibold ${date === data.today ? 'bg-brand-50 text-brand-700' : 'text-muted'}`}
                  >
                    {DAY_LABELS[value]}
                    <span className="tabular mt-0.5 block font-normal">{date.slice(5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot}>
                  <th className="tabular border border-line px-2 py-1 text-xs font-medium text-muted">
                    {slot}
                  </th>
                  {weekDays.map(({ value, date }) => {
                    const sessions = inWeek(value, date).filter(
                      (meeting) => meeting.startSlot === slot,
                    )
                    return (
                      <td
                        key={value}
                        className="h-12 min-w-[88px] border border-line px-1 py-1 align-top text-xs"
                      >
                        {sessions.map((meeting) => (
                          <div
                            key={meeting.id}
                            data-testid={`grid-${meeting.sectionCode}`}
                            className="rounded-sm bg-brand-50 px-1 py-0.5 font-mono text-brand-700"
                            title={`${meeting.courseName} · ${meeting.room ?? 'Chưa xếp phòng'}`}
                          >
                            {meeting.sectionCode}
                            <span className="block font-sans text-[10px] text-muted">
                              {meeting.startSlot}–{meeting.endSlot}
                            </span>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.unscheduled.length > 0 ? (
          <section data-testid="unscheduled" className="mt-5 rounded-sm bg-neutral-50 p-3">
            <h2 className="text-sm font-semibold text-ink">Không có lịch cố định</h2>
            <ul className="mt-2 space-y-1">
              {data.unscheduled.map((item) => (
                <li key={item.sectionId} className="text-xs text-muted">
                  <span className="font-mono">{item.sectionCode}</span> · {item.courseName} ·{' '}
                  {item.practiceMode === 'SELF_SCHEDULED'
                    ? 'Giảng viên và sinh viên tự hẹn lịch'
                    : 'Chưa có buổi học'}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Card>
    </div>
  )
}
