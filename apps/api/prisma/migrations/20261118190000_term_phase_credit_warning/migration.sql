-- DK-08: mark forms below minCredits at finalization so the academic office can report them.
-- Warning only: no constraint blocks a form from being finalized. The unique key keeps the
-- term-phase job idempotent when it is retried or run by two workers at once.

-- CreateTable
CREATE TABLE "credit_warning" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "min_credits" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_warning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_warning_student_id_term_id_key" ON "credit_warning"("student_id", "term_id");

-- AddForeignKey
ALTER TABLE "credit_warning" ADD CONSTRAINT "credit_warning_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_warning" ADD CONSTRAINT "credit_warning_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
