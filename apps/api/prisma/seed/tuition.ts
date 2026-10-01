import {
  BankTransactionStatus,
  EnrollmentStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentChannel,
  TermType,
} from '../../src/generated/prisma/enums'
import { type EnrollmentRecord, studiesIn } from './academics'
import type { Catalog } from './catalog'
import { addDays, addHours, type Db, must, percentOf } from './lib'
import { BANK_ACCOUNT } from './parameters'
import type { People, StudentInfo } from './people'
import { DEMO } from './scenarios'
import { ACTIVE_TERMS, OPEN_TERM, type TermInfo } from './terms'

/** Amount the overpaid demo student sends on top of the 20252 balance (HP-11). */
const OVERPAYMENT = 500_000n

type Payment = { amount: bigint; channel: PaymentChannel; paidAt: Date }

const money = (amount: bigint) => `${amount.toLocaleString('vi-VN')} đ`
const termLabel = (code: string) => {
  const year = Number(code.slice(0, 4))
  return `${code.endsWith('3') ? 'HK hè' : `HK${code.slice(4)}`} ${year}–${year + 1}`
}
/** SePay sends bank-local time without an offset. */
const sepayTime = (moment: Date) => addHours(moment, 7).toISOString().slice(0, 19).replace('T', ' ')

/**
 * Who pays what. The regular pattern: past terms are paid in full before the deadline, the in-progress term
 * is a mix of unpaid, partly paid at the counter and paid by transfer, the open term is not paid yet.
 */
function paymentsFor(student: StudentInfo, term: TermInfo, due: bigint, now: Date): Payment[] {
  if (due <= 0n || term.code === OPEN_TERM) return []
  const channel = student.index % 2 === 0 ? PaymentChannel.BANK_TRANSFER : PaymentChannel.COUNTER
  const onTime = addDays(term.tuitionDeadline, -(2 + (student.index % 12)))

  if (term.code === '20252' && student.code === DEMO.examBanned) {
    return [
      {
        amount: due,
        channel: PaymentChannel.BANK_TRANSFER,
        paidAt: addDays(term.tuitionDeadline, 10),
      },
    ]
  }
  if (term.code === '20252' && student.code === DEMO.overpaid) {
    return [{ amount: due + OVERPAYMENT, channel: PaymentChannel.BANK_TRANSFER, paidAt: onTime }]
  }
  if (term.code !== '20261') return [{ amount: due, channel, paidAt: onTime }]

  // In progress: the deadline may still be ahead, so nothing is dated after the seed runs.
  const recently = addDays(now, -(1 + (student.index % 10)))
  if (student.code === DEMO.overpaid)
    return [{ amount: due, channel: PaymentChannel.BANK_TRANSFER, paidAt: recently }]
  switch (student.index % 4) {
    case 0:
      return []
    case 1:
      return [{ amount: due / 2n, channel: PaymentChannel.COUNTER, paidAt: recently }]
    default:
      return [{ amount: due, channel: PaymentChannel.BANK_TRANSFER, paidAt: recently }]
  }
}

export async function seedTuition(
  db: Db,
  catalog: Catalog,
  people: People,
  terms: Map<string, TermInfo>,
  enrollments: EnrollmentRecord[],
  now: Date,
) {
  const finance = people.staff.financeOffice
  let nextSepayId = 31_000_001n
  const receiptSequence = new Map<string, number>()

  /** A debit plus, when the student has a priority group, its discount (HP-06: rate frozen now, floored). */
  async function debit(
    student: StudentInfo,
    term: TermInfo,
    type: typeof LedgerEntryType.BASE_TUITION | typeof LedgerEntryType.SURCHARGE,
    amount: bigint,
    description: string,
    createdAt: Date,
    enrollmentId?: number,
  ) {
    const base = { studentId: student.id, termId: term.id, enrollmentId, createdAt }
    const entry = await db.ledgerEntry.create({
      data: { ...base, type, direction: LedgerDirection.DEBIT, amount, description },
    })
    const discount = percentOf(amount, student.discountRate)
    const discountEntry =
      discount > 0n
        ? await db.ledgerEntry.create({
            data: {
              ...base,
              type: LedgerEntryType.DISCOUNT,
              direction: LedgerDirection.CREDIT,
              amount: discount,
              discountRate: student.discountRate,
              relatedEntryId: entry.id,
              description: `Giảm ${student.discountRate}% — ${description}`,
            },
          })
        : undefined
    return { entry, discountEntry, net: amount - discount }
  }

  async function pay(student: StudentInfo, term: TermInfo, { amount, channel, paidAt }: Payment) {
    const sequence = (receiptSequence.get(term.code) ?? 0) + 1
    receiptSequence.set(term.code, sequence)
    const receiptNumber = `PT-${term.code}-${String(sequence).padStart(5, '0')}`

    let bankTransactionId: number | undefined
    if (channel === PaymentChannel.BANK_TRANSFER) {
      const sepayId = nextSepayId++
      const code = `HP${student.code}${term.code}` // TT-02
      const content = `${code} nop hoc phi`
      const referenceCode = `FT${sepayId}`
      const transaction = await db.bankTransaction.create({
        data: {
          sepayId,
          gateway: BANK_ACCOUNT.gateway,
          accountNumber: BANK_ACCOUNT.accountNumber,
          transactionDate: paidAt,
          code,
          content,
          referenceCode,
          amount,
          status: BankTransactionStatus.MATCHED,
          matchedStudentId: student.id,
          matchedTermId: term.id,
          rawPayload: {
            id: Number(sepayId),
            gateway: BANK_ACCOUNT.gateway,
            transactionDate: sepayTime(paidAt),
            accountNumber: BANK_ACCOUNT.accountNumber,
            code,
            content,
            transferType: 'in',
            transferAmount: Number(amount),
            accumulated: 0,
            subAccount: null,
            referenceCode,
            description: `BankAPINotify ${content}`,
          },
          receivedAt: addDays(paidAt, 0.0001),
          processedAt: addDays(paidAt, 0.0002),
        },
      })
      bankTransactionId = transaction.id
    }

    const counter = channel === PaymentChannel.COUNTER
    const receipt = await db.receipt.create({
      data: {
        receiptNumber,
        studentId: student.id,
        termId: term.id,
        channel,
        amount,
        paidAt,
        bankTransactionId,
        collectedById: counter ? finance : null,
        createdAt: paidAt,
      },
    })
    await db.ledgerEntry.create({
      data: {
        studentId: student.id,
        termId: term.id,
        type: LedgerEntryType.PAYMENT,
        direction: LedgerDirection.CREDIT,
        amount,
        receiptId: receipt.id,
        description: `Phiếu thu ${receiptNumber}`,
        createdById: counter ? finance : null,
        createdAt: paidAt,
      },
    })
    return receipt
  }

  for (const termCode of ACTIVE_TERMS) {
    const term = must(terms, termCode)
    const termEnrollments = enrollments.filter((e) => e.termCode === termCode)

    for (const student of people.students) {
      let due = 0n

      // HP-02: fixed tuition for every student studying in a main term, posted when registration opens.
      if (term.type !== TermType.SUMMER && studiesIn(student, termCode)) {
        const { baseTuition } = must(catalog.cohorts, student.cohort)
        due += (
          await debit(
            student,
            term,
            LedgerEntryType.BASE_TUITION,
            baseTuition,
            `Học phí cố định ${termLabel(termCode)}`,
            term.registrationStartAt,
          )
        ).net
      }

      // HP-03..05: surcharges at registration time, reversed when the line is cancelled.
      for (const e of termEnrollments.filter((e) => e.student === student && e.surcharge > 0n)) {
        const posted = await debit(
          student,
          term,
          LedgerEntryType.SURCHARGE,
          e.surcharge,
          `Phụ thu ${e.courseCode} (${e.attemptType})`,
          e.registeredAt,
          e.id,
        )
        due += posted.net
        if (e.status !== EnrollmentStatus.CANCELLED || !e.cancelledAt) continue

        const reversal = {
          studentId: student.id,
          termId: term.id,
          enrollmentId: e.id,
          createdAt: e.cancelledAt,
        }
        await db.ledgerEntry.create({
          data: {
            ...reversal,
            type: LedgerEntryType.SURCHARGE_REVERSAL,
            direction: LedgerDirection.CREDIT,
            amount: e.surcharge,
            relatedEntryId: posted.entry.id,
            description: `Huỷ ${e.courseCode}: đảo phụ thu`,
          },
        })
        if (posted.discountEntry) {
          await db.ledgerEntry.create({
            data: {
              ...reversal,
              type: LedgerEntryType.DISCOUNT_REVERSAL,
              direction: LedgerDirection.DEBIT,
              amount: posted.discountEntry.amount,
              discountRate: posted.discountEntry.discountRate,
              relatedEntryId: posted.discountEntry.id,
              description: `Huỷ ${e.courseCode}: đảo giảm trừ`,
            },
          })
        }
        due -= posted.net
      }

      // HP-11: last term's credit balance comes off this term.
      if (termCode === '20261' && student.code === DEMO.overpaid) {
        const previous = must(terms, '20252')
        const out = await db.ledgerEntry.create({
          data: {
            studentId: student.id,
            termId: previous.id,
            type: LedgerEntryType.BALANCE_CARRY_OUT,
            direction: LedgerDirection.DEBIT,
            amount: OVERPAYMENT,
            description: `Chuyển số dư có sang ${termLabel(termCode)}`,
            createdAt: term.registrationStartAt,
          },
        })
        await db.ledgerEntry.create({
          data: {
            studentId: student.id,
            termId: term.id,
            type: LedgerEntryType.BALANCE_CARRY_IN,
            direction: LedgerDirection.CREDIT,
            amount: OVERPAYMENT,
            relatedEntryId: out.id,
            description: `Số dư có chuyển từ ${termLabel(previous.code)}`,
            createdAt: term.registrationStartAt,
          },
        })
        due -= OVERPAYMENT
      }

      for (const payment of paymentsFor(student, term, due, now)) {
        const receipt = await pay(student, term, payment)
        if (termCode === '20261' && payment.channel === PaymentChannel.BANK_TRANSFER) {
          await db.notification.create({
            data: {
              userId: student.userId,
              type: 'PAYMENT_RECEIVED',
              title: 'Đã nhận học phí',
              body: `Đã ghi nhận ${money(payment.amount)} học phí ${termLabel(termCode)} (phiếu thu ${receipt.receiptNumber}).`,
              data: { receiptId: receipt.id, termCode },
              createdAt: addDays(payment.paidAt, 0.0003),
            },
          })
        }
      }

      // CT-01, CT-02: the ban job ran an hour after the deadline; paying late afterwards does not lift it.
      if (termCode === '20252' && student.code === DEMO.examBanned) {
        const bannedAt = addHours(term.tuitionDeadline, 1)
        await db.examBan.create({
          data: {
            studentId: student.id,
            termId: term.id,
            outstandingAmount: due,
            createdAt: bannedAt,
          },
        })
        await db.notification.create({
          data: {
            userId: student.userId,
            type: 'EXAM_BAN',
            title: 'Bị cấm thi do chưa đóng đủ học phí',
            body: `Quá hạn đóng học phí ${termLabel(termCode)} còn nợ ${money(due)}. Bạn bị cấm thi cuối kỳ ở mọi lớp của học kỳ này.`,
            data: { termCode },
            createdAt: bannedAt,
          },
        })
      }
    }
  }

  // TT-07: transfers the worker could not match wait in the finance office's queue.
  const unmatched = [
    { content: 'chuyen tien hoc phi cho em', code: null, amount: 2_000_000n, daysAgo: 3 },
    {
      content: 'HP2452999920261 nop hoc phi',
      code: 'HP2452999920261',
      amount: 1_250_000n,
      daysAgo: 1,
    },
  ]
  for (const t of unmatched) {
    const sepayId = nextSepayId++
    const transactionDate = addDays(now, -t.daysAgo)
    await db.bankTransaction.create({
      data: {
        sepayId,
        gateway: BANK_ACCOUNT.gateway,
        accountNumber: BANK_ACCOUNT.accountNumber,
        transactionDate,
        code: t.code,
        content: t.content,
        referenceCode: `FT${sepayId}`,
        amount: t.amount,
        status: BankTransactionStatus.UNMATCHED,
        rawPayload: {
          id: Number(sepayId),
          gateway: BANK_ACCOUNT.gateway,
          transactionDate: sepayTime(transactionDate),
          accountNumber: BANK_ACCOUNT.accountNumber,
          code: t.code,
          content: t.content,
          transferType: 'in',
          transferAmount: Number(t.amount),
          accumulated: 0,
          subAccount: null,
          referenceCode: `FT${sepayId}`,
          description: `BankAPINotify ${t.content}`,
        },
        receivedAt: addDays(transactionDate, 0.0001),
        processedAt: addDays(transactionDate, 0.0002),
      },
    })
  }
}
