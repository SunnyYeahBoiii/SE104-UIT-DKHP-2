import { ReconciliationDiscrepancyType } from '../../src/generated/prisma/enums'
import type { Db } from './lib'

/** D.6: the sample nightly run (412 bank, 410 stored, 2 backfilled, 1 residual mismatch). */
export async function seedReconciliation(db: Db) {
  const backfilled = await db.bankTransaction.findMany({
    where: { receipt: { isNot: null } },
    orderBy: { id: 'asc' },
    select: { id: true },
  })
  const unmatched = await db.bankTransaction.findFirst({
    where: { code: 'HP2452000120262', status: 'UNMATCHED' },
    orderBy: { id: 'asc' },
    select: { id: true, sepayId: true, amount: true },
  })

  const residualCount = unmatched ? 1 : 0
  await db.reconciliationRun.create({
    data: {
      date: new Date(Date.UTC(2027, 0, 5)),
      bankCount: 412,
      systemCount: 410,
      backfilledCount: backfilled.length,
      residualCount,
      backfilledTransactions: { connect: backfilled.map((row) => ({ id: row.id })) },
      discrepancies: unmatched
        ? {
            create: [
              {
                type: ReconciliationDiscrepancyType.AMOUNT_MISMATCH,
                sepayId: unmatched.sepayId,
                bankTransactionId: unmatched.id,
                bankAmount: unmatched.amount + 200_000n,
                systemAmount: unmatched.amount,
                detail: 'Ngân hàng 1.200.000 đ; hệ thống 1.000.000 đ.',
              },
            ],
          }
        : undefined,
    },
  })
}
