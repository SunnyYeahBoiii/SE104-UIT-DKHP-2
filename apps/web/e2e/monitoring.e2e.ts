import { expect, test, type Page } from '@playwright/test'

async function loginAsStaff(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('pdt.hang')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Dkhp@2026')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
}

test('overview shows the term timeline, phase stats and the todo list', async ({ page }) => {
  await loginAsStaff(page)
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'TermTimeline' }).first()).toBeVisible()
  await expect(page.getByTestId('stat-Lớp đầy')).toBeVisible()
  await expect(page.getByTestId('staff-todos')).toContainText('chưa có bảng phí')
  await expect(page.getByTestId('staff-todos')).toContainText(/lớp đã đầy/i)
})

test('the monitoring table polls, filters and reports a too-small capacity in the cell', async ({
  page,
}) => {
  let polls = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/monitor/20262/sections')) polls += 1
  })
  await loginAsStaff(page)
  await page.goto('/staff/registration')
  const indicator = page.getByTestId('updated-ago')
  await expect(indicator).toHaveText(/Cập nhật \d+ giây trước/)
  await expect.poll(() => polls, { timeout: 12_000, intervals: [500] }).toBeGreaterThan(1)

  await page.getByRole('button', { name: 'Đã đầy' }).click()
  await expect(page.getByRole('row', { name: /CS106\.P21/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /SE104\.P21/ })).toHaveCount(0)
  await page.getByLabel('Lọc theo hệ').selectOption('CLC')
  await expect(page.getByRole('row', { name: /CS106\.P21/ })).toHaveCount(0)
  await page.getByLabel('Lọc theo hệ').selectOption('')
  await page.getByRole('button', { name: 'Tất cả' }).click()

  const capacity = page.getByLabel('Sĩ số CS106.P21')
  await capacity.fill('0')
  await capacity.press('Tab')
  await expect(page.locator('td [role="alert"]')).toContainText('Không được nhỏ hơn 1')
})

test('BB01 shows the roster and exports an .xlsx file', async ({ page }) => {
  await loginAsStaff(page)
  await page.goto('/staff/sections/SE104.P21?term=20262')
  await expect(page.getByRole('columnheader', { name: 'Hình thức học' })).toBeVisible()
  await expect(page.getByRole('row', { name: /24520001/ })).toContainText('Lần đầu')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel('Xuất Excel BB01').click(),
  ])
  expect(download.suggestedFilename()).toBe('BB01_SE104.P21.xlsx')
})

test('the post-chốt tab lists students below the minimum credits and exports them', async ({
  page,
}) => {
  await loginAsStaff(page)
  await page.goto('/staff/registration')
  await page.getByLabel('Học kỳ', { exact: true }).selectOption('20261')
  await page.getByRole('tab', { name: 'Dưới tín chỉ tối thiểu' }).click()
  await expect(page.getByRole('row', { name: /24520003/ })).toContainText('3')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel('Xuất Excel danh sách dưới tín chỉ tối thiểu').click(),
  ])
  expect(download.suggestedFilename()).toBe('duoi-tin-chi-toi-thieu_20261.xlsx')
})
