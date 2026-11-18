-- Constraints comparing ledger_entry.type to literals of the old enum type must go before the
-- enum is replaced; they are re-created with the nine-value enum at the end of this migration.
ALTER TABLE "ledger_entry" DROP CONSTRAINT "ledger_entry_direction_check";
ALTER TABLE "ledger_entry" DROP CONSTRAINT "ledger_entry_discount_rate_check";
ALTER TABLE "ledger_entry" DROP CONSTRAINT "ledger_entry_payment_source_check";
ALTER TABLE "ledger_entry" DROP CONSTRAINT "ledger_entry_adjustment_source_check";

-- AlterEnum
BEGIN;
CREATE TYPE "AttemptType_new" AS ENUM ('FIRST', 'RETAKE', 'IMPROVEMENT');
ALTER TABLE "enrollment" ALTER COLUMN "attempt_type" TYPE "AttemptType_new" USING ("attempt_type"::text::"AttemptType_new");
ALTER TYPE "AttemptType" RENAME TO "AttemptType_old";
ALTER TYPE "AttemptType_new" RENAME TO "AttemptType";
DROP TYPE "public"."AttemptType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LedgerEntryType_new" AS ENUM ('BASE_TUITION', 'BASE_TUITION_REVERSAL', 'SURCHARGE', 'SURCHARGE_REVERSAL', 'DISCOUNT', 'DISCOUNT_REVERSAL', 'PAYMENT', 'BALANCE_CARRY_OUT', 'BALANCE_CARRY_IN');
ALTER TABLE "ledger_entry" ALTER COLUMN "type" TYPE "LedgerEntryType_new" USING ("type"::text::"LedgerEntryType_new");
ALTER TYPE "LedgerEntryType" RENAME TO "LedgerEntryType_old";
ALTER TYPE "LedgerEntryType_new" RENAME TO "LedgerEntryType";
DROP TYPE "public"."LedgerEntryType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'ACADEMIC_OFFICE', 'FINANCE_OFFICE');
ALTER TABLE "user_account" ALTER COLUMN "roles" TYPE "Role_new"[] USING ("roles"::text::"Role_new"[]);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "adjustment" DROP CONSTRAINT "adjustment_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "adjustment" DROP CONSTRAINT "adjustment_student_id_fkey";

-- DropForeignKey
ALTER TABLE "adjustment" DROP CONSTRAINT "adjustment_term_id_fkey";

-- DropForeignKey
ALTER TABLE "component_score" DROP CONSTRAINT "component_score_component_id_fkey";

-- DropForeignKey
ALTER TABLE "component_score" DROP CONSTRAINT "component_score_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "course" DROP CONSTRAINT "course_faculty_id_fkey";

-- DropForeignKey
ALTER TABLE "curriculum" DROP CONSTRAINT "curriculum_cohort_id_fkey";

-- DropForeignKey
ALTER TABLE "curriculum" DROP CONSTRAINT "curriculum_major_id_fkey";

-- DropForeignKey
ALTER TABLE "curriculum_course" DROP CONSTRAINT "curriculum_course_course_id_fkey";

-- DropForeignKey
ALTER TABLE "curriculum_course" DROP CONSTRAINT "curriculum_course_knowledge_block_id_fkey";

-- DropForeignKey
ALTER TABLE "district" DROP CONSTRAINT "district_province_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_ban" DROP CONSTRAINT "exam_ban_lifted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_ban" DROP CONSTRAINT "exam_ban_student_id_fkey";

-- DropForeignKey
ALTER TABLE "exam_ban" DROP CONSTRAINT "exam_ban_term_id_fkey";

-- DropForeignKey
ALTER TABLE "grade_amendment" DROP CONSTRAINT "grade_amendment_amended_by_id_fkey";

-- DropForeignKey
ALTER TABLE "grade_amendment" DROP CONSTRAINT "grade_amendment_component_id_fkey";

-- DropForeignKey
ALTER TABLE "grade_amendment" DROP CONSTRAINT "grade_amendment_enrollment_id_fkey";

-- DropForeignKey
ALTER TABLE "grade_component" DROP CONSTRAINT "grade_component_gradebook_id_fkey";

-- DropForeignKey
ALTER TABLE "gradebook" DROP CONSTRAINT "gradebook_locked_by_id_fkey";

-- DropForeignKey
ALTER TABLE "gradebook" DROP CONSTRAINT "gradebook_section_id_fkey";

-- DropForeignKey
ALTER TABLE "gradebook" DROP CONSTRAINT "gradebook_submitted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_block" DROP CONSTRAINT "knowledge_block_curriculum_id_fkey";

-- DropForeignKey
ALTER TABLE "leave_decision" DROP CONSTRAINT "leave_decision_decided_by_id_fkey";

-- DropForeignKey
ALTER TABLE "leave_decision" DROP CONSTRAINT "leave_decision_student_id_fkey";

-- DropForeignKey
ALTER TABLE "leave_decision" DROP CONSTRAINT "leave_decision_term_id_fkey";

-- DropForeignKey
ALTER TABLE "lecturer" DROP CONSTRAINT "lecturer_faculty_id_fkey";

-- DropForeignKey
ALTER TABLE "lecturer" DROP CONSTRAINT "lecturer_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ledger_entry" DROP CONSTRAINT "ledger_entry_adjustment_id_fkey";

-- DropForeignKey
ALTER TABLE "major" DROP CONSTRAINT "major_faculty_id_fkey";

-- DropForeignKey
ALTER TABLE "notification" DROP CONSTRAINT "notification_user_id_fkey";

-- DropForeignKey
ALTER TABLE "student" DROP CONSTRAINT "student_hometown_district_id_fkey";

-- DropForeignKey
ALTER TABLE "student" DROP CONSTRAINT "student_major_id_fkey";

-- DropForeignKey
ALTER TABLE "student_status_decision" DROP CONSTRAINT "student_status_decision_decided_by_id_fkey";

-- DropForeignKey
ALTER TABLE "student_status_decision" DROP CONSTRAINT "student_status_decision_effective_term_id_fkey";

-- DropForeignKey
ALTER TABLE "student_status_decision" DROP CONSTRAINT "student_status_decision_student_id_fkey";

-- DropIndex
DROP INDEX "fee_schedule_cohort_id_key";

-- DropIndex
DROP INDEX "lecturer_user_id_key";

-- DropIndex
DROP INDEX "student_cohort_id_major_id_idx";

-- AlterTable
ALTER TABLE "course" DROP COLUMN "faculty_id";

-- AlterTable
ALTER TABLE "course_section" ADD COLUMN     "language" TEXT,
ADD COLUMN     "training_system_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "fee_schedule" ADD COLUMN     "training_system_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "lecturer" DROP COLUMN "faculty_id",
DROP COLUMN "user_id";

-- AlterTable
ALTER TABLE "ledger_entry" DROP COLUMN "adjustment_id";

-- AlterTable
ALTER TABLE "student" DROP COLUMN "date_of_birth",
DROP COLUMN "gender",
DROP COLUMN "hometown_district_id",
DROP COLUMN "major_id",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "training_system_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "adjustment";

-- DropTable
DROP TABLE "component_score";

-- DropTable
DROP TABLE "curriculum";

-- DropTable
DROP TABLE "curriculum_course";

-- DropTable
DROP TABLE "district";

-- DropTable
DROP TABLE "exam_ban";

-- DropTable
DROP TABLE "faculty";

-- DropTable
DROP TABLE "grade_amendment";

-- DropTable
DROP TABLE "grade_component";

-- DropTable
DROP TABLE "gradebook";

-- DropTable
DROP TABLE "knowledge_block";

-- DropTable
DROP TABLE "leave_decision";

-- DropTable
DROP TABLE "major";

-- DropTable
DROP TABLE "notification";

-- DropTable
DROP TABLE "province";

-- DropTable
DROP TABLE "student_status_decision";

-- DropEnum
DROP TYPE "Gender";

-- DropEnum
DROP TYPE "GradebookStatus";

-- DropEnum
DROP TYPE "KnowledgeBlockType";

-- DropEnum
DROP TYPE "StudentStatus";

-- CreateTable
CREATE TABLE "training_system" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "training_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taken_course" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "course_score" DECIMAL(3,1),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taken_course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_system_code_key" ON "training_system"("code");

-- CreateIndex
CREATE INDEX "taken_course_student_id_course_id_idx" ON "taken_course"("student_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "taken_course_student_id_term_id_course_id_key" ON "taken_course"("student_id", "term_id", "course_id");

-- CreateIndex
CREATE INDEX "course_section_training_system_id_idx" ON "course_section"("training_system_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedule_cohort_id_training_system_id_key" ON "fee_schedule"("cohort_id", "training_system_id");

-- CreateIndex
CREATE INDEX "student_cohort_id_training_system_id_idx" ON "student"("cohort_id", "training_system_id");

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_training_system_id_fkey" FOREIGN KEY ("training_system_id") REFERENCES "training_system"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_section" ADD CONSTRAINT "course_section_training_system_id_fkey" FOREIGN KEY ("training_system_id") REFERENCES "training_system"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taken_course" ADD CONSTRAINT "taken_course_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taken_course" ADD CONSTRAINT "taken_course_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taken_course" ADD CONSTRAINT "taken_course_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedule" ADD CONSTRAINT "fee_schedule_training_system_id_fkey" FOREIGN KEY ("training_system_id") REFERENCES "training_system"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written invariants where the new scope differs from the initial migration.
-- Constraints whose columns survived (MSSV unique, fee money, seat counter, term
-- milestones, enrollment money) are unchanged and still in force.
-- ─────────────────────────────────────────────────────────────────────────────

-- DT-01/CONTEXT.md: a standalone PRACTICE course (e.g. CE119) has no companion. The old
-- rule that every PRACTICE course must have one no longer holds.
ALTER TABLE "course" DROP CONSTRAINT "course_companion_check";
ALTER TABLE "course"
  ADD CONSTRAINT "course_companion_check" CHECK (
    "type" <> 'THEORY' OR "companion_theory_course_id" IS NULL
  );

-- DK-09: keep the seat counter between zero and capacity (restated here so the new
-- migration stands on its own next to the other DB-level constraints).
ALTER TABLE "course_section" DROP CONSTRAINT "course_section_enrolled_count_check";
ALTER TABLE "course_section"
  ADD CONSTRAINT "course_section_enrolled_count_check"
  CHECK ("enrolled_count" >= 0 AND "enrolled_count" <= "capacity");

-- KQ-02/KQ-03: scores are tenths on the 0–10 scale, NULL means no result yet.
ALTER TABLE "taken_course"
  ADD CONSTRAINT "taken_course_course_score_check" CHECK ("course_score" BETWEEN 0 AND 10);

-- HP-06: only discount rows carry a frozen discount rate.
ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_discount_rate_check" CHECK (
    ("type" IN ('DISCOUNT', 'DISCOUNT_REVERSAL')) = ("discount_rate" IS NOT NULL) AND
    ("discount_rate" IS NULL OR "discount_rate" BETWEEN 1 AND 100)
  );

ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_payment_source_check" CHECK ("type" <> 'PAYMENT' OR "receipt_id" IS NOT NULL);

-- HP-13/ADR-0004: nine ledger types, no ADJUSTMENT and no REFUND; a reversal carries
-- the opposite direction of the entry it corrects.
ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_direction_check" CHECK (
    CASE "type"
      WHEN 'BASE_TUITION'          THEN "direction" = 'DEBIT'
      WHEN 'BASE_TUITION_REVERSAL' THEN "direction" = 'CREDIT'
      WHEN 'SURCHARGE'             THEN "direction" = 'DEBIT'
      WHEN 'SURCHARGE_REVERSAL'    THEN "direction" = 'CREDIT'
      WHEN 'DISCOUNT'              THEN "direction" = 'CREDIT'
      WHEN 'DISCOUNT_REVERSAL'     THEN "direction" = 'DEBIT'
      WHEN 'PAYMENT'               THEN "direction" = 'CREDIT'
      WHEN 'BALANCE_CARRY_OUT'     THEN "direction" = 'DEBIT'
      WHEN 'BALANCE_CARRY_IN'      THEN "direction" = 'CREDIT'
    END
  );
