import { channelLabel, dateTime, money, type ReceiptDetail } from '@/lib/receipt'

export type ReceiptFormat = 'a5' | '80mm'

/** D.5: one BM6 component for the A5 sheet and the 80mm thermal roll; both carry the amount in words. */
export function ReceiptPrint({
  receipt,
  format = 'a5',
  copy = false,
}: {
  receipt: ReceiptDetail
  format?: ReceiptFormat
  copy?: boolean
}) {
  const size = format === '80mm' ? '80mm 200mm' : 'A5 portrait'
  const margin = format === '80mm' ? '6mm' : '12mm'
  return (
    <article
      data-testid="bm6-print"
      className={`print-area receipt-print bg-white text-ink ${format === '80mm' ? 'receipt-80' : 'receipt-a5'}`}
    >
      <style>{`@media print { @page { size: ${size}; margin: ${margin}; } }`}</style>
      {copy ? (
        <p data-testid="bm6-copy" className="mb-2 text-center text-sm font-bold tracking-widest">
          BẢN SAO
        </p>
      ) : null}
      <header className="border-b border-black pb-3 text-center">
        <p className="text-base font-bold">UIT · Trường Đại học Công nghệ Thông tin</p>
        <p className="mt-2 text-lg font-bold uppercase">Phiếu thu học phí</p>
        <p data-testid="bm6-number" className="font-mono text-sm">
          Số phiếu: {receipt.number}
        </p>
        <p className="text-xs">Ngày thu: {dateTime(receipt.paidAt)}</p>
      </header>
      <dl className="mt-3 space-y-1 text-sm">
        <Row label="MSSV" value={receipt.studentCode} mono />
        <Row label="Họ tên" value={receipt.studentName} />
        <Row label="Khoá" value={receipt.cohortCode} />
        <Row label="Hệ đào tạo" value={receipt.trainingSystemCode} />
        <Row label="Học kỳ" value={receipt.termName} />
        <Row label="Kênh thu" value={channelLabel(receipt.channel)} />
        <Row
          label={receipt.channel === 'COUNTER' ? 'Người thu' : 'Ghi chú'}
          value={receipt.collector ?? receipt.note ?? '—'}
        />
      </dl>
      <div className="mt-4 border-t-2 border-black pt-3 text-center">
        <p className="text-xs uppercase">Số tiền thu</p>
        <p data-testid="bm6-amount" className="text-xl font-bold tabular-nums">
          {money(receipt.amount)}
        </p>
        <p data-testid="bm6-words" className="mt-1 text-sm font-medium">
          {receipt.amountInWords}
        </p>
      </div>
      <div className="receipt-signature mt-8 flex justify-between text-xs">
        <span>Người nộp tiền</span>
        <span>Người thu tiền</span>
      </div>
      <p className="receipt-no-color mt-6 text-center text-[9pt]">
        Phiếu thu điện tử · Không huỷ sau khi ghi nhận
      </p>
    </article>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd data-testid={`bm6-${label}`} className={mono ? 'font-mono' : 'font-medium'}>
        {value}
      </dd>
    </div>
  )
}
