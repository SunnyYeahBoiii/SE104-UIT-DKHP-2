'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AuthFrame } from '@/components/auth-frame'
import { Banner, Button, Card } from '@/components/ui'
import { api, ApiError, homeFor, ROLE_LABELS, type AuthUser, type Role } from '@/lib/auth'

export function RoleSelectForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('returnTo') || ''
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<Role | null>(null)

  useEffect(() => {
    void api<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => undefined)
  }, [])

  const choose = async (role: Role) => {
    setLoading(role)
    try {
      const { user } = await api<{ user: AuthUser }>('/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      })
      router.replace(returnTo || homeFor(user.activeRole))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không thể chuyển vai trò.')
      setLoading(null)
    }
  }

  return (
    <AuthFrame
      title="Chọn vai trò"
      subtitle="Tài khoản của bạn giữ nhiều vai trò. Chọn vai trò để tiếp tục."
    >
      <Card className="space-y-4">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {user?.roles.map((role) => (
          <Button
            key={role}
            type="button"
            variant="secondary"
            loading={loading === role}
            onClick={() => void choose(role)}
            className="w-full"
          >
            {ROLE_LABELS[role]}
          </Button>
        ))}
      </Card>
    </AuthFrame>
  )
}
