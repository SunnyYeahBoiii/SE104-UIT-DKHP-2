import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

async function loginAsFinance(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.lan')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
}

test('D.4.5: reconciliation list is read-only and shows the nightly counts', async ({ page }) => {
  await loginAsFinance(page)
  await page.goto('/staff/reconciliation')

  await expect(page.getByRole('heading', { name: 'Đối soát' })).toBeVisible()
  await expect(
    page.getByText(/Đối soát chạy tự động hằng ngày.*xử lý ngoài hệ thống/),
  ).toBeVisible()
  const table = page.getByTestId('reconciliation-runs-table')
  await expect(table).toBeVisible()
  const row = table.getByTestId('reconciliation-run-1')
  await expect(row).toContainText('412')
  await expect(row).toContainText('410')
  await expect(row).toContainText('Có lệch')
  await expect(page.getByRole('button', { name: /Chạy|Sửa|Xoá|Ghi bù/ })).toHaveCount(0)
})

test('D.4.5: detail links backfilled receipts and lists residual differences read-only', async ({
  page,
}) => {
  await loginAsFinance(page)
  await page.goto('/staff/reconciliation')
  await page
    .getByTestId('reconciliation-runs-table')
    .getByRole('link', { name: '05/01/2027' })
    .click()

  await expect(page).toHaveURL(/\/staff\/reconciliation\/1$/)
  await expect(page.getByRole('heading', { name: /Chi tiết đối soát 05\/01\/2027/ })).toBeVisible()

  const backfilled = page.getByTestId('reconciliation-backfilled')
  await expect(backfilled.locator('tbody tr')).toHaveCount(2)
  await expect(backfilled.getByRole('link', { name: /PT-/ }).first()).toBeVisible()

  const discrepancies = page.getByTestId('reconciliation-discrepancies')
  await expect(discrepancies).toContainText('Lệch số tiền')
  await expect(discrepancies).toContainText('1.200.000 đ')
  await expect(page.getByRole('button', { name: /Sửa|Xoá|Ghi bù|Chạy lại/ })).toHaveCount(0)
})
