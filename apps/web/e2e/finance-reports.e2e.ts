import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

async function loginAsFinance(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.lan')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
}

test('D.4.1: finance overview shows term stats, daily collections and pending work', async ({
  page,
}) => {
  await loginAsFinance(page)
  await expect(page.getByRole('heading', { name: 'Tổng quan thu học phí' })).toBeVisible()
  await expect(page.getByTestId('stat-Số tiền phải đóng')).toContainText('đ')
  await expect(page.getByTestId('stat-Đã thu')).toContainText('Chuyển khoản')
  await expect(page.getByTestId('stat-Số tiền còn lại')).toContainText('đ')
  await expect(page.getByTestId('stat-Tỉ lệ đã đóng đủ')).toContainText('%')
  await expect(page.getByTestId('finance-daily-chart')).toBeVisible()
  await expect(page.getByTestId('finance-todos')).toContainText('Giao dịch chưa khớp')
  await expect(page.getByTestId('finance-todos')).toContainText('Sinh viên còn nợ sau hạn đóng')
  await expect(page.getByTestId('finance-todos')).toContainText('thiếu bảng phí')
})

test('D.4.3: ledger covers all 9 types, groups recalculation, links receipts and has no write buttons', async ({
  page,
}) => {
  await loginAsFinance(page)
  await page.goto('/staff/debts')
  await page.getByLabel('Mã số sinh viên').fill('24520013')
  await page.getByRole('button', { name: 'Xem công nợ' }).click()

  await expect(page.getByTestId('debt-ledger')).toBeVisible()
  await expect(page.getByTestId('debt-ledger-types').locator('span')).toHaveCount(9)
  await expect(page.getByRole('heading', { name: /24520013/ })).toBeVisible()
  await expect(page.getByText(/Tính lại học phí/).first()).toBeVisible()
  await expect(page.getByTestId('debt-credit')).toContainText('đ')
  await expect(page.getByRole('button', { name: /Sửa|Xoá|Tạo dòng/ })).toHaveCount(0)

  await page.getByLabel('Mã số sinh viên').fill('24520002')
  await page.getByRole('button', { name: 'Xem công nợ' }).click()
  await expect(
    page.getByTestId('debt-ledger').getByRole('link', { name: /PT-20262-/ }),
  ).toBeVisible()
  await expect(
    page.getByTestId('debt-ledger').getByRole('link', { name: /Giao dịch/ }),
  ).toBeVisible()
})

test('D.4.6: receipts filter by term/channel/date and carry the filtered total', async ({
  page,
}) => {
  await loginAsFinance(page)
  await page.goto('/staff/receipts')
  await expect(page.getByTestId('receipt-row-PT-20262-00012')).toBeVisible()
  await expect(page.getByTestId('receipts-total')).toContainText('15 phiếu')

  await page.getByLabel('Lọc theo học kỳ').selectOption('20262')
  await expect(page.getByTestId('receipts-total')).toContainText('2 phiếu')
  await page.getByLabel('Lọc theo kênh thu').selectOption('BANK_TRANSFER')
  await expect(page.getByTestId('receipt-row-PT-20262-00012')).toBeVisible()
  await expect(page.getByTestId('receipt-row-PT-20262-00013')).toHaveCount(0)
  await expect(page.getByTestId('receipts-total')).toContainText('3.000.000 đ')

  await page.getByLabel('Lọc theo kênh thu').selectOption('')
  await page.getByLabel('Từ ngày').fill('2027-01-06')
  await page.getByLabel('Đến ngày').fill('2027-01-06')
  await expect(page.getByTestId('receipts-total')).toContainText('2 phiếu')
  await expect(page.getByText('Không có nút huỷ phiếu thu.')).toBeVisible()
})

test('D.4.8/D.5: BM7 lists debtors, totals, exports xlsx and previews A4 landscape print', async ({
  page,
}) => {
  await loginAsFinance(page)
  await page.goto('/staff/bm7')
  const table = page.getByTestId('bm7-table')
  await expect(table).toBeVisible()
  const initialRows = await table.locator('tbody tr').count()
  expect(initialRows).toBeGreaterThan(5)
  await expect(page.getByTestId('bm7-total')).toContainText('TỔNG')
  await expect(page.getByText(/Ba con số luôn tính lại từ sổ cái/)).toBeVisible()

  await page.getByLabel('Lọc theo khoá').selectOption({ label: 'K19' })
  await expect.poll(async () => table.locator('tbody tr').count()).toBeLessThan(initialRows)

  const excel = page.getByRole('link', { name: 'Xuất Excel' })
  await expect(excel).toHaveAttribute('href', /\/api\/finance\/bm7\/export\?termCode=20262/)

  await page.getByRole('button', { name: 'Xem trước bản in' }).click()
  await expect(page.getByTestId('bm7-page-number').first()).toContainText('Trang 1/')
  await expect(
    page.getByRole('heading', { name: 'BÁO CÁO SINH VIÊN CHƯA HOÀN THÀNH HỌC PHÍ' }).first(),
  ).toBeVisible()
  const sheetPage = await page
    .locator('.bm7-sheet')
    .first()
    .evaluate((element) => getComputedStyle(element).page)
  expect(sheetPage).toBe('bm7')
  await expect(page.getByRole('button', { name: 'Xuất PDF' })).toBeVisible()
})
