import { expect, test } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

async function login(page: import('@playwright/test').Page, code: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill(code)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/student$/)
  await page.goto('/student/tuition')
}

test('sinh viên còn nợ: tóm tắt BM7, hạn đóng và sổ cái mới nhất trước', async ({ page }) => {
  await login(page, '24520001')
  await expect(page.getByRole('heading', { name: 'Học phí', exact: true })).toBeVisible()
  await expect(page.getByTestId('tuition-outstanding')).toHaveText('15.000.000 đ')
  await expect(page.getByTestId('tuition-bm7')).toContainText('Số tiền đăng ký')
  await expect(page.getByTestId('tuition-bm7')).toContainText('Số tiền phải đóng')
  await expect(page.getByTestId('tuition-bm7')).toContainText('Đã thanh toán')
  await expect(page.getByTestId('tuition-deadline')).toContainText('28/02/2027')
  await expect(page.getByTestId('tuition-term-select')).toHaveValue('20262')
  await expect(page.getByTestId('tuition-overdue')).toHaveCount(0)
  await expect(page.getByTestId('tuition-settled')).toHaveCount(0)

  const rows = page.getByTestId('tuition-ledger').locator('li')
  await expect(rows.first()).toContainText('Học phí cố định HK2 2026–2027')
  await expect(rows).toHaveCount(1)
  await expect(page.getByText('Nội dung chuyển khoản', { exact: true })).toBeVisible()
  await expect(page.getByText('HP2452000120262')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test('sinh viên được giảm trừ 80%: đã đóng đủ, có tên đối tượng ưu tiên', async ({ page }) => {
  await login(page, '24520002')
  await expect(page.getByTestId('tuition-settled')).toBeVisible()
  await expect(page.getByTestId('tuition-bm7')).toContainText('Con liệt sĩ')
  await expect(page.getByTestId('tuition-bm7')).toContainText('12.000.000 đ')
  await expect(page.getByTestId('tuition-outstanding')).toHaveText('0 đ')
  await expect(page.getByText('Nội dung chuyển khoản', { exact: true })).toHaveCount(0)
})

test('số dư có kỳ trước chuyển sang học kỳ này', async ({ page }) => {
  await login(page, '24520005')
  await expect(page.getByTestId('tuition-bm7')).toContainText('−500.000 đ')
  await expect(page.getByTestId('tuition-outstanding')).toHaveText('14.500.000 đ')
  await expect(page.getByTestId('tuition-ledger')).toContainText('Số dư có chuyển từ HK1 2026–2027')
})

test('huỷ lớp: sổ cái giữ dòng phụ thu cũ và dòng đảo mới', async ({ page }) => {
  await login(page, '24520009')
  await expect(page.getByTestId('tuition-outstanding')).toHaveText('15.081.000 đ')
  await expect(page.getByTestId('tuition-ledger')).toContainText('Phụ thu IT002')
  await expect(page.getByTestId('tuition-ledger')).toContainText('đảo phụ thu')
})

test('quá hạn còn nợ: banner cảnh báo với hạn đóng của HK1', async ({ page }) => {
  await login(page, '24520011')
  await page.getByTestId('tuition-term-select').selectOption('20261')
  await expect(page.getByTestId('tuition-overdue')).toContainText('quá hạn')
  await expect(page.getByTestId('tuition-overdue')).toContainText('31/10/2026')
})
