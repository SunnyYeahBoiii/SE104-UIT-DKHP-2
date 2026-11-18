import { AcademicCatalog } from '@/components/academic-catalog'
import { Bm7Page } from '@/components/finance/bm7-page'
import { DebtPage } from '@/components/finance/debt-page'
import { ReceiptsPage } from '@/components/finance/receipts-page'
import { CounterPage } from '@/components/counter/counter-page'
import { FinanceSettings } from '@/components/finance-settings'
import { RegistrationMonitor } from '@/components/monitoring/registration-monitor'
import { EmptyPlaceholder } from '@/components/placeholder'
import { TimetablePage } from '@/components/timetable/timetable-page'

const TITLES: Record<string, string> = {
  students: 'Sinh viên',
  groups: 'Đối tượng ưu tiên và khoá',
  terms: 'Học kỳ và khung giờ',
  sections: 'Thời khoá biểu và lớp',
  registration: 'Theo dõi đăng ký',
  counter: 'Thu tại quầy',
  debts: 'Công nợ sinh viên',
  bank: 'Giao dịch ngân hàng',
  reconciliation: 'Đối soát',
  receipts: 'Phiếu thu',
  fees: 'Bảng phí và tham số',
  bm7: 'Báo cáo công nợ (BM7)',
}

export default async function StaffSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (section === 'counter') return <CounterPage />
  if (section === 'groups') return <AcademicCatalog />
  if (section === 'sections') return <TimetablePage />
  if (section === 'registration') return <RegistrationMonitor />
  if (section === 'fees') return <FinanceSettings />
  if (section === 'debts') return <DebtPage />
  if (section === 'receipts') return <ReceiptsPage />
  if (section === 'bm7') return <Bm7Page />
  return <EmptyPlaceholder title={TITLES[section] ?? 'Không tìm thấy trang'} />
}
