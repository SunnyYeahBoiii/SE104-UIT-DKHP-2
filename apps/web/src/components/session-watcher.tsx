'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ApiError, api, withReturnTo, type AuthUser } from '@/lib/auth'
import { Banner, Button } from './ui'

/** A.5: warns 5 minutes before the absolute 8-hour deadline, then returns to login keeping the path. */
export function SessionWatcher() {
  const pathname = usePathname()
  const router = useRouter()
  const [expiring, setExpiring] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []
    const finish = () => {
      const url = withReturnTo('/login', pathname)
      router.replace(`${url}&reason=expired`)
    }
    const watch = async () => {
      try {
        const { user } = await api<{ user: AuthUser }>('/auth/me')
        if (cancelled) return
        const remaining = user.expiresIn
        if (remaining <= 0) return finish()
        if (remaining <= 300) setExpiring(true)
        else timers.push(window.setTimeout(() => setExpiring(true), (remaining - 300) * 1000))
        timers.push(window.setTimeout(finish, remaining * 1000))
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) finish()
      }
    }
    void watch()
    const onOffline = () => setOffline(!navigator.onLine)
    onOffline()
    window.addEventListener('online', onOffline)
    window.addEventListener('offline', onOffline)
    return () => {
      cancelled = true
      timers.forEach(window.clearTimeout)
      window.removeEventListener('online', onOffline)
      window.removeEventListener('offline', onOffline)
    }
  }, [pathname, router])

  return (
    <div className="space-y-2">
      {offline ? (
        <Banner tone="warning">
          Mất kết nối. Kiểm tra mạng rồi thử lại.{' '}
          <a className="underline" href="/offline">
            Xem chi tiết
          </a>
        </Banner>
      ) : null}
      {expiring ? (
        <Banner
          tone="warning"
          action={
            <Button variant="link" onClick={() => router.replace('/login')}>
              Đăng xuất
            </Button>
          }
        >
          Phiên đăng nhập sẽ hết hạn trong chưa đầy 5 phút. Hãy lưu công việc của bạn.
        </Banner>
      ) : null}
    </div>
  )
}
