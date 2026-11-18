'use client'

import { useState } from 'react'

import { Card } from '@/components/ui'
import { occursInWeek, type EditorSection } from '@/lib/timetable'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const SELECT = 'h-11 rounded-sm border border-neutral-200 bg-surface px-3 text-sm text-ink'
const TH = 'px-2 py-2 text-center text-xs font-semibold tracking-wide text-muted uppercase'
const TD =
  'h-14 min-w-[90px] border border-line px-1 py-1 text-center text-xs text-ink align-middle'

type Cell = { code: string; clash: boolean }

export function ScheduleGrid({
  sections,
  rooms,
  lecturers,
}: {
  sections: EditorSection[]
  rooms: string[]
  lecturers: { code: string; fullName: string }[]
}) {
  const [by, setBy] = useState<'room' | 'lecturer'>('room')
  const [filter, setFilter] = useState('')
  const [week, setWeek] = useState(1)
  const maxWeek = Math.max(
    1,
    ...sections.flatMap((section) =>
      section.meetings.map((meeting) => {
        let last = 0
        for (let index = 0; index < 31; index++)
          if (occursInWeek(meeting.weeks, index + 1)) last = index + 1
        return last
      }),
    ),
  )
  const keys = by === 'room' ? rooms : lecturers.map((lecturer) => lecturer.code)
  const current = filter || keys[0] || ''

  const cells = (slot: number, day: number): Cell[] =>
    sections.flatMap((section) =>
      section.meetings
        .filter((meeting) => {
          if (!occursInWeek(meeting.weeks, week)) return false
          if (meeting.startSlot > slot || meeting.endSlot < slot || meeting.dayOfWeek !== day)
            return false
          return (by === 'room' ? meeting.room : section.lecturerCode) === current
        })
        .map((meeting) => ({
          code: section.code,
          clash: meeting.warnings.length > 0,
        })),
    )

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-ink">
          Xem theo
          <select
            aria-label="Xem lịch tổng theo"
            className={`${SELECT} ml-2`}
            value={by}
            onChange={(event) => {
              setBy(event.target.value as 'room' | 'lecturer')
              setFilter('')
            }}
          >
            <option value="room">Phòng</option>
            <option value="lecturer">Giảng viên</option>
          </select>
        </label>
        <label className="text-sm font-medium text-ink">
          {by === 'room' ? 'Phòng' : 'Giảng viên'}
          <select
            aria-label={by === 'room' ? 'Chọn phòng' : 'Chọn giảng viên'}
            className={`${SELECT} ml-2`}
            value={current}
            onChange={(event) => setFilter(event.target.value)}
          >
            {keys.map((key) => (
              <option key={key} value={key}>
                {by === 'lecturer'
                  ? `${key} · ${lecturers.find((item) => item.code === key)?.fullName ?? ''}`
                  : key}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-ink">
          Tuần
          <select
            aria-label="Chọn tuần"
            className={`${SELECT} ml-2`}
            value={week}
            onChange={(event) => setWeek(Number(event.target.value))}
          >
            {Array.from({ length: maxWeek }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                Tuần {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              <th className={TH}>Tiết</th>
              {DAYS.map((day) => (
                <th key={day} className={TH}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((slot) => (
              <tr key={slot}>
                <th className={`${TD} font-mono`}>{slot}</th>
                {[2, 3, 4, 5, 6, 7, 8].map((day) => {
                  const items = cells(slot, day)
                  return (
                    <td key={day} className={TD}>
                      {items.map((item, index) => (
                        <div
                          key={`${item.code}:${index}`}
                          title={item.clash ? 'Trùng lịch (cảnh báo, không chặn lưu)' : undefined}
                          className={`truncate rounded-sm px-1 py-0.5 font-mono ${
                            item.clash
                              ? 'bg-danger-50 text-danger-700 line-through'
                              : 'bg-brand-50 text-brand-800'
                          }`}
                        >
                          {item.code}
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
      <p className="mt-3 text-sm text-muted">
        Ô gạch chéo đỏ là buổi trùng phòng hoặc trùng giảng viên; hệ thống chỉ cảnh báo, không chặn
        lưu.
      </p>
    </Card>
  )
}
