import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

async function loginAsAcademic(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('pdt.hang')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await page.goto('/staff/groups')
  await expect(page.getByRole('heading', { name: 'Đối tượng ưu tiên và khoá' })).toBeVisible()
}

test('C.4.4: hai tab, cột bắt buộc, xoá bị khoá và ghi chú không hồi tố', async ({ page }) => {
  await loginAsAcademic(page)

  await expect(page.getByRole('tab', { name: 'Đối tượng ưu tiên' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Khoá tuyển sinh' })).toBeVisible()
  for (const column of ['Tên đối tượng', 'Tỉ lệ giảm', 'Độ ưu tiên', 'Số sinh viên đang thuộc']) {
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible()
  }
  const lietSi = page.getByRole('row', { name: /Con liệt sĩ/ })
  await expect(lietSi).toContainText('80%')
  await expect(lietSi.getByRole('button', { name: 'Xoá Con liệt sĩ' })).toBeDisabled()
  await expect(lietSi.getByRole('button', { name: 'Xoá Con liệt sĩ' })).toHaveAttribute(
    'title',
    /1 sinh viên/,
  )

  await lietSi.getByRole('button', { name: 'Sửa Con liệt sĩ' }).click()
  await expect(
    page.getByText('Không hồi tố. Chỉ áp cho khoản nợ phát sinh sau khi lưu.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Đóng' }).click()

  await page.getByRole('tab', { name: 'Khoá tuyển sinh' }).click()
  for (const column of [
    'Tên khoá',
    'Năm nhập học',
    'Số sinh viên',
    'Số bảng phí',
    'Số khung giờ',
  ]) {
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible()
  }
  const k18 = page.getByRole('row', { name: /K18/ })
  await expect(k18.getByRole('button', { name: 'Xoá khoá K18' })).toBeDisabled()
  await expect(k18.getByRole('button', { name: 'Xoá khoá K18' })).toHaveAttribute(
    'title',
    /sinh viên.*bảng phí.*khung giờ/,
  )
})

test('C.4.4: trùng độ ưu tiên chỉ cảnh báo; thêm sửa xoá khoá rỗi', async ({ page }) => {
  await loginAsAcademic(page)
  const code = `W41E2E${Date.now().toString().slice(-6)}`

  await page.getByRole('button', { name: 'Thêm đối tượng' }).click()
  await page.getByLabel('Mã').fill(code)
  await page.getByLabel('Tên đối tượng').fill('Nhóm cảnh báo')
  await page.getByLabel('Tỉ lệ giảm').fill('30')
  await page.getByLabel('Độ ưu tiên').fill('40')
  await page.getByRole('button', { name: 'Lưu' }).click()

  await expect(page.getByText(/Cùng độ ưu tiên/)).toBeVisible()
  const added = page.getByRole('row', { name: /Nhóm cảnh báo/ })
  await expect(added).toContainText('30%')
  await added.getByRole('button', { name: 'Xoá Nhóm cảnh báo' }).click()
  await expect(page.getByRole('row', { name: /Nhóm cảnh báo/ })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Khoá tuyển sinh' }).click()
  await page.getByRole('button', { name: 'Thêm khoá' }).click()
  await page.getByLabel('Mã').fill(code)
  await page.getByLabel('Năm nhập học').fill('2027')
  await page.getByRole('button', { name: 'Lưu' }).click()
  const cohort = page.getByRole('row', { name: new RegExp(code) })
  await expect(cohort).toContainText('2027')

  await cohort.getByRole('button', { name: `Sửa khoá ${code}` }).click()
  await page.getByLabel('Năm nhập học').fill('2028')
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText('2028')

  await page.getByRole('button', { name: `Xoá khoá ${code}` }).click()
  await expect(page.getByRole('row', { name: new RegExp(code) })).toHaveCount(0)
})
