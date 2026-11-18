'use client'

import { Lock } from 'lucide-react'

import {
  formatVn,
  percentBetween,
  VN_TIME_ZONE,
  type MilestoneField,
  type SlotView,
} from '@/lib/terms'

type Props = {
  now: string
  milestones: Record<MilestoneField, string>
  editable: Record<MilestoneField, boolean>
  slots: SlotView[]
  invalidRanges: { startAt: string; endAt: string }[]
}

function unlockTip(
  field: MilestoneField,
  editable: Record<MilestoneField, boolean>,
): string | null {
  if (editable[field]) return null
  if (field.endsWith('StartAt') && !editable[field.replace('StartAt', 'EndAt') as MilestoneField])
    return 'Khoảng đã kết thúc, không sửa được.'
  return 'Đã bắt đầu, chỉ sửa được ngày kết thúc.'
}

/** Gantt preview of the milestones and cohort slots. Red hatching marks every range the API rejects. */
export function TermTimeline({ now, milestones, editable, slots, invalidRanges }: Props) {
  const instants = [
    Date.parse(now),
    ...Object.values(milestones).map((value) => Date.parse(value)),
    ...slots.flatMap((slot) => [Date.parse(slot.startAt), Date.parse(slot.endAt)]),
  ]
  const from = Math.min(...instants)
  const to = Math.max(...instants, from + 1)
  const at = (iso: string) =>
    percentBetween(iso, new Date(from).toISOString(), new Date(to).toISOString())
  const bar = (startAt: string, endAt: string) => ({
    left: `${at(startAt)}%`,
    width: `${Math.max(0.7, at(endAt) - at(startAt))}%`,
  })

  const rows: { label: string; startAt: string; endAt: string; tip: string | null }[] = [
    {
      label: 'Đăng ký',
      startAt: milestones.registrationStartAt,
      endAt: milestones.registrationEndAt,
      tip: unlockTip('registrationStartAt', editable),
    },
    {
      label: 'Điều chỉnh',
      startAt: milestones.adjustmentStartAt,
      endAt: milestones.adjustmentEndAt,
      tip: unlockTip('adjustmentStartAt', editable),
    },
  ]

  return (
    <section aria-label="TermTimeline" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">TermTimeline · xem trước</h3>
        <span className="text-xs text-muted">Mọi giờ theo giờ Việt Nam ({VN_TIME_ZONE}).</span>
      </div>
      <div className="relative rounded-md border border-line bg-neutral-25 p-4">
        <div className="mb-3 border-b border-line pb-2 text-xs text-muted">
          <span>{formatVn(new Date(from).toISOString())}</span>
          <span className="float-right">{formatVn(new Date(to).toISOString())}</span>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[100px_1fr] items-center gap-3">
              <span className="text-xs font-medium text-muted">
                {row.label}
                {row.tip ? (
                  <Lock
                    size={12}
                    role="img"
                    aria-label={row.tip}
                    className="ml-1 inline text-danger-600"
                  />
                ) : null}
              </span>
              <div className="relative h-6 rounded-sm bg-neutral-100">
                <div
                  className="absolute inset-y-1 rounded-sm bg-brand-300"
                  style={bar(row.startAt, row.endAt)}
                >
                  <span className="sr-only">{row.label}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <span className="text-xs font-medium text-muted">
              Hạn đóng
              {unlockTip('tuitionDeadline', editable) ? (
                <Lock
                  size={12}
                  role="img"
                  aria-label="Hạn đóng đã qua, không sửa được"
                  className="ml-1 inline text-danger-600"
                />
              ) : null}
            </span>
            <div className="relative h-6 rounded-sm bg-neutral-100">
              <div
                className="absolute inset-y-0 w-0.5 bg-warning-600"
                style={{ left: `${at(milestones.tuitionDeadline)}%` }}
              >
                <span className="sr-only">Hạn đóng học phí</span>
              </div>
            </div>
          </div>
          {slots.map((slot) => (
            <div key={slot.id} className="grid grid-cols-[100px_1fr] items-center gap-3">
              <span className="truncate text-xs text-ink" title={slot.name}>
                {slot.name}
              </span>
              <div className="relative h-5 rounded-sm bg-neutral-100">
                <div
                  className={`absolute inset-y-0.5 rounded-sm ${slot.state === 'PAST' ? 'bg-neutral-300' : slot.state === 'ONGOING' ? 'bg-success-600' : 'bg-brand-500'}`}
                  style={bar(slot.startAt, slot.endAt)}
                />
              </div>
            </div>
          ))}
        </div>
        <div
          className="absolute inset-y-12 right-4 left-[100px] w-px bg-danger-600"
          style={{ marginLeft: `${at(now)}%` }}
          aria-label={`Bây giờ: ${formatVn(now)}`}
        />
        {invalidRanges.map((range, index) => (
          <div
            key={index}
            role="alert"
            aria-label="Khoảng sai"
            className="absolute inset-y-12 right-4 left-[100px] border border-danger-600 bg-danger-50/60"
            style={{
              marginLeft: `${at(range.startAt)}%`,
              width: `${Math.max(0.7, at(range.endAt) - at(range.startAt))}%`,
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(217,45,32,.18) 4px, rgba(217,45,32,.18) 8px)',
            }}
          />
        ))}
        <p className="mt-3 text-xs text-muted">
          Vạch đỏ: bây giờ · vùng gạch chéo đỏ: khoảng sai HK-02/HK-07.
        </p>
      </div>
    </section>
  )
}
