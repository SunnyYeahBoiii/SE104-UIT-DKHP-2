'use client'

import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
    secondary: 'bg-surface text-brand-700 border border-brand-200 hover:bg-brand-50',
    ghost: 'bg-transparent text-ink hover:bg-neutral-100',
    danger: 'bg-danger-600 text-white hover:bg-danger-700',
    link: 'bg-transparent p-0 text-brand-700 underline hover:text-brand-800',
  }[variant]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
}

export function Input({ className = '', ...rest }: ComponentProps<'input'>) {
  return (
    <input
      {...rest}
      className={`h-12 w-full rounded-sm border border-neutral-200 bg-surface px-3 text-base text-ink placeholder:text-neutral-400 focus:border-brand-500 ${className}`}
    />
  )
}

export function PasswordInput({ ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        onClick={() => setVisible((value) => !value)}
        className="absolute top-0 right-0 flex h-12 w-12 items-center justify-center text-muted hover:text-brand-700"
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-line bg-surface p-6 shadow-md ${className}`}>
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function Banner({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger'
  children: ReactNode
  action?: ReactNode
}) {
  const styles = {
    info: 'border-brand-200 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100',
    warning: 'border-warning-600/30 bg-warning-50 text-warning-700',
    danger: 'border-danger-600/30 bg-danger-50 text-danger-700',
  }[tone]
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-sm border px-4 py-3 text-sm ${styles}`}
    >
      <span>{children}</span>
      {action}
    </div>
  )
}

export function OrbitBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      className="pointer-events-none absolute -top-40 -right-32 size-[600px] text-brand-100 dark:text-brand-950"
    >
      <circle cx="300" cy="300" r="240" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="540" cy="300" r="10" fill="currentColor" />
      <circle cx="300" cy="300" r="140" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
