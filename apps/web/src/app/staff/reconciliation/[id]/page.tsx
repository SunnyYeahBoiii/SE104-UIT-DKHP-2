import { ReconciliationDetail } from '@/components/finance/reconciliation-page'

export default async function ReconciliationRunPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ReconciliationDetail id={Number(id)} />
}
