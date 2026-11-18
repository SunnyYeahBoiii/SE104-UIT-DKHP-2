import { expect, test } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

test('sinh viên: đăng nhập → đăng ký 2 lớp → thấy phiếu → huỷ 1 lớp', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('24520001')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/student$/)

  await page.goto('/student/registration')
  await expect(page.getByRole('heading', { name: 'Đăng ký học phần', exact: true })).toBeVisible()
  await expect(page.getByTestId('permission-message')).toContainText(
    'Bạn đang trong khung giờ đăng ký',
  )
  await expect(page.getByTestId('section-SE121.P21')).toBeVisible()
  await expect(page.getByTestId('section-CE119.P21.1')).toBeVisible()

  await page.getByRole('button', { name: 'Chọn lớp SE121.P21' }).click()
  await page.getByRole('button', { name: 'Chọn lớp CE119.P21.1' }).click()
  const confirm = page.getByRole('button', { name: 'Đăng ký 2 lớp' })
  await expect(confirm).toBeVisible()
  const box = await confirm.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.y).toBeLessThan(740 - 64)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await confirm.click()

  await expect(page.getByTestId('result-ok')).toHaveCount(2)
  await expect(page.getByTestId('active-SE121.P21')).toBeVisible()
  await expect(page.getByTestId('active-CE119.P21.1')).toBeVisible()

  await page.getByRole('button', { name: 'Huỷ lớp SE121.P21' }).click()
  const dialog = page.getByRole('dialog', { name: 'Huỷ lớp' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Xác nhận huỷ' }).click()

  await expect(page.getByTestId('active-SE121.P21')).toHaveCount(0)
  await page.getByTestId('cancelled-list').locator('summary').click()
  await expect(page.getByTestId('cancelled-SE121.P21')).toBeVisible()
  await expect(page.getByTestId('active-CE119.P21.1')).toBeVisible()
})
