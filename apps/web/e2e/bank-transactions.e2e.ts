import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'Dkhp@2026'

const row = {
  id: 101,
  sepayId: '77000001',
  gateway: 'MBBank',
  accountNumber: '1234567890',
  transactionDate: '2027-01-06T02:15:00.000Z',
  code: null,
  content: 'HP 24520007 hoc phi',
  referenceCode: 'FT77000001',
  amount: 5_500_000,
  status: 'UNMATCHED',
  ignoreReason: null,
  studentCode: null,
  studentName: null,
  termCode: null,
  termName: null,
  receiptNumber: null,
  assignedBy: null,
  processedAt: null,
  suggestedStudentCodes: ['24520007'],
}

const ignored = {
  ...row,
  id: 102,
  sepayId: '77000002',
  content: 'ung ho quy',
  amount: 200_000,
  suggestedStudentCodes: [],
  status: 'IGNORED',
  ignoreReason: 'Khong phai hoc phi',
}

const detail = {
  ...row,
  rawPayload: { id: 77000001, transferType: 'in', transferAmount: 5_500_000 },
  history: [],
}

const preview = {
  studentCode: '24520007',
  studentName: 'Sinh viên thử nghiệm E2E',
  termCode: '20262',
  termName: 'HK2 2026–2027',
  amount: 5_500_000,
  before: {
    grossAmount: 15_000_000,
    discountAmount: 0,
    netAmount: 15_000_000,
    paidAmount: 10_000_000,
    outstandingAmount: 5_000_000,
  },
  after: {
    grossAmount: 15_000_000,
    discountAmount: 0,
    netAmount: 15_000_000,
    paidAmount: 15_500_000,
    outstandingAmount: -500_000,
  },
}

const receipt = {
  number: 'PT-20262-00045',
  amount: 5_500_000,
  amountInWords: 'Năm triệu năm trăm nghìn đồng chẵn',
}

async function loginAndOpen(page: Page) {
  await page.goto('/login')
  await page.getByLabel('MSSV hoặc mã cán bộ').fill('tv.lan')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/staff$/)
  await page.goto('/staff/bank')
  await expect(page.getByRole('heading', { name: 'Giao dịch ngân hàng' })).toBeVisible()
}

async function mockCommon(page: Page, count: () => number, items: () => object[]) {
  await page.route('**/api/bank-transactions/count', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unmatchedCount: count() }),
    }),
  )
  await page.route('**/api/bank-transactions?status=*', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')
    const all = items() as { status: string }[]
    const filtered = status === 'ALL' ? all : all.filter((item) => item.status === status)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: filtered, unmatchedCount: count() }),
    })
  })
  await page.route('**/api/bank-transactions/terms', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ code: '20262', name: 'HK2 2026–2027' }]),
    }),
  )
}

test('D.4.4: tabs, sidebar badge, MSSV suggestions, preview, assign and ignore', async ({
  page,
}) => {
  let unmatchedCount = 2
  await mockCommon(
    page,
    () => unmatchedCount,
    () => [row, ignored],
  )
  await page.route('**/api/bank-transactions/students?q=*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { studentCode: '24520007', fullName: 'Sinh viên thử nghiệm E2E', email: 'e2e@uit.edu.vn' },
      ]),
    }),
  )
  await page.route('**/api/bank-transactions/101', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail) }),
  )
  await page.route('**/api/bank-transactions/101/preview*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preview) }),
  )
  await page.route('**/api/bank-transactions/101/assign', (route) => {
    unmatchedCount -= 1
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        receipt,
        before: preview.before,
        after: preview.after,
        settled: true,
        creditBalance: 500_000,
        transaction: { ...row, status: 'MATCHED' },
      }),
    })
  })

  await loginAndOpen(page)
  await expect(page.getByTestId('sidebar-unmatched-badge')).toHaveText('2')
  await expect(page.getByTestId('tx-unmatched-count')).toHaveText('2')
  await expect(page.getByTestId('tx-row')).toHaveCount(1)
  await expect(page.getByTestId('tx-status')).toHaveText('Chưa khớp')

  await page.getByTestId('tx-tab-all').click()
  await expect(page.getByTestId('tx-row')).toHaveCount(2)
  await page.getByTestId('tx-tab-ignored').click()
  await expect(page.getByTestId('tx-row')).toHaveCount(1)
  await expect(page.getByTestId('tx-status')).toHaveText('Bỏ qua')
  await page.getByTestId('tx-tab-unmatched').click()

  await page.getByTestId('tx-row').click()
  await expect(page.getByTestId('tx-drawer')).toBeVisible()
  await expect(page.getByTestId('tx-raw')).toContainText('"transferType": "in"')
  await expect(page.getByTestId('tx-history')).toContainText('Chưa có thao tác nào.')
  await expect(page.getByTestId('tx-suggested-codes')).toContainText('24520007')
  await expect(page.getByTestId('tx-suggestion')).toContainText('24520007')
  await page.getByTestId('tx-suggestion').click()
  await page.getByTestId('tx-term').selectOption('20262')
  await expect(page.getByTestId('tx-preview')).toContainText('5.000.000 đ')
  await expect(page.getByTestId('tx-preview-after')).toHaveText('-500.000 đ')
  await expect(page.getByTestId('tx-credit-balance')).toContainText('500.000 đ')

  await page.getByTestId('tx-assign-open').click()
  await expect(page.getByTestId('tx-assign-confirm')).toBeVisible()
  await page.getByTestId('tx-assign-ok').click()
  await expect(page.getByTestId('tx-receipt')).toContainText('PT-20262-00045')
  await expect(page.getByTestId('tx-settled')).toBeVisible()
  await expect(page.getByTestId('sidebar-unmatched-badge')).toHaveText('1')
})

test('D.4.4: ignoring a transfer requires a reason and records it', async ({ page }) => {
  await mockCommon(
    page,
    () => 1,
    () => [{ ...ignored, status: 'UNMATCHED', ignoreReason: null }],
  )
  let dismissed = false
  await page.route('**/api/bank-transactions/102', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...detail,
        id: 102,
        status: dismissed ? 'IGNORED' : 'UNMATCHED',
        ignoreReason: dismissed ? 'Khong phai hoc phi' : null,
        content: 'ung ho quy',
        amount: 200_000,
        history: dismissed
          ? [
              {
                action: 'BANK_TRANSACTION_IGNORED',
                actorName: 'Ngô Thị Lan',
                createdAt: '2027-01-06T03:00:00.000Z',
                payload: {},
              },
            ]
          : [],
      }),
    }),
  )
  await page.route('**/api/bank-transactions/102/ignore', async (route) => {
    const body = (await route.request().postDataJSON()) as { reason?: string }
    if (!body.reason?.trim())
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'IGNORE_REASON_REQUIRED', message: 'Bắt buộc có lý do.' }),
      })
    dismissed = true
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(ignored),
    })
  })

  await loginAndOpen(page)
  await page.getByTestId('tx-row').click()
  await expect(page.getByTestId('tx-ignore-submit')).toBeDisabled()
  await page.getByTestId('tx-ignore-reason').fill('Khong phai hoc phi')
  await expect(page.getByTestId('tx-ignore-submit')).toBeEnabled()
  await page.getByTestId('tx-ignore-submit').click()
  await expect(page.getByTestId('tx-ignore-reason-view')).toHaveText('Khong phai hoc phi')
  await expect(page.getByTestId('tx-history')).toContainText('BANK_TRANSACTION_IGNORED')
})
