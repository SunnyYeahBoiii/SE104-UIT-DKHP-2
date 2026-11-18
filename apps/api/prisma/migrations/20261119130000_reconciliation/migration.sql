-- TT-08/QĐ21: daily reconciliation runs and their read-only residual differences.
CREATE TYPE "ReconciliationDiscrepancyType" AS ENUM ('MISSING_AT_BANK', 'AMOUNT_MISMATCH');

ALTER TABLE "bank_transaction" ADD COLUMN "reconciliation_run_id" INTEGER;

CREATE TABLE "reconciliation_run" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "bank_count" INTEGER NOT NULL,
    "system_count" INTEGER NOT NULL,
    "backfilled_count" INTEGER NOT NULL,
    "residual_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reconciliation_discrepancy" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "type" "ReconciliationDiscrepancyType" NOT NULL,
    "sepay_id" BIGINT,
    "bank_transaction_id" INTEGER,
    "bank_amount" BIGINT,
    "system_amount" BIGINT,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_discrepancy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reconciliation_run_date_key" ON "reconciliation_run"("date");
CREATE INDEX "reconciliation_discrepancy_run_id_idx" ON "reconciliation_discrepancy"("run_id");
CREATE INDEX "bank_transaction_reconciliation_run_id_idx" ON "bank_transaction"("reconciliation_run_id");

ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_reconciliation_run_id_fkey" FOREIGN KEY ("reconciliation_run_id") REFERENCES "reconciliation_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reconciliation_discrepancy" ADD CONSTRAINT "reconciliation_discrepancy_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reconciliation_discrepancy" ADD CONSTRAINT "reconciliation_discrepancy_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
