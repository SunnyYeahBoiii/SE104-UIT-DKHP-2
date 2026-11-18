import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

async function openTimetable(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('pdt.hang')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await page.goto('/staff/sections')
  await expect(page.getByRole('heading', { name: 'Thời khoá biểu và lớp' })).toBeVisible()
}

test('C.4.6/LHP-01: form lớp đầy đủ, sửa tín chỉ trong ô và lịch tổng theo phòng', async ({
  page,
}) => {
  await openTimetable(page)

  await expect(page.getByRole('tab', { name: 'Môn mở' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Lớp học phần/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Lịch tổng' })).toBeVisible()

  const credits = page.getByLabel('Tín chỉ IT003')
  await expect(credits).toBeVisible()
  await credits.fill('0')
  await credits.blur()
  await expect(credits).toHaveValue('0')

  await page.getByRole('tab', { name: /Lớp học phần/ }).click()
  const code = `ZZ.P${Date.now().toString().slice(-5)}`
  await page.getByRole('button', { name: 'Thêm lớp' }).click()
  const dialog = page.getByRole('dialog', { name: 'Thêm lớp học phần' })
  await expect(dialog).toBeVisible()
  for (const label of [
    'Mã lớp',
    'Môn mở',
    'Hệ đào tạo',
    'Giảng viên',
    'Sĩ số tối đa',
    'Khoá dành cho',
    'Ngôn ngữ',
    'Ghi chú',
  ])
    await expect(dialog.getByLabel(label)).toBeVisible()

  await dialog.getByLabel('Mã lớp').fill(code)
  await dialog.getByLabel('Sĩ số tối đa').fill('25')
  await dialog.getByRole('button', { name: 'Thêm buổi học' }).click()
  await expect(dialog.getByLabel('Thứ buổi 1')).toBeVisible()
  await dialog.getByRole('button', { name: 'Lưu lớp học phần' }).click()
  await expect(dialog).toHaveCount(0)

  const row = page.getByRole('row', { name: new RegExp(code) })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Sửa' }).click()
  await expect(page.getByRole('dialog', { name: `Sửa lớp ${code}` })).toBeVisible()
  await page.getByRole('button', { name: 'Xoá lớp' }).click()
  await page.getByRole('button', { name: 'Xoá lớp' }).click()
  await expect(page.getByRole('row', { name: new RegExp(code) })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Lịch tổng' }).click()
  await expect(page.getByLabel('Xem lịch tổng theo')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Tiết' })).toBeVisible()
})

test('LHP-02: từ Đăng ký chỉ sửa được sĩ số và điền giảng viên/phòng trống', async ({ page }) => {
  await openTimetable(page)
  await expect(page.getByRole('option', { name: '20263 · Chuẩn bị' })).toHaveCount(1)
  await page.getByLabel('Học kỳ', { exact: true }).selectOption('20262')
  await expect(page.getByLabel('Học kỳ', { exact: true })).toHaveValue('20262')

  await page.getByRole('tab', { name: /Lớp học phần/ }).click()
  await expect(
    page.getByText(/Từ giai đoạn Đăng ký chỉ sửa được sĩ số và điền giảng viên, phòng còn trống/),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Thêm lớp' })).toBeDisabled()
  const row = page.getByRole('row', { name: /CE119\.P21\.1/ })
  await row.getByRole('button', { name: 'Sửa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sửa lớp CE119.P21.1' })
  await expect(dialog.getByLabel('Mã lớp')).toBeDisabled()
  await expect(dialog.getByLabel('Sĩ số tối đa')).not.toBeDisabled()
  await expect(dialog.getByLabel('Giảng viên')).not.toBeDisabled()
})
