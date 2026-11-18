'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-8 text-center shadow-md">
        <p className="text-sm font-semibold text-danger-700">500</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Đã xảy ra lỗi</h1>
        <p className="mt-3 text-sm text-muted">
          {error.digest
            ? `Mã request để báo lỗi: ${error.digest}`
            : 'Vui lòng thử lại. Nếu lỗi tiếp tục, báo mã request.'}
        </p>
        <Button onClick={reset} className="mt-6">
          Thử lại
        </Button>
      </div>
    </main>
  )
}
