import { expect, test } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

test('sinh viên mới: đăng nhập → đổi mật khẩu → thấy Trang chủ', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('25520010')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page).toHaveURL(/\/change-password/)
  await page.getByLabel('Mật khẩu hiện tại').fill(PASSWORD)
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('Moi@E2E123!')
  await page.getByLabel('Xác nhận mật khẩu mới').fill('Moi@E2E123!')
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click()

  await expect(page).toHaveURL(/\/student$/)
  await expect(page.getByRole('heading', { name: 'Trang chủ' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Điều hướng sinh viên' }).getByRole('link'),
  ).toHaveCount(4)
})

test('tv.viet: chọn vai trò rồi chuyển vai trò mà không đăng nhập lại', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.viet')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page).toHaveURL(/\/select-role/)
  await page.getByRole('button', { name: 'Phòng Tài vụ' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await expect(page.getByRole('link', { name: 'Thu tại quầy' })).toBeVisible()

  await page.getByLabel('Chuyển vai trò').selectOption('ACADEMIC_OFFICE')
  await expect(page.getByRole('link', { name: 'Sinh viên', exact: true })).toBeVisible()
  await expect(page.getByText('Trịnh Quốc Việt')).toBeVisible()
})

test('hết phiên: quay về đăng nhập và giữ đường dẫn cũ', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/student/tuition')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fstudent%2Ftuition&reason=expired/)
  await expect(page.getByText('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')).toBeVisible()
  await context.close()
})

test('route web chặn sai vai trò và gợi ý chuyển vai trò', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.viet')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.getByRole('button', { name: 'Phòng Đào tạo' }).click()
  await expect(page).toHaveURL(/\/staff$/)

  await page.goto('/student')
  await expect(page).toHaveURL(/\/forbidden/)
  await expect(page.getByText(/cũng có vai trò Phòng Tài vụ/)).toBeVisible()
})
