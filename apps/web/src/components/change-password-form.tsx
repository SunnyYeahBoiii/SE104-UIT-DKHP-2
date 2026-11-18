'use client'

import { Check, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { AuthFrame } from '@/components/auth-frame'
import { Banner, Button, Card, Field, PasswordInput } from '@/components/ui'
import { api, ApiError, homeFor, withReturnTo, type AuthUser } from '@/lib/auth'

function checklist(value: string) {
  return [
    { label: 'Ít nhất 8 ký tự', ok: value.length >= 8 },
    { label: 'Có chữ thường và chữ hoa', ok: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { label: 'Có chữ số', ok: /[0-9]/.test(value) },
    { label: 'Có ký tự đặc biệt', ok: /[^A-Za-z0-9]/.test(value) },
  ]
}

export function ChangePasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('returnTo') || ''
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    setLoading(true)
    try {
      const { user } = await api<{ user: AuthUser }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      router.replace(
        !user.activeRole
          ? withReturnTo('/select-role', returnTo)
          : returnTo || homeFor(user.activeRole),
      )
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không thể đổi mật khẩu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      title="Đặt mật khẩu mới"
      subtitle="Bạn cần đổi mật khẩu trước khi vào ứng dụng. Không có điều hướng khác lúc này."
    >
      <Card>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Field label="Mật khẩu hiện tại">
            <PasswordInput
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Mật khẩu mới">
            <PasswordInput
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </Field>
          <ul className="space-y-1 text-xs text-muted" aria-label="Yêu cầu mật khẩu">
            {checklist(newPassword).map(({ label, ok }) => (
              <li key={label} className="flex items-center gap-2">
                {ok ? (
                  <Check size={14} className="text-success-700" />
                ) : (
                  <X size={14} className="text-neutral-400" />
                )}
                {label}
              </li>
            ))}
          </ul>
          <Field label="Xác nhận mật khẩu mới">
            <PasswordInput
              name="confirmPassword"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Lưu mật khẩu
          </Button>
        </form>
      </Card>
    </AuthFrame>
  )
}
