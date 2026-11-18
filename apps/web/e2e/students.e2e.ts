import { expect, test } from '@playwright/test'

const STAFF_PASSWORD = 'Dkhp@2026'

async function loginAsStaff(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('pdt.hang')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(STAFF_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
}

test('tạo hồ sơ → mật khẩu hiện một lần → sinh viên đăng nhập bằng mật khẩu đó', async ({
  page,
}) => {
  const code = '25520888'
  await loginAsStaff(page)
  await page.goto('/staff/students')
  await page.getByRole('button', { name: 'Thêm sinh viên' }).click()

  await page.getByLabel('MSSV', { exact: true }).fill(code)
  await page.getByLabel('Họ tên', { exact: true }).fill('E2E Sinh viên Mới')
  await page.getByLabel('Email', { exact: true }).fill(`${code}@gm.uit.edu.vn`)
  await page.getByLabel('Khoá tuyển sinh', { exact: true }).selectOption({ label: 'K20 · 2025' })
  await page.getByLabel('Hệ đào tạo', { exact: true }).selectOption({ label: 'CQUI · Chính quy' })
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()

  const secretDialog = page.getByRole('dialog', { name: 'Mật khẩu ban đầu' })
  await expect(secretDialog).toBeVisible()
  const close = secretDialog.getByRole('button', { name: 'Đóng' })
  await expect(close).toBeDisabled()
  const temporaryPassword = await secretDialog.getByLabel('Mật khẩu ban đầu').inputValue()
  expect(temporaryPassword).toMatch(/[a-z]/)
  expect(temporaryPassword).toMatch(/[A-Z]/)
  expect(temporaryPassword).toMatch(/[0-9]/)
  await secretDialog.getByLabel('Tôi đã lưu').check()
  await expect(close).toBeEnabled()
  await close.click()

  await expect(page.getByRole('link', { name: code })).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('MSSV hoặc mã cán bộ').fill(code)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(temporaryPassword)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/change-password/)
  await expect(page.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeVisible()
})

test('ô tìm MSSV trên top bar mở chi tiết; xoá bị khoá khi đã có phiếu', async ({ page }) => {
  await loginAsStaff(page)
  await page.getByLabel('Tìm sinh viên theo MSSV').fill('24520001')
  await page.getByLabel('Tìm sinh viên theo MSSV').press('Enter')
  await expect(page).toHaveURL(/\/staff\/students\/24520001$/)
  await expect(page.getByRole('heading', { name: 'Nguyễn Minh An' })).toBeVisible()

  const remove = page.getByRole('button', { name: 'Xoá hồ sơ' })
  await expect(remove).toBeDisabled()
  await expect(remove).toHaveAttribute('title', /Đã có phiếu đăng ký/)

  await page.getByRole('tab', { name: 'Phiếu đăng ký' }).click()
  await expect(page.getByText('Chưa có phiếu đăng ký.')).not.toBeVisible()
  await page.getByRole('tab', { name: 'Nhật ký' }).click()
  await expect(page.getByText('Chưa có thao tác nào được ghi nhận.')).toBeVisible()
})

test('xoá hồ sơ tạo nhầm bằng hộp thoại gõ lại MSSV', async ({ page }) => {
  const code = '25520889'
  await loginAsStaff(page)
  await page.goto('/staff/students')
  await page.getByRole('button', { name: 'Thêm sinh viên' }).click()
  await page.getByLabel('MSSV', { exact: true }).fill(code)
  await page.getByLabel('Họ tên', { exact: true }).fill('E2E Xoá nhầm')
  await page.getByLabel('Khoá tuyển sinh', { exact: true }).selectOption({ label: 'K20 · 2025' })
  await page.getByLabel('Hệ đào tạo', { exact: true }).selectOption({ label: 'CQUI · Chính quy' })
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  const secret = page.getByRole('dialog', { name: 'Mật khẩu ban đầu' })
  await secret.getByLabel('Tôi đã lưu').check()
  await secret.getByRole('button', { name: 'Đóng' }).click()

  await page.getByRole('link', { name: code }).click()
  await expect(page).toHaveURL(new RegExp(`/staff/students/${code}$`))
  await page.getByRole('button', { name: 'Xoá hồ sơ' }).click()
  const dialog = page.getByRole('dialog', { name: 'Xoá hồ sơ' })
  const confirm = dialog.getByRole('button', { name: 'Xoá hồ sơ' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Gõ lại MSSV để xác nhận').fill(code)
  await confirm.click()
  await expect(page).toHaveURL(/\/staff\/students$/)
  await expect(page.getByRole('link', { name: code })).toHaveCount(0)
})
