import Link from 'next/link'

const SHORTCUTS = [
  {
    href: '/student/registration',
    label: 'Đăng ký học phần',
    note: 'Chọn lớp và theo dõi phiếu đăng ký',
  },
  { href: '/student/schedule', label: 'Lịch học', note: 'Thời khoá biểu của bạn' },
  { href: '/student/tuition', label: 'Học phí', note: 'Công nợ và QR học phí' },
]

export default function StudentHome() {
  return (
    <div className="space-y-6">
      <section className="rounded-md bg-gradient-to-br from-brand-600 to-brand-500 p-6 text-white shadow-lg">
        <p className="text-sm opacity-90">Học kỳ hiện tại</p>
        <h1 className="mt-1 text-2xl font-bold">HK2 2026–2027</h1>
        <p className="mt-2 font-mono text-sm opacity-90">20262</p>
      </section>
      <section aria-labelledby="shortcuts">
        <h2 id="shortcuts" className="mb-3 text-lg font-semibold text-ink">
          Trang chủ
        </h2>
        <ul className="space-y-3">
          {SHORTCUTS.map(({ href, label, note }) => (
            <li key={href}>
              <Link
                href={href}
                className="block rounded-md border border-line bg-surface p-4 shadow-sm hover:border-brand-200"
              >
                <span className="block font-semibold text-brand-700">{label}</span>
                <span className="block text-sm text-muted">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
