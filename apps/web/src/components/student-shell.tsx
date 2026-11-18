'use client'

import { BookOpen, CalendarDays, Home, Moon, Sun, Wallet } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { api, type AuthUser } from '@/lib/auth'
import { SessionWatcher } from './session-watcher'

const TABS = [
  { href: '/student', label: 'Trang chủ', icon: Home },
  { href: '/student/registration', label: 'Đăng ký', icon: BookOpen },
  { href: '/student/schedule', label: 'Lịch học', icon: CalendarDays },
  { href: '/student/tuition', label: 'Học phí', icon: Wallet },
]

export function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    void api<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    return () => document.documentElement.classList.remove('dark')
  }, [dark])

  return (
    <div className="min-h-dvh bg-page pb-20">
      <SessionWatcher />
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local brand asset */}
            <img src="/uit-logo.png" alt="UIT" width={40} height={40} className="size-10" />
            <div>
              <p className="text-sm font-semibold text-ink">{user?.fullName ?? 'Sinh viên'}</p>
              <p className="font-mono text-xs text-muted">{user?.username ?? ''}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label={dark ? 'Chế độ sáng' : 'Chế độ tối'}
            onClick={() => setDark((value) => !value)}
            className="flex size-11 items-center justify-center rounded-sm text-brand-700 hover:bg-brand-50"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-4 py-6">{children}</main>
      <nav
        aria-label="Điều hướng sinh viên"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface"
      >
        <ul className="mx-auto flex max-w-[720px]">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? 'text-brand-700' : 'text-muted'}`}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
