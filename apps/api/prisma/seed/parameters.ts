import type { Prisma } from '../../src/generated/prisma/client'
import type { Db } from './lib'

/** Account that receives tuition transfers; SePay webhooks for any other account are rejected (TT-04). */
export const BANK_ACCOUNT = {
  gateway: 'MBBank',
  accountNumber: '0000000000',
  accountName: 'TRUONG DAI HOC CONG NGHE THONG TIN',
}

/** Requirements §10 defaults. Terms and fee schedules copy their own values, so edits here are not retroactive. */
const PARAMETERS: [key: string, value: Prisma.InputJsonValue, description: string][] = [
  ['registration.mainTerm.minCredits', 14, 'Tín chỉ tối thiểu mỗi học kỳ chính'],
  ['registration.mainTerm.maxCredits', 24, 'Tín chỉ tối đa mỗi học kỳ chính'],
  ['registration.summer.maxCredits', 12, 'Tín chỉ tối đa học kỳ hè'],
  [
    'tuition.theoryCreditRate',
    27_000,
    'Đơn giá tín chỉ lý thuyết mặc định cho bảng phí mới (đồng)',
  ],
  [
    'tuition.practiceCreditRate',
    37_000,
    'Đơn giá tín chỉ thực hành mặc định cho bảng phí mới (đồng)',
  ],
  ['grading.passThreshold', 5, 'Ngưỡng Đạt của điểm học phần'],
  ['examBan.jobDelayMinutes', 60, 'Độ trễ job cấm thi sau hạn đóng học phí'],
  ['registration.pollingIntervalSeconds', 5, 'Chu kỳ polling trang đăng ký'],
  ['registration.availabilityCacheTtlSeconds', 3, 'TTL cache danh sách lớp và chỗ còn'],
  ['registration.idempotencyTtlHours', 24, 'TTL khoá chống lặp'],
  ['registration.transactionTimeoutMs', 5_000, 'Timeout transaction đăng ký'],
  ['registration.transactionMaxWaitMs', 2_000, 'maxWait transaction đăng ký'],
  ['auth.sessionAbsoluteTtlHours', 8, 'Thời hạn session tuyệt đối'],
  ['payment.bankAccount', BANK_ACCOUNT, 'Tài khoản nhận học phí (giá trị giả cho môi trường dev)'],
]

export async function seedParameters(db: Db, updatedById: number) {
  await db.systemParameter.createMany({
    data: PARAMETERS.map(([key, value, description]) => ({ key, value, description, updatedById })),
  })
}
