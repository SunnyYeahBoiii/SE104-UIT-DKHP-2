/* eslint-disable no-console -- CLI script: stdout is its report */
/**
 * Development seed. Wipes every table and rebuilds a deterministic dataset around "now": the open term's
 * registration window always contains the moment the seed runs. Run with `bun run db:seed`.
 */
import { seedAcademics } from './academics'
import { seedCatalog } from './catalog'
import { createClient, type Db } from './lib'
import { seedParameters } from './parameters'
import { seedPeople } from './people'
import { DEMO, DEV_PASSWORD } from './scenarios'
import { seedStatuses } from './status'
import { seedTerms } from './terms'
import { seedTuition } from './tuition'

/**
 * TRUNCATE rather than deleteMany: the append-only triggers on the ledger, audit log and grade amendments
 * reject row-level DELETE, and RESTART IDENTITY keeps ids stable between runs.
 */
async function wipe(db: Db) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length === 0) return
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
}

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to run the dev seed with NODE_ENV=production')

  const db = createClient()
  const started = performance.now()
  try {
    const now = new Date()
    await wipe(db)
    const catalog = await seedCatalog(db)
    const people = await seedPeople(db, catalog)
    const terms = await seedTerms(db, catalog, now)
    await seedStatuses(db, catalog, people, terms, now)
    const enrollments = await seedAcademics(db, catalog, people, terms, now)
    await seedTuition(db, catalog, people, terms, enrollments, now)
    await seedParameters(db, people.staff.admin)

    const counts = {
      users: await db.user.count(),
      students: await db.student.count(),
      terms: await db.term.count(),
      sections: await db.courseSection.count(),
      enrollments: await db.enrollment.count(),
      componentScores: await db.componentScore.count(),
      ledgerEntries: await db.ledgerEntry.count(),
      receipts: await db.receipt.count(),
      bankTransactions: await db.bankTransaction.count(),
    }
    console.table(counts)
    console.log(
      `Seeded in ${Math.round(performance.now() - started)} ms. Password for every account: ${DEV_PASSWORD}`,
    )
    console.log(
      'Demo accounts:',
      Object.entries(DEMO)
        .map(([scenario, code]) => `${code} (${scenario})`)
        .join(', '),
    )
  } finally {
    await db.$disconnect()
  }
}

await main()
