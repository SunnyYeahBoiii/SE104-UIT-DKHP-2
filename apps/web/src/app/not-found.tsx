import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-8 text-center shadow-md">
        <p className="text-sm font-semibold text-warning-700">404</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm text-muted">
          Đường dẫn có thể đã thay đổi. Kiểm tra lại hoặc về trang chủ.
        </p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-brand-700 underline">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}
