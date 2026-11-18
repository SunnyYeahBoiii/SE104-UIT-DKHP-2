import {
  BankTransactionStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentChannel,
} from '../../src/generated/prisma/enums'
import type { EnrollmentRecord } from './academics'
import type { Catalog } from './catalog'
import { addHours, type Db, must, percentOf, vn } from './lib'
import { BANK_ACCOUNT } from './parameters'
import type { People, StudentInfo } from './people'
import { DEMO, DEMO_NOW } from './scenarios'
import { IN_PROGRESS_TERM, OPEN_TERM, type TermInfo } from './terms'

/** A.7 fee table. K20 · CLC is deliberately absent so the missing-schedule warning has a case. */
const FEES: [cohort: string, system: string, base: bigint, theory: bigint, practice: bigint][] = [
  ['K19', 'CQUI', 15_000_000n, 27_000n, 37_000n],
  ['K19', 'CLC', 20_000_000n, 27_000n, 37_000n],
  ['K18', 'CQUI', 14_500_000n, 27_000n, 37_000n],
  ['K20', 'CQUI', 15_500_000n, 27_000n, 37_000n],
]

const OVERPAYMENT = 500_000n

const feeKey = (cohort: string, system: string) => `${cohort}:${system}`
const sepayTime = (moment: Date) => addHours(moment, 7).toISOString().slice(0, 19).replace('T', ' ')

export async function seedTuition(
  db: Db,
  catalog: Catalog,
  people: People,
  terms: Map<string, TermInfo>,
  enrollments: EnrollmentRecord[],
) {
  const fees = new Map<string, { base: bigint; theory: bigint; practice: bigint }>()
  for (const [cohort, system, base, theory, practice] of FEES) {
    await db.feeSchedule.create({
      data: {
        cohortId: must(catalog.cohorts, cohort).id,
        trainingSystemId: must(catalog.systems, system),
        baseTuition: base,
        theoryCreditRate: theory,
        practiceCreditRate: practice,
      },
    })
    fees.set(feeKey(cohort, system), { base, theory, practice })
  }
  const feeFor = (student: StudentInfo) => fees.get(feeKey(student.cohort, student.system))

  type EntryOptions = {
    discountRate?: number
    description?: string
    enrollmentId?: number
    receiptId?: number
    relatedEntryId?: number
    createdAt?: Date
    createdById?: number
  }

  async function post(
    studentCode: string,
    termCode: string,
    type: LedgerEntryType,
    direction: LedgerDirection,
    amount: bigint,
    options: EntryOptions = {},
  ) {
    return db.ledgerEntry.create({
      data: {
        studentId: must(people.students, studentCode).id,
        termId: must(terms, termCode).id,
        type,
        direction,
        amount,
        discountRate: options.discountRate ?? null,
        description: options.description ?? null,
        enrollmentId: options.enrollmentId ?? null,
        receiptId: options.receiptId ?? null,
        relatedEntryId: options.relatedEntryId ?? null,
        createdById: options.createdById ?? null,
        createdAt: options.createdAt ?? new Date(),
      },
    })
  }

  /** A debit and, when applicable, its HP-06 discount; returns the net amount owed. */
  async function debit(
    student: StudentInfo,
    termCode: string,
    type: typeof LedgerEntryType.BASE_TUITION | typeof LedgerEntryType.SURCHARGE,
    amount: bigint,
    description: string,
    options: EntryOptions = {},
  ) {
    const entry = await post(student.code, termCode, type, LedgerDirection.DEBIT, amount, {
      ...options,
      description,
    })
    let net = amount
    if (student.discountRate > 0) {
      const discount = percentOf(amount, student.discountRate)
      if (discount > 0n) {
        const credit = await post(
          student.code,
          termCode,
          LedgerEntryType.DISCOUNT,
          LedgerDirection.CREDIT,
          discount,
          {
            ...options,
            discountRate: student.discountRate,
            relatedEntryId: entry.id,
            description: `Giảm ${student.discountRate}% — ${description}`,
          },
        )
        net -= credit.amount
      }
    }
    return { entry, net }
  }

  const receiptSequence = new Map<string, number>()
  async function pay(
    studentCode: string,
    termCode: string,
    amount: bigint,
    channel: PaymentChannel,
    paidAt: Date,
  ) {
    const term = must(terms, termCode)
    const student = must(people.students, studentCode)
    const sequence = (receiptSequence.get(termCode) ?? (termCode === OPEN_TERM ? 11 : 1)) + 1
    receiptSequence.set(termCode, sequence)
    const receiptNumber = `PT-${termCode}-${String(sequence).padStart(5, '0')}`

    let bankTransactionId: number | null = null
    if (channel === PaymentChannel.BANK_TRANSFER) {
      const code = `HP${studentCode}${termCode}` // TT-02
      const content = `${code} nop hoc phi`
      const transaction = await db.bankTransaction.create({
        data: {
          sepayId: BigInt(31_000_000 + sequence + Number(termCode)),
          gateway: BANK_ACCOUNT.gateway,
          accountNumber: BANK_ACCOUNT.accountNumber,
          transactionDate: paidAt,
          code,
          content,
          referenceCode: `FT${sequence}`,
          amount,
          status: BankTransactionStatus.MATCHED,
          matchedStudentId: student.id,
          matchedTermId: term.id,
          rawPayload: {
            gateway: BANK_ACCOUNT.gateway,
            transactionDate: sepayTime(paidAt),
            accountNumber: BANK_ACCOUNT.accountNumber,
            code,
            content,
            transferType: 'in',
            transferAmount: Number(amount),
            referenceCode: `FT${sequence}`,
          },
          receivedAt: addHours(paidAt, 0.01),
          processedAt: addHours(paidAt, 0.02),
        },
      })
      bankTransactionId = transaction.id
    }

    const receipt = await db.receipt.create({
      data: {
        receiptNumber,
        studentId: student.id,
        termId: term.id,
        channel,
        amount,
        paidAt,
        bankTransactionId,
        collectedById: channel === PaymentChannel.COUNTER ? people.cashier : null,
        createdAt: paidAt,
      },
    })
    await post(studentCode, termCode, LedgerEntryType.PAYMENT, LedgerDirection.CREDIT, amount, {
      receiptId: receipt.id,
      createdById: channel === PaymentChannel.COUNTER ? people.cashier : undefined,
      createdAt: paidAt,
      description: `Phiếu thu ${receiptNumber}`,
    })
    return receipt
  }

  // HP-02: fixed tuition is posted when each main term enters REGISTRATION.
  for (const termCode of [IN_PROGRESS_TERM, OPEN_TERM]) {
    const term = must(terms, termCode)
    for (const student of people.students.values()) {
      const schedule = feeFor(student)
      if (!schedule) continue // K20 · CLC: no fee schedule on purpose.
      if (termCode === OPEN_TERM && student.code === DEMO.recalculated) {
        // HP-12: CQUI → CLC during the registration period; the registered classes stay as they were.
        const original = await debit(
          student,
          termCode,
          LedgerEntryType.BASE_TUITION,
          must(fees, feeKey(student.cohort, 'CQUI')).base,
          `Học phí cố định HK2 2026–2027 (hồ sơ cũ)`,
          { createdAt: term.registrationStartAt },
        )
        await post(
          student.code,
          termCode,
          LedgerEntryType.BASE_TUITION_REVERSAL,
          LedgerDirection.CREDIT,
          original.entry.amount,
          {
            relatedEntryId: original.entry.id,
            createdAt: addHours(term.registrationStartAt, 2),
            description: 'Tính lại học phí: đảo học phí cố định cũ',
          },
        )
        await debit(
          { ...student, system: 'CLC' },
          termCode,
          LedgerEntryType.BASE_TUITION,
          schedule.base,
          'Học phí cố định HK2 2026–2027 (hồ sơ mới CLC)',
          { createdAt: addHours(term.registrationStartAt, 3), relatedEntryId: original.entry.id },
        )
        continue
      }
      await debit(
        student,
        termCode,
        LedgerEntryType.BASE_TUITION,
        schedule.base,
        `Học phí cố định ${termCode === IN_PROGRESS_TERM ? 'HK1' : 'HK2'} 2026–2027`,
        { createdAt: term.registrationStartAt },
      )
    }
  }

  // HP-03..05: surcharges at registration, reversed (with their discount) when a line is cancelled.
  for (const record of enrollments) {
    if (record.surcharge <= 0n) continue
    const student = must(people.students, record.studentCode)
    const posted = await debit(
      student,
      record.termCode,
      LedgerEntryType.SURCHARGE,
      record.surcharge,
      `Phụ thu ${record.courseCode} (${record.attemptType})`,
      { enrollmentId: record.id, createdAt: record.registeredAt },
    )
    if (!record.cancelledAt) continue
    const reversal = { enrollmentId: record.id, createdAt: record.cancelledAt }
    await post(
      record.studentCode,
      record.termCode,
      LedgerEntryType.SURCHARGE_REVERSAL,
      LedgerDirection.CREDIT,
      posted.entry.amount,
      {
        ...reversal,
        relatedEntryId: posted.entry.id,
        description: `Huỷ ${record.courseCode}: đảo phụ thu`,
      },
    )
  }

  // HP-11: the 500.000đ overpayment in 20261 becomes a credit in the open term.
  const previous = must(terms, IN_PROGRESS_TERM)
  const next = must(terms, OPEN_TERM)
  const carryOut = await post(
    DEMO.overpaid,
    IN_PROGRESS_TERM,
    LedgerEntryType.BALANCE_CARRY_OUT,
    LedgerDirection.DEBIT,
    OVERPAYMENT,
    {
      createdAt: next.registrationStartAt,
      description: `Chuyển số dư có sang HK2 2026–2027`,
    },
  )
  await post(
    DEMO.overpaid,
    OPEN_TERM,
    LedgerEntryType.BALANCE_CARRY_IN,
    LedgerDirection.CREDIT,
    OVERPAYMENT,
    {
      relatedEntryId: carryOut.id,
      createdAt: next.registrationStartAt,
      description: 'Số dư có chuyển từ HK1 2026–2027',
    },
  )

  // 20261: everyone settles before the deadline except the 5M overdue and the 500k overpayment.
  for (const student of people.students.values()) {
    const schedule = feeFor(student)
    if (!schedule) continue
    const paidAt = addHours(previous.registrationStartAt, 24)
    if (student.code === DEMO.overdue) {
      await pay(student.code, IN_PROGRESS_TERM, 10_000_000n, PaymentChannel.COUNTER, paidAt)
    } else {
      const net = schedule.base - percentOf(schedule.base, student.discountRate)
      const amount = student.code === DEMO.overpaid ? schedule.base + OVERPAYMENT : net
      const channel =
        student.code === DEMO.overpaid ? PaymentChannel.BANK_TRANSFER : PaymentChannel.COUNTER
      await pay(student.code, IN_PROGRESS_TERM, amount, channel, paidAt)
    }
  }

  // 20262: two settled examples; every other A.7 student still has a QR to pay.
  await pay(
    DEMO.discount80,
    OPEN_TERM,
    3_000_000n,
    PaymentChannel.BANK_TRANSFER,
    vn('2027-01-06', '09:00'),
  )
  await pay(
    DEMO.twoGroups,
    OPEN_TERM,
    4_500_000n,
    PaymentChannel.COUNTER,
    vn('2027-01-06', '09:30'),
  )

  // TT-07: transfers the worker could not match wait in the finance office's queue. One uses the A.7
  // sample payment code HP2452000120262; the other has no readable code.
  const unmatched: [code: string | null, content: string, amount: bigint][] = [
    ['HP2452000120262', 'HP2452000120262 nop hoc phi', 1_000_000n],
    [null, 'chuyen tien hoc phi cho em', 2_000_000n],
  ]
  for (const [index, [code, content, amount]] of unmatched.entries()) {
    const transactionDate = addHours(DEMO_NOW, -(index + 1))
    await db.bankTransaction.create({
      data: {
        sepayId: 31_990_000n + BigInt(index),
        gateway: BANK_ACCOUNT.gateway,
        accountNumber: BANK_ACCOUNT.accountNumber,
        transactionDate,
        code,
        content,
        referenceCode: `FT99${index}`,
        amount,
        status: BankTransactionStatus.UNMATCHED,
        rawPayload: {
          gateway: BANK_ACCOUNT.gateway,
          transactionDate: sepayTime(transactionDate),
          accountNumber: BANK_ACCOUNT.accountNumber,
          code,
          content,
          transferType: 'in',
          transferAmount: Number(amount),
          referenceCode: `FT99${index}`,
        },
        receivedAt: addHours(transactionDate, 0.01),
        processedAt: addHours(transactionDate, 0.02),
      },
    })
  }
}
