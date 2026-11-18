'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Banner, Button } from '@/components/ui'
import { Drawer, OneTimeSecretDialog, StudentForm } from './student-ui'
import { api, ApiError } from '@/lib/auth'
import type { Catalogs, Student, StudentListResponse, StudentPayload } from '@/lib/students'

export function StudentList({ initialQuery }: { initialQuery: string }) {
  const [items, setItems] = useState<Student[]>([])
  const [catalogs, setCatalogs] = useState<Catalogs>({
    cohorts: [],
    trainingSystems: [],
    priorityGroups: [],
  })
  const [query, setQuery] = useState(initialQuery)
  const [cohortId, setCohortId] = useState('')
  const [systemId, setSystemId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const router = useRouter()

  const reload = useCallback(async () => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (cohortId) params.set('cohortId', cohortId)
    if (systemId) params.set('trainingSystemId', systemId)
    if (groupId) params.set('priorityGroupId', groupId)
    try {
      const data = await api<StudentListResponse>(`/students?${params.toString()}`)
      setItems(data.items)
      setCatalogs({
        cohorts: data.cohorts,
        trainingSystems: data.trainingSystems,
        priorityGroups: data.priorityGroups,
      })
      setError('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không tải được danh sách sinh viên.')
    }
  }, [query, cohortId, systemId, groupId])

  useEffect(() => {
    void Promise.resolve().then(() => reload())
  }, [reload])

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const code = query.trim()
    if (/^\d{8}$/.test(code)) {
      router.push(`/staff/students/${code}`)
      return
    }
    void reload()
  }

  const create = async (value: StudentPayload) => {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ temporaryPassword: string }>('/students', {
        method: 'POST',
        body: JSON.stringify(value),
      })
      setCreating(false)
      setSecret(result.temporaryPassword)
      await reload()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không tạo được hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Danh sách sinh viên</h1>
          <p className="text-sm text-muted">Quản lý hồ sơ và tài khoản của Phòng Đào tạo.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Thêm sinh viên</Button>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <form className="flex flex-wrap items-end gap-3" onSubmit={search}>
        <label className="min-w-64 flex-1 space-y-1 text-sm">
          <span className="block font-medium text-ink">Tìm MSSV hoặc họ tên</span>
          <input
            aria-label="Tìm MSSV hoặc họ tên"
            placeholder="Nhập MSSV 8 chữ số để mở chi tiết"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-ink">Lọc theo khoá</span>
          <select
            aria-label="Lọc theo khoá"
            value={cohortId}
            onChange={(event) => setCohortId(event.target.value)}
            className="h-12 rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
          >
            <option value="">Tất cả khoá</option>
            {catalogs.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.code} · {cohort.admissionYear}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-ink">Lọc theo hệ đào tạo</span>
          <select
            aria-label="Lọc theo hệ đào tạo"
            value={systemId}
            onChange={(event) => setSystemId(event.target.value)}
            className="h-12 rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
          >
            <option value="">Tất cả hệ</option>
            {catalogs.trainingSystems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.code} · {system.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-ink">Lọc theo đối tượng ưu tiên</span>
          <select
            aria-label="Lọc theo đối tượng ưu tiên"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            className="h-12 rounded-sm border border-neutral-200 bg-surface px-3 text-ink"
          >
            <option value="">Tất cả đối tượng</option>
            {catalogs.priorityGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {group.discountRate}%
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          Tìm
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead className="bg-neutral-50 text-xs text-muted uppercase">
            <tr>
              <th className="p-3">MSSV</th>
              <th className="p-3">Họ tên</th>
              <th className="p-3">Email</th>
              <th className="p-3">Khoá</th>
              <th className="p-3">Hệ đào tạo</th>
              <th className="p-3">Đối tượng đang áp dụng</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  Không có sinh viên phù hợp.
                </td>
              </tr>
            ) : (
              items.map((student) => (
                <tr key={student.id} className="border-t border-line">
                  <td className="p-3 font-mono">
                    <Link
                      href={`/staff/students/${student.studentCode}`}
                      className="text-brand-700 hover:underline"
                    >
                      {student.studentCode}
                    </Link>
                  </td>
                  <td className="p-3">{student.fullName}</td>
                  <td className="p-3 text-muted">{student.email ?? '—'}</td>
                  <td className="p-3">{student.cohort.code}</td>
                  <td className="p-3">{student.trainingSystem.code}</td>
                  <td className="p-3">
                    {student.appliedPriorityGroup ? (
                      <span className="rounded-sm bg-brand-50 px-2 py-1 text-brand-800">
                        {student.appliedPriorityGroup.name} ·{' '}
                        {student.appliedPriorityGroup.discountRate}%
                      </span>
                    ) : (
                      <span className="text-muted">Không có</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? (
        <Drawer title="Thêm sinh viên" onClose={() => setCreating(false)}>
          <StudentForm
            catalogs={catalogs}
            busy={busy}
            error={error}
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Drawer>
      ) : null}
      {secret ? <OneTimeSecretDialog password={secret} onClose={() => setSecret(null)} /> : null}
    </div>
  )
}
