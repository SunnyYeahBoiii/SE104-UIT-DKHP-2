import type { ReactNode } from 'react'

import { OrbitBackdrop } from './ui'

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-page px-4 py-10">
      <OrbitBackdrop />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local brand asset */}
          <img
            src="/uit-logo.png"
            alt="Trường Đại học Công nghệ Thông tin"
            width={72}
            height={72}
          />
          <div>
            <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
