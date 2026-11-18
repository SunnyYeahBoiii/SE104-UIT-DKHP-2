import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ReceiptPrint } from '../src/components/receipt/receipt-print'
import { amountInWords, channelLabel, remainingAfter, type ReceiptDetail } from '../src/lib/receipt'

const receipt: ReceiptDetail = {
  id: 1,
  number: 'PT-20262-00045',
  studentCode: '24520001',
  studentName: 'Nguyễn Văn A',
  cohortCode: 'K19',
  trainingSystemCode: 'CQUI',
  termCode: '20262',
  termName: 'HK2 2026–2027',
  channel: 'COUNTER',
  amount: 15_000_000,
  amountInWords: 'Mười lăm triệu đồng chẵn',
  paidAt: '2027-01-06T03:00:00.000Z',
  collector: 'Ngô Thị Lan',
  note: null,
}

describe('BM6: D.4.2 amount preview and D.5 print templates', () => {
  it('agrees with the API on words, overpayment and channel labels', () => {
    expect(amountInWords(15_000_000)).toBe('Mười lăm triệu đồng chẵn')
    expect(amountInWords(1_234_567)).toBe(
      'Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy đồng',
    )
    expect(remainingAfter(5_000_000, 5_500_000)).toBe(-500_000)
    expect(channelLabel('COUNTER')).toBe('Tại quầy')
    expect(channelLabel('BANK_TRANSFER')).toBe('Chuyển khoản')
  })

  it('renders A5 and 80mm receipts with the amount in words', () => {
    const a5 = renderToStaticMarkup(<ReceiptPrint receipt={receipt} />)
    const thermal = renderToStaticMarkup(<ReceiptPrint receipt={receipt} format="80mm" />)
    expect(a5).toContain('receipt-a5')
    expect(a5).toContain('size: A5 portrait')
    expect(thermal).toContain('receipt-80')
    expect(thermal).toContain('size: 80mm 200mm')
    for (const html of [a5, thermal]) {
      expect(html).toContain('Phiếu thu học phí')
      expect(html).toContain('PT-20262-00045')
      expect(html).toContain('Mười lăm triệu đồng chẵn')
      expect(html).toContain('15.000.000 đ')
      expect(html).toContain('Ngô Thị Lan')
    }
  })

  it('marks a reprint as "Bản sao"', () => {
    expect(renderToStaticMarkup(<ReceiptPrint receipt={receipt} copy />)).toContain('BẢN SAO')
    expect(renderToStaticMarkup(<ReceiptPrint receipt={receipt} />)).not.toContain('BẢN SAO')
  })
})
