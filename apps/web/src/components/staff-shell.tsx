'use client'

import {
  Banknote,
  CalendarRange,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Settings2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { api, ROLE_LABELS, type AuthUser, type Role } from '@/lib/auth'
import { SessionWatcher } from './session-watcher'

const NAV: Record<
  'ACADEMIC_OFFICE' | 'FINANCE_OFFICE',
  { href: string; label: string; icon: typeof Users }[]
> = {
  ACADEMIC_OFFICE: [
    { href: '/staff', label: 'Tổng quan', icon: ClipboardList },
    { href: '/staff/students', label: 'Sinh viên', icon: Users },
    { href: '/staff/groups', label: 'Đối tượng ưu tiên và khoá', icon: GraduationCap },
    { href: '/staff/terms', label: 'Học kỳ và khung giờ', icon: CalendarRange },
    { href: '/staff/sections', label: 'Thời khoá biểu và lớp', icon: CalendarRange },
    { href: '/staff/registration', label: 'Theo đăng ký', icon: ClipboardList },
  ],
  FINANCE_OFFICE: [
    { href: '/staff', label: 'Tổng quan', icon: ClipboardList },
    { href: '/staff/counter', label: 'Thu tại quầy', icon: Banknote },
    { href: '/staff/debts', label: 'Công nợ sinh viên', icon: Users },
    { href: '/staff/bank', label: 'Giao dịch ngân hàng', icon: ReceiptText },
    { href: '/staff/reconciliation', label: 'Đối soát', icon: ClipboardList },
    { href: '/staff/receipts', label: 'Phiếu thu', icon: ReceiptText },
    { href: '/staff/fees', label: 'Bảng phí và tham số', icon: Settings2 },
    { href: '/staff/bm7', label: 'Báo cáo công nợ (BM7)', icon: ClipboardList },
  ],
}

export function StaffShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('20262')

  useEffect(() => {
    void api<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => undefined)
  }, [])

  const role = user?.activeRole
  const items = role && role !== 'STUDENT' ? NAV[role] : []
  const switchRole = async (next: Role) => {
    await api('/auth/switch-role', { method: 'POST', body: JSON.stringify({ role: next }) })
    router.refresh()
    window.location.reload()
  }
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <div className="flex min-h-dvh bg-page">
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 border-r border-line bg-surface transition-[width]`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-line px-3">
          <button
            type="button"
            aria-label={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
            onClick={() => setCollapsed((value) => !value)}
            className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-brand-50"
          >
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
          {!collapsed ? (
            <span className="text-sm font-semibold text-brand-800">DKHP · UIT</span>
          ) : null}
        </div>
        <nav aria-label="Điều hướng nhân viên" className="p-2">
          <ul className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  aria-current={pathname === href ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm ${pathname === href ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink hover:bg-brand-50'}`}
                >
                  <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                  {!collapsed ? label : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <SessionWatcher />
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-6 py-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Học kỳ
            <select
              aria-label="Chọn học kỳ"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="h-11 rounded-sm border border-neutral-200 bg-surface px-2 text-ink"
            >
              <option value="20262">HK2 2026–2027 · 20262</option>
              <option value="20261">HK1 2026–2027 · 20261</option>
            </select>
          </label>
          <form
            className="flex min-w-52 flex-1 items-center gap-2"
            action="/staff/students"
            onSubmit={(event) => {
              event.preventDefault()
              const code = query.trim()
              router.push(
                /^\d{8}$/.test(code)
                  ? `/staff/students/${code}`
                  : `/staff/students?q=${encodeURIComponent(code)}`,
              )
            }}
          >
            <Search size={18} className="text-muted" />
            <input
              aria-label="Tìm sinh viên theo MSSV"
              placeholder="Tìm MSSV hoặc họ tên"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full border-none bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            />
          </form>
          {user?.roles && user.roles.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              Vai trò
              <select
                aria-label="Chuyển vai trò"
                value={role ?? ''}
                onChange={(event) => void switchRole(event.target.value as Role)}
                className="h-11 rounded-sm border border-brand-200 bg-surface px-2 text-brand-700"
              >
                {user.roles.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.fullName ?? 'Đang tải…'}</p>
              <p className="text-xs text-muted">{role ? ROLE_LABELS[role] : ''}</p>
            </div>
            <Link href="/change-password" className="text-sm text-brand-700 hover:underline">
              Đổi mật khẩu
            </Link>
            <button
              type="button"
              aria-label="Đăng xuất"
              onClick={() => void logout()}
              className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-danger-50 hover:text-danger-700"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
