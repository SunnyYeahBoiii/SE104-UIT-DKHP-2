import { AcademicCatalog } from '@/components/academic-catalog'
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
  if (section === 'groups') return <AcademicCatalog />
  if (section === 'sections') return <TimetablePage />
  if (section === 'registration') return <RegistrationMonitor />
  if (section === 'fees') return <FinanceSettings />
  return <EmptyPlaceholder title={TITLES[section] ?? 'Không tìm thấy trang'} />
}
