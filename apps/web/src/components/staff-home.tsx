'use client'

import { useEffect, useState } from 'react'

import { FinanceOverview } from '@/components/finance/finance-overview'
import { StaffOverview } from '@/components/monitoring/staff-overview'
import { api, type AuthUser } from '@/lib/auth'

export function StaffHome() {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    void api<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => undefined)
  }, [])

  if (user?.activeRole === 'FINANCE_OFFICE') return <FinanceOverview />
  if (user?.activeRole) return <StaffOverview />
  return null
}
