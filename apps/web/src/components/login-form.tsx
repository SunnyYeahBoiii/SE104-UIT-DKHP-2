'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { api, ApiError, homeFor, withReturnTo, type AuthUser } from '@/lib/auth'
import { AuthFrame } from '@/components/auth-frame'
import { Banner, Button, Card, Field, Input, PasswordInput } from '@/components/ui'

type LoginBody = { status: 'OK' | 'MUST_CHANGE_PASSWORD' | 'ROLE_SELECTION'; user: AuthUser }

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('returnTo') || ''
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await api<LoginBody>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      if (result.status === 'MUST_CHANGE_PASSWORD')
        return router.replace(withReturnTo('/change-password', returnTo))
      if (result.status === 'ROLE_SELECTION')
        return router.replace(withReturnTo('/select-role', returnTo))
      router.replace(returnTo || homeFor(result.user.activeRole))
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Không thể đăng nhập. Vui lòng thử lại.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame title="Đăng nhập" subtitle="Cổng đăng ký học phần và học phí">
      <Card>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {params.get('reason') === 'expired' ? (
            <Banner tone="warning">Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.</Banner>
          ) : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Field label="MSSV hoặc mã cán bộ">
            <Input
              name="username"
              autoComplete="username"
              placeholder="Ví dụ: 24520001"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </Field>
          <Field label="Mật khẩu">
            <PasswordInput
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Đăng nhập
          </Button>
          <p className="text-center text-xs text-muted">
            Quên mật khẩu? Liên hệ Phòng Đào tạo để được đặt lại.
          </p>
        </form>
      </Card>
    </AuthFrame>
  )
}
