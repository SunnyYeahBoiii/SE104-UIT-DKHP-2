import { ReceiptView } from '@/components/receipt/receipt-view'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>
  searchParams: Promise<{ copy?: string }>
}) {
  const { number } = await params
  const { copy } = await searchParams
  return <ReceiptView number={number} copy={copy === '1'} />
}
