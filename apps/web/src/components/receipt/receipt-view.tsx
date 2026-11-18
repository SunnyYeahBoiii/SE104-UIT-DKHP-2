'use client'

import { Download, Printer } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ReceiptPrint, type ReceiptFormat } from '@/components/receipt/receipt-print'
import { Banner, Button, Card } from '@/components/ui'
import { api, ApiError } from '@/lib/auth'
import type { ReceiptDetail } from '@/lib/receipt'

export function ReceiptView({ number, copy = false }: { number: string; copy?: boolean }) {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null)
  const [format, setFormat] = useState<ReceiptFormat>('a5')
  const [error, setError] = useState('')

  useEffect(() => {
    void api<ReceiptDetail>(`/tuition/receipts/${encodeURIComponent(number)}`)
      .then(setReceipt)
      .catch((cause: unknown) =>
        setError(cause instanceof ApiError ? cause.message : 'Không tải được phiếu thu.'),
      )
  }, [number])

  const print = (next: ReceiptFormat) => {
    setFormat(next)
    window.setTimeout(() => window.print(), 50)
  }

  if (error)
    return (
      <Banner tone="danger">
        {error}{' '}
        <Link href="/student/tuition" className="underline">
          Về học phí
        </Link>
      </Banner>
    )
  if (!receipt) return <p className="py-10 text-center text-sm text-muted">Đang tải phiếu thu…</p>

  return (
    <div className="space-y-4">
      <div className="print-hide">
        <Link href="/student/tuition" className="text-sm text-brand-700 underline">
          ← Về học phí
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-ink">Chi tiết phiếu thu</h1>
        <p data-testid="receipt-number" className="font-mono text-sm text-muted">
          {receipt.number}
        </p>
      </div>
      <div className="print-hide flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => print('a5')}>
          Khổ A5
        </Button>
        <Button variant="secondary" onClick={() => print('80mm')}>
          Khổ 80 mm
        </Button>
        <Button data-testid="receipt-download-pdf" onClick={() => print(format)}>
          <Download size={16} /> Tải PDF
        </Button>
        <Button variant="ghost" onClick={() => print(format)}>
          <Printer size={16} /> In lại
        </Button>
      </div>
      <Card>
        <ReceiptPrint receipt={receipt} format={format} copy={copy} />
      </Card>
    </div>
  )
}
