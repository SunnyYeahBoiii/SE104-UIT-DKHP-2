import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

const receipt = {
  id: 991,
  number: 'PT-20262-00045',
  studentCode: '24520006',
  studentName: 'Sinh viên thử nghiệm E2E',
  cohortCode: 'K19',
  trainingSystemCode: 'CQUI',
  termCode: '20262',
  termName: 'HK2 2026–2027',
  channel: 'COUNTER',
  amount: 5_500_000,
  amountInWords: 'Năm triệu năm trăm nghìn đồng chẵn',
  paidAt: '2027-01-06T03:00:00.000Z',
  collector: 'Ngô Thị Lan',
  note: null,
}

const bm7 = {
  grossAmount: 15_000_000,
  discountAmount: 0,
  netAmount: 15_000_000,
  paidAmount: 15_500_000,
  outstandingAmount: -500_000,
}

async function loginAsCashier(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.lan')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await page.goto('/staff/counter')
}

test('D.4.2: bàn phím đầy đủ, cảnh báo thu thừa, in A5/80mm và tổng ca', async ({ page }) => {
  await loginAsCashier(page)
  await expect(page.getByTestId('counter-search')).toBeFocused()
  await page.getByRole('heading', { name: 'Thu tại quầy' }).click()
  await page.keyboard.press('/')
  await expect(page.getByTestId('counter-search')).toBeFocused()

  await page.route('**/api/counter/students/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        studentCode: '24520006',
        fullName: 'Sinh viên thử nghiệm E2E',
        email: 'e2e@uit.edu.vn',
        cohortCode: 'K19',
        trainingSystemCode: 'CQUI',
        priority: null,
        debts: [
          {
            code: '20262',
            name: 'HK2 2026–2027',
            outstandingAmount: 5_000_000,
            netAmount: 15_000_000,
            paidAmount: 10_000_000,
            tuitionDeadline: '2027-02-28T10:00:00.000Z',
            phase: 'REGISTRATION',
          },
        ],
        defaultTermCode: '20262',
      }),
    }),
  )
  await page.route('**/api/counter/receipts', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ receipts: [receipt], totalAmount: 5_500_000 }),
    }),
  )
  await page.route('**/api/counter/payments', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        receipt,
        before: bm7,
        after: bm7,
        settled: false,
        creditBalance: 500_000,
      }),
    }),
  )

  await page.getByTestId('counter-search').fill('24520006')
  await expect(page.getByTestId('counter-student-card')).toContainText('Sinh viên thử nghiệm E2E')
  await expect(page.getByTestId('counter-amount')).toHaveValue('5000000')

  await page.getByTestId('counter-amount').fill('5500000')
  await expect(page.getByTestId('counter-overpay')).toContainText('500.000 đ')
  await expect(page.getByTestId('counter-remaining')).toHaveText('-500.000 đ')

  await page.keyboard.press('Control+Enter')
  await expect(page.getByTestId('counter-confirm')).toBeVisible()
  await expect(page.getByTestId('counter-confirm-words')).toHaveText(
    'Năm triệu năm trăm nghìn đồng chẵn',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('counter-confirm')).toHaveCount(0)

  await page.keyboard.press('Control+Enter')
  await page.getByTestId('counter-confirm-ok').click()
  await expect(page.getByTestId('counter-receipt')).toContainText('PT-20262-00045')
  await expect(page.getByTestId('counter-shift-total')).toHaveText('5.500.000 đ')
  await expect(page.locator('[data-testid="bm6-print"]')).toHaveClass(/receipt-a5/)

  await page.evaluate(() => {
    Object.assign(window, { __printed: 0 })
    window.print = () => {
      Object.assign(window, {
        __printed: (window as unknown as { __printed: number }).__printed + 1,
      })
    }
  })
  await page.keyboard.press('Control+p')
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed))
    .toBeGreaterThan(0)

  await page.getByRole('button', { name: 'In (80 mm)' }).click()
  await expect(page.locator('[data-testid="bm6-print"]')).toHaveClass(/receipt-80/)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('counter-search')).toHaveValue('')
  await expect(page.getByTestId('counter-receipt')).toHaveCount(0)
})

test('B.4.5/D.5: sinh viên xem phiếu thu của mình, tải PDF và in lại thành bản sao', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('24520002')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/student$/)
  await page.goto('/student/tuition')

  const link = page.getByTestId('tuition-receipts').locator('a').first()
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^\/student\/receipts\/PT-/)
  await link.click()

  await expect(page.getByRole('heading', { name: 'Chi tiết phiếu thu' })).toBeVisible()
  await expect(page.getByTestId('bm6-print')).toBeVisible()
  await expect(page.getByTestId('bm6-words')).not.toBeEmpty()

  await page.evaluate(() => {
    Object.assign(window, { __printed: 0 })
    window.print = () => {
      Object.assign(window, {
        __printed: (window as unknown as { __printed: number }).__printed + 1,
      })
    }
  })
  await page.getByTestId('receipt-download-pdf').click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed))
    .toBeGreaterThan(0)

  await page.goto(`${href}?copy=1`)
  await expect(page.getByTestId('bm6-copy')).toHaveText('BẢN SAO')
})
