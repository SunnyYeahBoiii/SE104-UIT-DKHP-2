import 'dotenv/config'

import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Prisma 7 never seeds implicitly after `migrate dev` / `migrate reset`; run `bun run db:seed`.
    seed: 'bun prisma/seed/index.ts',
  },
  // Read leniently instead of `env('DATABASE_URL')`, which throws when the variable is missing.
  // `prisma generate` needs no database, and it must work in a fresh clone or CI before any .env exists;
  // commands that do connect still fail loudly without a URL.
  ...(process.env.DATABASE_URL && { datasource: { url: process.env.DATABASE_URL } }),
})
