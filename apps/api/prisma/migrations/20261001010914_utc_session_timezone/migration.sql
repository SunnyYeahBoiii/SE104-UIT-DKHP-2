-- @prisma/adapter-pg sends Date parameters as UTC wall-clock text without an offset and, when reading,
-- relabels whatever offset Postgres returns as +00:00. Both directions are only correct when the session
-- time zone is UTC. A server-side default (rather than a connection option) also holds behind PgBouncer
-- (ADR-0009), which does not forward startup options. PrismaService refuses to start if this is missing.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
