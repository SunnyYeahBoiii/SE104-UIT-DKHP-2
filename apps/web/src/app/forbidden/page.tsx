import Link from 'next/link'

export default function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ switchable?: string }>
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-8 text-center shadow-md">
        <p className="text-sm font-semibold text-danger-700">403</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Bạn không có quyền truy cập trang này</h1>
        <ForbiddenHint searchParams={searchParams} />
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-brand-700 underline">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}

async function ForbiddenHint({ searchParams }: { searchParams: Promise<{ switchable?: string }> }) {
  const { switchable } = await searchParams
  return (
    <p className="mt-3 text-sm text-muted">
      {switchable
        ? `Tài khoản của bạn cũng có vai trò ${switchable}. Chọn vai trò đó trên thanh điều hướng rồi thử lại.`
        : 'Liên hệ Phòng Đào tạo nếu bạn cần quyền truy cập.'}
    </p>
  )
}
