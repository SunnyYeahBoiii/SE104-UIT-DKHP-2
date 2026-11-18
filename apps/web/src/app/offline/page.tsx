'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui'

export default function OfflinePage() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-8 text-center shadow-md">
        <h1 className="text-2xl font-bold text-ink">
          {online ? 'Bạn đã có kết nối' : 'Mất kết nối'}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Không thể kết nối tới máy chủ. Kiểm tra đường truyền rồi thử lại; phiên đăng nhập của bạn
          vẫn còn hiệu lực.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-6">
          Thử lại
        </Button>
      </div>
    </main>
  )
}
