'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { Banner, Button, Card } from '@/components/ui'
import { api, ApiError } from '@/lib/auth'
import {
  ACTION_LABELS,
  formatDate,
  formatMoney,
  type Student,
  type StudentDetailResponse,
  type StudentPayload,
} from '@/lib/students'
import { ConfirmDialog, Drawer, OneTimeSecretDialog, StudentForm } from './student-ui'

type Tab = 'profile' | 'forms' | 'audit'

export function StudentDetail({ code }: { code: string }) {
  const router = useRouter()
  const [data, setData] = useState<StudentDetailResponse | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('profile')
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await api<StudentDetailResponse>(`/students/${code}`))
      setError('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không tải được hồ sơ sinh viên.')
    }
  }, [code])

  useEffect(() => {
    void Promise.resolve().then(() => reload())
  }, [reload])

  const update = async (value: StudentPayload) => {
    setBusy(true)
    setError('')
    try {
      await api(`/students/${code}`, { method: 'PATCH', body: JSON.stringify(value) })
      setEditing(false)
      await reload()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không lưu được hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ temporaryPassword: string }>(`/students/${code}/reset-password`, {
        method: 'POST',
      })
      setResetting(false)
      setSecret(result.temporaryPassword)
      await reload()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không đặt lại được mật khẩu.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/students/${code}`, {
        method: 'DELETE',
        body: JSON.stringify({ studentCode: code }),
      })
      router.push('/staff/students')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không xoá được hồ sơ.')
      setDeleting(false)
      setBusy(false)
    }
  }

  if (error && !data) return <Banner tone="danger">{error}</Banner>
  if (!data) return <p className="text-muted">Đang tải hồ sơ…</p>

  const student: Student = data.item
  const blocked = data.deleteBlocked.reason
  const catalogs = {
    cohorts: data.cohorts,
    trainingSystems: data.trainingSystems,
    priorityGroups: data.priorityGroups,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{student.fullName}</h1>
          <p className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
            <span className="font-mono">{student.studentCode}</span>
            <span>Khoá {student.cohort.code}</span>
            <span>
              Hệ {student.trainingSystem.code} · {student.trainingSystem.name}
            </span>
          </p>
          {blocked ? (
            <p className="mt-2 text-sm text-danger-700" title={blocked}>
              {blocked}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Sửa hồ sơ
          </Button>
          <Button variant="secondary" onClick={() => setResetting(true)}>
            Đặt lại mật khẩu
          </Button>
          <Button
            variant="danger"
            disabled={Boolean(blocked)}
            title={blocked ?? undefined}
            onClick={() => setDeleting(true)}
          >
            Xoá hồ sơ
          </Button>
        </div>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div
        role="tablist"
        aria-label="Chi tiết sinh viên"
        className="flex gap-2 border-b border-line"
      >
        {(
          [
            ['profile', 'Hồ sơ'],
            ['forms', 'Phiếu đăng ký'],
            ['audit', 'Nhật ký'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-11 border-b-2 px-4 text-sm ${tab === key ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <Card>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">MSSV</dt>
              <dd className="font-mono text-ink">{student.studentCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Họ tên</dt>
              <dd className="text-ink">{student.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd className="text-ink">{student.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Khoá tuyển sinh</dt>
              <dd className="text-ink">
                {student.cohort.code} · {student.cohort.admissionYear}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Hệ đào tạo</dt>
              <dd className="text-ink">
                {student.trainingSystem.code} · {student.trainingSystem.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Đối tượng ưu tiên</dt>
              <dd className="text-ink">
                {student.priorityGroups.length === 0
                  ? 'Không có'
                  : student.priorityGroups.map((group) => group.name).join(', ')}
                {student.appliedPriorityGroup ? (
                  <span className="mt-1 block text-brand-700">
                    Đang áp dụng: {student.appliedPriorityGroup.name} (
                    {student.appliedPriorityGroup.discountRate}%)
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        </Card>
      ) : null}

      {tab === 'forms' ? (
        <Card>
          {data.registrationForms.length === 0 ? (
            <p className="text-muted">Chưa có phiếu đăng ký.</p>
          ) : (
            <div className="space-y-4">
              {data.registrationForms.map((form) => (
                <div key={form.id} className="rounded-sm border border-line p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold text-ink">{form.term}</h2>
                    <span className="text-xs text-muted">
                      {form.finalizedAt ? `Đã chốt ${formatDate(form.finalizedAt)}` : 'Chưa chốt'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-xs text-muted uppercase">
                        <tr>
                          <th className="p-2">Môn</th>
                          <th className="p-2">Tín chỉ</th>
                          <th className="p-2">Đơn giá</th>
                          <th className="p-2">Phụ thu</th>
                          <th className="p-2">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.enrollments.map((line) => (
                          <tr key={line.id} className="border-t border-line">
                            <td className="p-2 font-mono">
                              {line.code} · {line.name}
                            </td>
                            <td className="tabular p-2">{line.credits}</td>
                            <td className="tabular p-2">{formatMoney(line.creditRate)}</td>
                            <td className="tabular p-2">{formatMoney(line.surcharge)}</td>
                            <td className="p-2">
                              {line.status === 'CANCELLED'
                                ? `Đã huỷ ${formatDate(line.cancelledAt)}`
                                : line.status === 'FINALIZED'
                                  ? 'Đã chốt'
                                  : 'Đã đăng ký'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'audit' ? (
        <Card>
          {data.auditLogs.length === 0 ? (
            <p className="text-muted">Chưa có thao tác nào được ghi nhận.</p>
          ) : (
            <ul className="space-y-3">
              {data.auditLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 text-sm last:border-0"
                >
                  <span className="text-ink">{ACTION_LABELS[log.action] ?? log.action}</span>
                  <span className="text-muted">
                    {log.actorName} · {formatDate(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {editing ? (
        <Drawer title="Sửa hồ sơ" onClose={() => setEditing(false)}>
          <StudentForm
            initial={student}
            catalogs={catalogs}
            editing
            busy={busy}
            error={error}
            onSubmit={update}
            onCancel={() => setEditing(false)}
          />
          <p className="mt-4 text-xs text-muted">
            Thay đổi khoá, hệ đào tạo hoặc đối tượng ưu tiên ngoài đợt đăng ký chỉ áp dụng từ học kỳ
            sau.
          </p>
        </Drawer>
      ) : null}

      {resetting ? (
        <ConfirmDialog
          title="Đặt lại mật khẩu"
          message="Mọi phiên đăng nhập của sinh viên này sẽ kết thúc. Sinh viên phải đổi mật khẩu ở lần đăng nhập tới."
          confirmLabel="Đặt lại mật khẩu"
          busy={busy}
          onConfirm={() => void resetPassword()}
          onCancel={() => setResetting(false)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Xoá hồ sơ"
          message={`Xoá hồ sơ và tài khoản của ${code}. Không hoàn tác được.`}
          confirmLabel="Xoá hồ sơ"
          requireCode={code}
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(false)}
        />
      ) : null}

      {secret ? <OneTimeSecretDialog password={secret} onClose={() => setSecret(null)} /> : null}
    </div>
  )
}
