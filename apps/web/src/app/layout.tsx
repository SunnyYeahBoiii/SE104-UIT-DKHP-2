import type { Metadata } from 'next'
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Đăng ký học phần và Học phí | UIT',
  description: 'Cổng đăng ký học phần và học phí của Trường Đại học Công nghệ Thông tin',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
