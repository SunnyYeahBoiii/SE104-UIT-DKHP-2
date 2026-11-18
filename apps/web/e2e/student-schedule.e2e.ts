import { expect, test } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

async function login(page: import('@playwright/test').Page, studentCode: string) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill(studentCode)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/student$/)
}

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

  test('danh sách buổi theo ngày và mục không có lịch cố định', async ({ page }) => {
    await login(page, '24520001')
    await page.goto('/student/schedule?scope=registering')
    await expect(page.getByTestId('session-SE104.P21')).toBeVisible()
    await expect(page.getByTestId('week-grid')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

    await login(page, '24520013')
    await page.goto('/student/schedule?scope=registering')
    await expect(page.getByTestId('unscheduled')).toContainText('SE121.P21')
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('lưới tuần in được, chỉ hiện buổi đúng tuần', async ({ page }) => {
    await login(page, '24520001')
    await page.goto('/student/schedule?scope=registering')
    await expect(page.getByTestId('grid-SE104.P21')).toBeVisible()
    await expect(page.getByTestId('grid-SE104.P21.1')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /T2/ })).toBeVisible()
    await expect(page.getByTestId('print-timetable')).toBeVisible()

    await page.locator('#week-select').selectOption('2')
    await expect(page.getByTestId('grid-SE104.P21')).toHaveCount(1)
    await expect(page.getByTestId('grid-SE104.P21.1')).toHaveCount(0)
  })
})
