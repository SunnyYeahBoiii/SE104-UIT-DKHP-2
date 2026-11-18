'use client'

import { useEffect, useState } from 'react'

import { Banner, Button, Card } from '@/components/ui'
import { api } from '@/lib/auth'
import {
  EMPTY_FILTERS,
  bm7Query,
  paginate,
  shortDate,
  type Bm7Report,
  type FinanceFilters,
} from '@/lib/finance'
import { money } from '@/lib/tuition'

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted'
const TD = 'px-3 py-2 text-sm text-ink'
const FIELD = 'h-11 w-full rounded-sm border border-neutral-200 bg-surface px-2 text-sm text-ink'
const PER_PAGE = 18

export function Bm7Page() {
  const [filters, setFilters] = useState<FinanceFilters>(EMPTY_FILTERS)
  const [termCode, setTermCode] = useState('20262')
  const [cohortId, setCohortId] = useState('')
  const [systemId, setSystemId] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [report, setReport] = useState<Bm7Report | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    void api<FinanceFilters>('/finance/filters')
      .then((data) => {
        setFilters(data)
        const term = new URLSearchParams(window.location.search).get('termCode')
        if (term) setTermCode(term)
      })
      .catch(() => undefined)
  }, [])

  const query = bm7Query({
    termCode,
    cohortId,
    trainingSystemId: systemId,
    priorityGroupId: priorityId,
  })

  useEffect(() => {
    void api<Bm7Report>(`/finance/bm7${query}`)
      .then((data) => {
        setReport(data)
        setError('')
      })
      .catch((cause: Error) => setError(cause.message))
  }, [query])

  const exportPdf = () => {
    setPreview(true)
    window.setTimeout(() => window.print(), 50)
  }

  return (
    <div className="space-y-4">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Báo cáo công nợ (BM7)</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreview((value) => !value)}>
            {preview ? 'Đóng bản in' : 'Xem trước bản in'}
          </Button>
          <a
            href={`/api/finance/bm7/export${query}`}
            download={`BM7_${termCode}.xlsx`}
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-200 bg-surface px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Xuất Excel
          </a>
          <Button onClick={exportPdf}>Xuất PDF</Button>
        </div>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card className="print-hide">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Học kỳ</span>
            <select
              aria-label="Chọn học kỳ báo cáo"
              className={FIELD}
              value={termCode}
              onChange={(event) => setTermCode(event.target.value)}
            >
              {filters.terms.map((term) => (
                <option key={term.code} value={term.code}>
                  {term.name} · {term.code}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Khoá</span>
            <select
              aria-label="Lọc theo khoá"
              className={FIELD}
              value={cohortId}
              onChange={(event) => setCohortId(event.target.value)}
            >
              <option value="">Tất cả</option>
              {filters.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.code}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Hệ đào tạo</span>
            <select
              aria-label="Lọc theo hệ đào tạo"
              className={FIELD}
              value={systemId}
              onChange={(event) => setSystemId(event.target.value)}
            >
              <option value="">Tất cả</option>
              {filters.trainingSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.code}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-ink">Đối tượng ưu tiên</span>
            <select
              aria-label="Lọc theo đối tượng ưu tiên"
              className={FIELD}
              value={priorityId}
              onChange={(event) => setPriorityId(event.target.value)}
            >
              <option value="">Tất cả</option>
              {filters.priorityGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">
          {report?.note ?? 'Ba con số luôn tính lại từ sổ cái.'}
        </p>
      </Card>

      {report ? (
        <div className={preview ? 'print-area bm7-print' : ''}>
          {paginate(report.rows, PER_PAGE).map((page, pageIndex, pages) => (
            <section
              key={pageIndex}
              className={preview ? 'bm7-sheet print-area' : ''}
              aria-label="Bản in BM7 A4 ngang"
            >
              <Card className={preview ? 'border-0 shadow-none' : ''}>
                <div className="mb-3 text-center">
                  <h2 className="text-base font-bold uppercase">
                    BÁO CÁO SINH VIÊN CHƯA HOÀN THÀNH HỌC PHÍ
                  </h2>
                  <p className="text-sm">
                    Học kỳ {report.term.name} · {report.term.code} · Ngày lập{' '}
                    {shortDate(report.generatedAt)} · Người lập {report.maker}
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border border-line">
                  <table data-testid="bm7-table" className="w-full min-w-[760px] border-collapse">
                    <thead className="bg-neutral-50">
                      <tr>
                        {[
                          'STT',
                          'MSSV',
                          'Họ tên',
                          'Số tiền đăng ký',
                          'Số tiền phải đóng',
                          'Số tiền còn lại',
                        ].map((header) => (
                          <th key={header} scope="col" className={TH}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {page.map((row) => (
                        <tr key={row.studentCode} className="border-t border-line">
                          <td className={TD}>{row.stt}</td>
                          <td className={`${TD} font-mono`}>{row.studentCode}</td>
                          <td className={TD}>{row.fullName}</td>
                          <td className={`${TD} tabular text-right`}>{money(row.grossAmount)}</td>
                          <td className={`${TD} tabular text-right`}>{money(row.netAmount)}</td>
                          <td className={`${TD} tabular text-right font-semibold`}>
                            {money(row.outstandingAmount)}
                          </td>
                        </tr>
                      ))}
                      {pageIndex === pages.length - 1 ? (
                        <tr
                          data-testid="bm7-total"
                          className="border-t-2 border-line bg-neutral-50 font-bold"
                        >
                          <td colSpan={3} className={TD}>
                            TỔNG
                          </td>
                          <td className={`${TD} tabular text-right`}>
                            {money(report.totals.grossAmount)}
                          </td>
                          <td className={`${TD} tabular text-right`}>
                            {money(report.totals.netAmount)}
                          </td>
                          <td className={`${TD} tabular text-right`}>
                            {money(report.totals.outstandingAmount)}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {preview ? (
                  <div className="mt-4 flex justify-between text-xs text-muted">
                    <span>{report.note}</span>
                    <span data-testid="bm7-page-number">
                      Trang {pageIndex + 1}/{pages.length}
                    </span>
                  </div>
                ) : null}
                {preview && pageIndex === pages.length - 1 ? (
                  <div className="mt-8 flex justify-between text-sm">
                    <span>Người lập</span>
                    <span>Trưởng phòng</span>
                  </div>
                ) : null}
              </Card>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}
