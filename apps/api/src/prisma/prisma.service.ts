import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client'

/**
 * The single Prisma client of the API. Prisma 7 talks to Postgres through the `pg` driver adapter, which
 * works behind PgBouncer in transaction mode (ADR-0009).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')

    super({
      adapter: new PrismaPg({ connectionString }),
      // Registration transactions must fail fast instead of queueing behind hot rows (requirements §10).
      transactionOptions: { timeout: 5_000, maxWait: 2_000 },
    })
  }

  async onModuleInit() {
    await this.$connect()
    // The pg adapter only round-trips timestamps correctly in a UTC session; see the utc_session_timezone
    // migration. Failing here beats every deadline silently shifting by the server's offset.
    const [session] = await this.$queryRaw<{ TimeZone: string }[]>`SHOW timezone`
    if (session?.TimeZone !== 'UTC') {
      throw new Error(
        `Postgres session time zone is ${session?.TimeZone}, expected UTC. Run prisma migrate deploy.`,
      )
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
