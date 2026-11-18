import { Card } from '@/components/ui'

export default function StaffHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Tổng quan</h1>
      <Card>
        <p className="text-sm text-muted">
          Chọn một mục trên thanh bên để bắt đầu. Học kỳ hiện tại:{' '}
          <span className="font-mono">20262</span>.
        </p>
      </Card>
    </div>
  )
}
