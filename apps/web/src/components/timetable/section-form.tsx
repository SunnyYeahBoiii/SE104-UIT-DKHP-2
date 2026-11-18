'use client'

import { Plus, Trash2, X } from 'lucide-react'

import { Banner, Button, Field, Input } from '@/components/ui'
import {
  cohortLabel,
  draftFromSection,
  meetingWeeks,
  shiftMeetingWeek,
  type ClashWarning,
  type EditorOptions,
  type EditorSection,
  type MeetingDraft,
  type SectionDraft,
} from '@/lib/timetable'

const TH = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase'
const TD = 'px-3 py-2 text-sm text-ink'
const SELECT = 'h-11 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-sm text-ink'

type Props = {
  open: boolean
  title: string
  draft: SectionDraft
  options: EditorOptions
  sections: EditorSection[]
  termStart: string
  canEdit: boolean
  lockReason: string | null
  warnings: ClashWarning[]
  busy: boolean
  error: string
  onClose: () => void
  onChange: (draft: SectionDraft) => void
  onSave: () => void
  onDelete: () => void
}

export function SectionForm({
  open,
  title,
  draft,
  options,
  sections,
  termStart,
  canEdit,
  lockReason,
  warnings,
  busy,
  error,
  onClose,
  onChange,
  onSave,
  onDelete,
}: Props) {
  if (!open) return null
  const set = <K extends keyof SectionDraft>(key: K, value: SectionDraft[K]) =>
    onChange({ ...draft, [key]: value })
  const setMeeting = (index: number, value: MeetingDraft) =>
    set(
      'meetings',
      draft.meetings.map((meeting, position) => (position === index ? value : meeting)),
    )
  const companion = options.offerings.find((offering) => offering.code === `${draft.courseCode}TH`)
  const showMode = draft.parentCode !== null || companion !== undefined
  const groups = sections.filter((section) => section.parentCode === draft.code)
  const nextGroupNumber =
    Math.max(0, ...groups.map((group) => Number(group.code.split('.').at(-1)) || 0)) + 1

  const addGroup = () => {
    if (!companion) return
    onChange({
      ...draft,
      code: `${draft.code}.${nextGroupNumber}`,
      courseCode: companion.code,
      parentCode: draft.code,
      practiceMode: draft.practiceMode ?? 'SCHEDULED',
      meetings: [],
    })
  }

  const copyGroup = (group: EditorSection) => {
    onChange({
      ...draftFromSection(group),
      code: `${draft.code}.${nextGroupNumber}`,
      meetings: group.meetings.map((meeting) => shiftMeetingWeek(meeting)),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/40" role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-surface shadow-lg"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <Button variant="ghost" aria-label="Đóng form lớp" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>

        <div className="space-y-5 px-6 py-5">
          {!canEdit && lockReason ? <Banner tone="info">{lockReason}</Banner> : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã lớp" hint="Duy nhất trong học kỳ">
              <Input
                aria-label="Mã lớp"
                value={draft.code}
                disabled={!canEdit}
                onChange={(event) => set('code', event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Môn mở">
              <select
                aria-label="Môn mở"
                className={SELECT}
                value={draft.courseCode}
                disabled={!canEdit}
                onChange={(event) => set('courseCode', event.target.value)}
              >
                {options.offerings.map((offering) => (
                  <option key={offering.id} value={offering.code}>
                    {offering.code} · {offering.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hệ đào tạo">
              <select
                aria-label="Hệ đào tạo"
                className={SELECT}
                value={draft.systemCode}
                disabled={!canEdit}
                onChange={(event) => set('systemCode', event.target.value)}
              >
                {options.systems.map((system) => (
                  <option key={system} value={system}>
                    {system}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Giảng viên (có thể trống)">
              <select
                aria-label="Giảng viên"
                className={SELECT}
                value={draft.lecturerCode ?? ''}
                onChange={(event) => set('lecturerCode', event.target.value || null)}
              >
                <option value="">Chưa phân công</option>
                {options.lecturers.map((lecturer) => (
                  <option key={lecturer.code} value={lecturer.code}>
                    {lecturer.code} · {lecturer.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sĩ số tối đa" hint="Không thấp hơn số đã đăng ký">
              <Input
                aria-label="Sĩ số tối đa"
                type="number"
                min={1}
                value={draft.capacity}
                onChange={(event) => set('capacity', Number(event.target.value))}
              />
            </Field>
            <Field label="Khoá dành cho">
              <select
                aria-label="Khoá dành cho"
                className={SELECT}
                value={draft.reservedAdmissionYear ?? ''}
                disabled={!canEdit}
                onChange={(event) =>
                  set(
                    'reservedAdmissionYear',
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Mọi khoá</option>
                {options.cohorts.map((year) => (
                  <option key={year} value={year}>
                    {cohortLabel(year)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ngôn ngữ">
              <Input
                aria-label="Ngôn ngữ"
                value={draft.language ?? ''}
                disabled={!canEdit}
                onChange={(event) => set('language', event.target.value || null)}
              />
            </Field>
            <Field label="Ghi chú">
              <Input
                aria-label="Ghi chú"
                value={draft.note ?? ''}
                disabled={!canEdit}
                onChange={(event) => set('note', event.target.value || null)}
              />
            </Field>
          </div>

          {showMode ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Hình thức thực hành</p>
              <div className="flex gap-2" role="group" aria-label="Hình thức thực hành">
                {(
                  [
                    ['SCHEDULED', 'HT1 · Theo lịch'],
                    ['SELF_SCHEDULED', 'HT2 · Tự xếp lịch'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={draft.practiceMode === value}
                    disabled={!canEdit}
                    onClick={() => set('practiceMode', value)}
                    className={`min-h-11 rounded-sm border px-4 text-sm font-medium ${
                      draft.practiceMode === value
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-line text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <section className="space-y-3" aria-label="Buổi học">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Buổi học</h3>
              {canEdit && draft.practiceMode !== 'SELF_SCHEDULED' ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    set('meetings', [
                      ...draft.meetings,
                      {
                        dayOfWeek: 2,
                        startSlot: 1,
                        endSlot: 2,
                        room: '',
                        startDate: termStart,
                        endDate: termStart,
                        cadence: 1,
                      },
                    ])
                  }
                >
                  <Plus size={16} /> Thêm buổi học
                </Button>
              ) : null}
            </div>
            {draft.practiceMode === 'SELF_SCHEDULED' ? (
              <Banner tone="info">HT2 – tự xếp lịch: nhóm không có buổi học.</Banner>
            ) : null}
            {draft.meetings.map((meeting, index) => {
              const occurrenceWarnings = warnings.filter(
                (warning) =>
                  warning.meetingId ===
                  sections.find((s) => s.code === draft.code)?.meetings[index]?.id,
              )
              return (
                <div key={index} className="space-y-3 rounded-sm border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">Buổi {index + 1}</p>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        aria-label={`Xoá buổi ${index + 1}`}
                        onClick={() =>
                          set(
                            'meetings',
                            draft.meetings.filter((_, position) => position !== index),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Thứ">
                      <select
                        aria-label={`Thứ buổi ${index + 1}`}
                        className={SELECT}
                        value={meeting.dayOfWeek}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setMeeting(index, { ...meeting, dayOfWeek: Number(event.target.value) })
                        }
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map((day) => (
                          <option key={day} value={day}>
                            {day === 8 ? 'Chủ nhật' : `Thứ ${day}`}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tiết bắt đầu">
                      <Input
                        aria-label={`Tiết bắt đầu buổi ${index + 1}`}
                        type="number"
                        min={1}
                        max={10}
                        value={meeting.startSlot}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setMeeting(index, { ...meeting, startSlot: Number(event.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Tiết kết thúc">
                      <Input
                        aria-label={`Tiết kết thúc buổi ${index + 1}`}
                        type="number"
                        min={1}
                        max={10}
                        value={meeting.endSlot}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setMeeting(index, { ...meeting, endSlot: Number(event.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Phòng (có thể trống)">
                      <select
                        aria-label={`Phòng buổi ${index + 1}`}
                        className={SELECT}
                        value={meeting.room}
                        onChange={(event) =>
                          setMeeting(index, { ...meeting, room: event.target.value })
                        }
                      >
                        <option value="">Chưa xếp</option>
                        {options.rooms.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Ngày bắt đầu">
                      <Input
                        aria-label={`Ngày bắt đầu buổi ${index + 1}`}
                        type="date"
                        value={meeting.startDate}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setMeeting(index, { ...meeting, startDate: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Ngày kết thúc">
                      <Input
                        aria-label={`Ngày kết thúc buổi ${index + 1}`}
                        type="date"
                        value={meeting.endDate}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setMeeting(index, { ...meeting, endDate: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Nhịp">
                      <select
                        aria-label={`Nhịp buổi ${index + 1}`}
                        className={SELECT}
                        value={meeting.cadence}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setMeeting(index, {
                            ...meeting,
                            cadence: Number(event.target.value) as 1 | 2,
                          })
                        }
                      >
                        <option value={1}>Mỗi tuần</option>
                        <option value={2}>Cách tuần</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-1" aria-label="Các tuần học">
                    {meetingWeeks(termStart, meeting).map((week) => (
                      <span
                        key={week}
                        className="rounded-sm bg-brand-50 px-2 py-1 text-xs text-brand-800"
                      >
                        T{week}
                      </span>
                    ))}
                  </div>
                  {occurrenceWarnings.map((warning, position) => (
                    <p
                      key={position}
                      className="rounded-sm bg-warning-50 px-3 py-2 text-sm text-warning-700"
                    >
                      {warning.message} (không chặn lưu)
                    </p>
                  ))}
                </div>
              )
            })}
          </section>

          {canEdit && draft.parentCode === null && draft.practiceMode !== null ? (
            <section className="space-y-3" aria-label="Nhóm thực hành">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">Nhóm thực hành ({groups.length})</h3>
                <Button variant="secondary" onClick={addGroup} disabled={!companion}>
                  <Plus size={16} /> Thêm nhóm
                </Button>
              </div>
              {groups.length === 0 ? (
                <p className="text-sm text-muted">Chưa có nhóm thực hành.</p>
              ) : (
                <div className="overflow-x-auto rounded-sm border border-line">
                  <table className="w-full border-collapse">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className={TH}>Nhóm</th>
                        <th className={TH}>Sĩ số</th>
                        <th className={TH}>Giảng viên</th>
                        <th className={TH}>Buổi</th>
                        <th className={TH}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <tr key={group.id} className="border-t border-line">
                          <td className={`${TD} font-mono`}>{group.code}</td>
                          <td className={`${TD} tabular`}>{group.capacity}</td>
                          <td className={TD}>{group.lecturerCode ?? '—'}</td>
                          <td className={`${TD} tabular`}>{group.meetings.length}</td>
                          <td className={TD}>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="link"
                                onClick={() => onChange(draftFromSection(group))}
                              >
                                Sửa nhóm
                              </Button>
                              <Button variant="link" onClick={() => copyGroup(group)}>
                                Sao chép lịch, lùi một tuần
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
          {canEdit ? (
            <Button variant="danger" onClick={onDelete} loading={busy}>
              <Trash2 size={16} /> Xoá lớp
            </Button>
          ) : (
            <span className="text-sm text-muted">Đang ở giai đoạn {lockReason ?? ''}</span>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button onClick={onSave} loading={busy} disabled={draft.code.trim() === ''}>
              Lưu lớp học phần
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
