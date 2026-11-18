'use client'

import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui'

export function ServerError() {
  const requestId = useSearchParams().get('requestId') ?? 'unknown'
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-8 text-center shadow-md">
        <p className="text-sm font-semibold text-danger-700">500</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Máy chủ đang gặp sự cố</h1>
        <p className="mt-3 text-sm text-muted">
          Báo mã request sau cho Phòng Đào tạo nếu lỗi tiếp tục:
        </p>
        <p className="mt-2 font-mono text-sm break-all text-ink">{requestId}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">
          Thử lại
        </Button>
      </div>
    </main>
  )
}
