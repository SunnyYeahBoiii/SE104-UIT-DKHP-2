-- TT-07: keep the finance office's mandatory reason on the dismissed transfer.
ALTER TABLE "bank_transaction" ADD COLUMN "ignore_reason" TEXT;
