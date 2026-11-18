import { TermsPage } from '@/components/terms/terms-page'

export default async function StaffTermDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <TermsPage initialCode={code} />
}
