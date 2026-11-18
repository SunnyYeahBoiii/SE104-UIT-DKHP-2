import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

async function loginAsFinance(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.lan')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await page.goto('/staff/fees')
  await expect(page.getByRole('heading', { name: 'Bảng phí và tham số' })).toBeVisible()
}

test('D.4.7: ba thẻ, điền sẵn đơn giá, cảnh báo thiếu bảng phí và hạn đóng chỉ đọc', async ({
  page,
}) => {
  await loginAsFinance(page)

  for (const card of [
    'Đơn giá tín chỉ mặc định',
    'Bảng phí theo (khoá, hệ)',
    'Tài khoản nhận học phí',
    'Hạn đóng học phí',
  ])
    await expect(page.getByRole('heading', { name: card })).toBeVisible()

  await expect(page.getByLabel('Đơn giá LT mặc định')).toHaveValue('27000')
  await expect(page.getByLabel('Đơn giá TH mặc định')).toHaveValue('37000')
  await expect(
    page.getByText('Chỉ là giá điền sẵn khi lập bảng phí mới. Bảng phí đã có không đổi theo.'),
  ).toBeVisible()

  for (const column of [
    'Khoá',
    'Hệ đào tạo',
    'Học phí cố định / học kỳ chính',
    'Đơn giá LT',
    'Đơn giá TH',
    'Số sinh viên',
  ])
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible()

  await expect(page.getByRole('row', { name: /K19 CQUI/ })).toContainText('15.000.000 đ')
  await expect(page.getByText(/K20 · CLC có 1 sinh viên nhưng chưa có bảng phí/)).toBeVisible()
  await expect(
    page.getByText(/Học kỳ chính kế tiếp sẽ không chuyển sang Đăng ký được/).first(),
  ).toBeVisible()
  await expect(page.getByText(/Thay đổi không hồi tố/)).toBeVisible()
  await expect(page.getByText('Do Phòng Đào tạo đặt.')).toBeVisible()
  await expect(page.getByRole('row', { name: /20262/ })).toBeVisible()

  await page.getByRole('button', { name: 'Thêm bảng phí' }).click()
  const drawer = page.getByRole('dialog', { name: 'Bảng phí' })
  await expect(drawer.getByLabel('Đơn giá LT')).toHaveValue('27000')
  await expect(drawer.getByLabel('Đơn giá TH')).toHaveValue('37000')
  await expect(drawer.getByText('Điền sẵn từ đơn giá mặc định.')).toHaveCount(2)
  await drawer.getByRole('button', { name: 'Đóng' }).click()
})

test('D.4.7: mỗi thao tác lưu có xác nhận; đổi tài khoản nhận ghi lịch sử', async ({ page }) => {
  await loginAsFinance(page)

  await page.getByRole('button', { name: 'Lưu đơn giá mặc định' }).click()
  const rateDialog = page.getByRole('alertdialog', { name: 'Xác nhận đổi đơn giá mặc định' })
  await expect(rateDialog).toContainText('Bảng phí đã có không đổi theo.')
  await rateDialog.getByRole('button', { name: 'Xác nhận' }).click()
  await expect(rateDialog).toHaveCount(0)

  const original = await page.getByLabel('Số tài khoản').inputValue()
  const changed = original === '0000000001' ? '0000000002' : '0000000001'
  await page.getByLabel('Số tài khoản').fill(changed)
  await page.getByRole('button', { name: 'Lưu tài khoản nhận' }).click()
  const accountDialog = page.getByRole('alertdialog', {
    name: 'Xác nhận đổi tài khoản nhận học phí',
  })
  await expect(accountDialog).toContainText(
    'QR học phí và kiểm tra webhook dùng tài khoản mới ngay sau khi lưu. Giao dịch vào tài khoản cũ sẽ bị từ chối.',
  )
  await accountDialog.getByRole('button', { name: 'Xác nhận' }).click()
  await expect(accountDialog).toHaveCount(0)
  await expect(page.getByLabel('Số tài khoản')).toHaveValue(changed)
  await expect(page.getByRole('row', { name: /Đổi tài khoản nhận/ })).toBeVisible()

  await page.getByLabel('Số tài khoản').fill(original)
  await page.getByRole('button', { name: 'Lưu tài khoản nhận' }).click()
  await page
    .getByRole('alertdialog', { name: 'Xác nhận đổi tài khoản nhận học phí' })
    .getByRole('button', { name: 'Xác nhận' })
    .click()
  await expect(page.getByLabel('Số tài khoản')).toHaveValue(original)
})
