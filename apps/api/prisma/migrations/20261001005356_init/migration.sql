-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'LECTURER', 'ACADEMIC_OFFICE', 'FINANCE_OFFICE', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'WITHDRAWN', 'GRADUATED');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('THEORY', 'PRACTICE');

-- CreateEnum
CREATE TYPE "PrerequisiteType" AS ENUM ('REQUIRED_PASS', 'REQUIRED_ATTEMPT');

-- CreateEnum
CREATE TYPE "KnowledgeBlockType" AS ENUM ('REQUIRED', 'ELECTIVE');

-- CreateEnum
CREATE TYPE "TermType" AS ENUM ('FIRST', 'SECOND', 'SUMMER');

-- CreateEnum
CREATE TYPE "TermPhase" AS ENUM ('PREPARATION', 'REGISTRATION', 'ADJUSTMENT', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "AttemptType" AS ENUM ('FIRST', 'RETAKE', 'IMPROVEMENT', 'FREE_ELECTIVE');

-- CreateEnum
CREATE TYPE "GradebookStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('BASE_TUITION', 'SURCHARGE', 'SURCHARGE_REVERSAL', 'DISCOUNT', 'DISCOUNT_REVERSAL', 'PAYMENT', 'ADJUSTMENT', 'REFUND', 'BALANCE_CARRY_OUT', 'BALANCE_CARRY_IN');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('COUNTER', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'IGNORED');

-- CreateTable
CREATE TABLE "user_account" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "roles" "Role"[],
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "province" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "district" (
    "id" SERIAL NOT NULL,
    "province_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "district_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major" (
    "id" SERIAL NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "admission_year" INTEGER NOT NULL,

    CONSTRAINT "cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "priority_group" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount_rate" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "priority_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" SERIAL NOT NULL,
    "student_code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "hometown_district_id" INTEGER NOT NULL,
    "major_id" INTEGER NOT NULL,
    "cohort_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_priority_group" (
    "student_id" INTEGER NOT NULL,
    "priority_group_id" INTEGER NOT NULL,

    CONSTRAINT "student_priority_group_pkey" PRIMARY KEY ("student_id","priority_group_id")
);

-- CreateTable
CREATE TABLE "student_status_decision" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" "StudentStatus" NOT NULL,
    "effective_term_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "decided_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_status_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_decision" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "decided_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturer" (
    "id" SERIAL NOT NULL,
    "lecturer_code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "faculty_id" INTEGER NOT NULL,

    CONSTRAINT "lecturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CourseType" NOT NULL,
    "total_periods" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "faculty_id" INTEGER,
    "companion_theory_course_id" INTEGER,
    "equivalence_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_equivalence" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "course_equivalence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prerequisite" (
    "course_id" INTEGER NOT NULL,
    "prerequisite_course_id" INTEGER NOT NULL,
    "type" "PrerequisiteType" NOT NULL,

    CONSTRAINT "prerequisite_pkey" PRIMARY KEY ("course_id","prerequisite_course_id")
);

-- CreateTable
CREATE TABLE "curriculum" (
    "id" SERIAL NOT NULL,
    "major_id" INTEGER NOT NULL,
    "cohort_id" INTEGER NOT NULL,
    "min_total_credits" INTEGER NOT NULL,

    CONSTRAINT "curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_block" (
    "id" SERIAL NOT NULL,
    "curriculum_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "KnowledgeBlockType" NOT NULL,
    "min_credits" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "knowledge_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_course" (
    "knowledge_block_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "suggested_term" INTEGER NOT NULL,

    CONSTRAINT "curriculum_course_pkey" PRIMARY KEY ("knowledge_block_id","course_id")
);

-- CreateTable
CREATE TABLE "academic_year" (
    "id" SERIAL NOT NULL,
    "start_year" INTEGER NOT NULL,

    CONSTRAINT "academic_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term" (
    "id" SERIAL NOT NULL,
    "academic_year_id" INTEGER NOT NULL,
    "type" "TermType" NOT NULL,
    "term_code" TEXT NOT NULL,
    "phase" "TermPhase" NOT NULL DEFAULT 'PREPARATION',
    "start_date" DATE NOT NULL,
    "registration_start_at" TIMESTAMPTZ(3) NOT NULL,
    "registration_end_at" TIMESTAMPTZ(3) NOT NULL,
    "adjustment_start_at" TIMESTAMPTZ(3) NOT NULL,
    "adjustment_end_at" TIMESTAMPTZ(3) NOT NULL,
    "tuition_deadline" TIMESTAMPTZ(3) NOT NULL,
    "final_exam_start_at" TIMESTAMPTZ(3) NOT NULL,
    "min_credits" INTEGER NOT NULL,
    "max_credits" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_slot" (
    "id" SERIAL NOT NULL,
    "term_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_slot_cohort" (
    "registration_slot_id" INTEGER NOT NULL,
    "cohort_id" INTEGER NOT NULL,

    CONSTRAINT "registration_slot_cohort_pkey" PRIMARY KEY ("registration_slot_id","cohort_id")
);

-- CreateTable
CREATE TABLE "offered_course" (
    "id" SERIAL NOT NULL,
    "term_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,

    CONSTRAINT "offered_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_section" (
    "id" SERIAL NOT NULL,
    "offered_course_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "lecturer_id" INTEGER,
    "capacity" INTEGER NOT NULL,
    "enrolled_count" INTEGER NOT NULL DEFAULT 0,
    "parent_section_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_slot" INTEGER NOT NULL,
    "end_slot" INTEGER NOT NULL,
    "room" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL,

    CONSTRAINT "meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_form" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "finalized_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "id" SERIAL NOT NULL,
    "form_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'REGISTERED',
    "attempt_type" "AttemptType" NOT NULL,
    "pending_prerequisite" BOOLEAN NOT NULL DEFAULT false,
    "credits" INTEGER NOT NULL,
    "credit_rate" BIGINT NOT NULL,
    "surcharge" BIGINT NOT NULL DEFAULT 0,
    "course_score" DECIMAL(3,1),
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),
    "finalized_at" TIMESTAMPTZ(3),

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gradebook" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "status" "GradebookStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(3),
    "submitted_by_id" INTEGER,
    "locked_at" TIMESTAMPTZ(3),
    "locked_by_id" INTEGER,

    CONSTRAINT "gradebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_component" (
    "id" SERIAL NOT NULL,
    "gradebook_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grade_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_score" (
    "enrollment_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "score" DECIMAL(3,1) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "component_score_pkey" PRIMARY KEY ("enrollment_id","component_id")
);

-- CreateTable
CREATE TABLE "grade_amendment" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "old_score" DECIMAL(3,1) NOT NULL,
    "new_score" DECIMAL(3,1) NOT NULL,
    "reason" TEXT NOT NULL,
    "amended_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_amendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_ban" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "outstanding_amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_at" TIMESTAMPTZ(3),
    "lifted_by_id" INTEGER,
    "lift_reason" TEXT,

    CONSTRAINT "exam_ban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedule" (
    "id" SERIAL NOT NULL,
    "cohort_id" INTEGER NOT NULL,
    "base_tuition" BIGINT NOT NULL,
    "theory_credit_rate" BIGINT NOT NULL DEFAULT 27000,
    "practice_credit_rate" BIGINT NOT NULL DEFAULT 37000,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fee_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "discount_rate" INTEGER,
    "description" TEXT,
    "enrollment_id" INTEGER,
    "receipt_id" INTEGER,
    "adjustment_id" INTEGER,
    "related_entry_id" INTEGER,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt" (
    "id" SERIAL NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "student_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "amount" BIGINT NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "bank_transaction_id" INTEGER,
    "collected_by_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaction" (
    "id" SERIAL NOT NULL,
    "sepay_id" BIGINT NOT NULL,
    "gateway" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "transaction_date" TIMESTAMPTZ(3) NOT NULL,
    "code" TEXT,
    "content" TEXT NOT NULL,
    "reference_code" TEXT,
    "amount" BIGINT NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "matched_student_id" INTEGER,
    "matched_term_id" INTEGER,
    "assigned_by_id" INTEGER,
    "raw_payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB,
    "request_id" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameter" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_id" INTEGER,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_parameter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_username_key" ON "user_account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "user_account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "province_code_key" ON "province"("code");

-- CreateIndex
CREATE UNIQUE INDEX "district_code_key" ON "district"("code");

-- CreateIndex
CREATE INDEX "district_province_id_idx" ON "district"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_code_key" ON "faculty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "major_code_key" ON "major"("code");

-- CreateIndex
CREATE INDEX "major_faculty_id_idx" ON "major"("faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_code_key" ON "cohort"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_admission_year_key" ON "cohort"("admission_year");

-- CreateIndex
CREATE UNIQUE INDEX "priority_group_code_key" ON "priority_group"("code");

-- CreateIndex
CREATE UNIQUE INDEX "student_student_code_key" ON "student"("student_code");

-- CreateIndex
CREATE UNIQUE INDEX "student_user_id_key" ON "student"("user_id");

-- CreateIndex
CREATE INDEX "student_cohort_id_major_id_idx" ON "student"("cohort_id", "major_id");

-- CreateIndex
CREATE INDEX "student_status_decision_student_id_created_at_idx" ON "student_status_decision"("student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leave_decision_student_id_term_id_key" ON "leave_decision"("student_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturer_lecturer_code_key" ON "lecturer"("lecturer_code");

-- CreateIndex
CREATE UNIQUE INDEX "lecturer_user_id_key" ON "lecturer"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_code_key" ON "course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "course_companion_theory_course_id_key" ON "course"("companion_theory_course_id");

-- CreateIndex
CREATE INDEX "course_equivalence_id_idx" ON "course"("equivalence_id");

-- CreateIndex
CREATE INDEX "prerequisite_prerequisite_course_id_idx" ON "prerequisite"("prerequisite_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_major_id_cohort_id_key" ON "curriculum"("major_id", "cohort_id");

-- CreateIndex
CREATE INDEX "knowledge_block_curriculum_id_idx" ON "knowledge_block"("curriculum_id");

-- CreateIndex
CREATE INDEX "curriculum_course_course_id_idx" ON "curriculum_course"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_year_start_year_key" ON "academic_year"("start_year");

-- CreateIndex
CREATE UNIQUE INDEX "term_term_code_key" ON "term"("term_code");

-- CreateIndex
CREATE UNIQUE INDEX "term_academic_year_id_type_key" ON "term"("academic_year_id", "type");

-- CreateIndex
CREATE INDEX "registration_slot_term_id_idx" ON "registration_slot"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "offered_course_term_id_course_id_key" ON "offered_course"("term_id", "course_id");

-- CreateIndex
CREATE INDEX "course_section_parent_section_id_idx" ON "course_section"("parent_section_id");

-- CreateIndex
CREATE INDEX "course_section_lecturer_id_idx" ON "course_section"("lecturer_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_section_offered_course_id_code_key" ON "course_section"("offered_course_id", "code");

-- CreateIndex
CREATE INDEX "meeting_section_id_idx" ON "meeting"("section_id");

-- CreateIndex
CREATE INDEX "registration_form_term_id_idx" ON "registration_form"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_form_student_id_term_id_key" ON "registration_form"("student_id", "term_id");

-- CreateIndex
CREATE INDEX "enrollment_form_id_idx" ON "enrollment"("form_id");

-- CreateIndex
CREATE INDEX "enrollment_section_id_idx" ON "enrollment"("section_id");

-- CreateIndex
CREATE INDEX "enrollment_course_id_idx" ON "enrollment"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_active_course_key" ON "enrollment"("form_id", "course_id") WHERE (status <> 'CANCELLED');

-- CreateIndex
CREATE UNIQUE INDEX "gradebook_section_id_key" ON "gradebook"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_component_gradebook_id_name_key" ON "grade_component"("gradebook_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "grade_component_one_final_key" ON "grade_component"("gradebook_id") WHERE (is_final);

-- CreateIndex
CREATE INDEX "component_score_component_id_idx" ON "component_score"("component_id");

-- CreateIndex
CREATE INDEX "grade_amendment_enrollment_id_idx" ON "grade_amendment"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_ban_student_id_term_id_key" ON "exam_ban"("student_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedule_cohort_id_key" ON "fee_schedule"("cohort_id");

-- CreateIndex
CREATE INDEX "ledger_entry_student_id_term_id_idx" ON "ledger_entry"("student_id", "term_id");

-- CreateIndex
CREATE INDEX "ledger_entry_term_id_idx" ON "ledger_entry"("term_id");

-- CreateIndex
CREATE INDEX "ledger_entry_enrollment_id_idx" ON "ledger_entry"("enrollment_id");

-- CreateIndex
CREATE INDEX "ledger_entry_related_entry_id_idx" ON "ledger_entry"("related_entry_id");

-- CreateIndex
CREATE INDEX "adjustment_student_id_term_id_idx" ON "adjustment"("student_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_receipt_number_key" ON "receipt"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_bank_transaction_id_key" ON "receipt"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "receipt_student_id_term_id_idx" ON "receipt"("student_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaction_sepay_id_key" ON "bank_transaction"("sepay_id");

-- CreateIndex
CREATE INDEX "bank_transaction_status_idx" ON "bank_transaction"("status");

-- CreateIndex
CREATE INDEX "bank_transaction_code_idx" ON "bank_transaction"("code");

-- CreateIndex
CREATE INDEX "outbox_unpublished_idx" ON "outbox"("created_at") WHERE (published_at IS NULL);

-- CreateIndex
CREATE INDEX "notification_user_id_created_at_idx" ON "notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "district" ADD CONSTRAINT "district_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major" ADD CONSTRAINT "major_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_hometown_district_id_fkey" FOREIGN KEY ("hometown_district_id") REFERENCES "district"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_priority_group" ADD CONSTRAINT "student_priority_group_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_priority_group" ADD CONSTRAINT "student_priority_group_priority_group_id_fkey" FOREIGN KEY ("priority_group_id") REFERENCES "priority_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_status_decision" ADD CONSTRAINT "student_status_decision_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_status_decision" ADD CONSTRAINT "student_status_decision_effective_term_id_fkey" FOREIGN KEY ("effective_term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_status_decision" ADD CONSTRAINT "student_status_decision_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_decision" ADD CONSTRAINT "leave_decision_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_decision" ADD CONSTRAINT "leave_decision_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_decision" ADD CONSTRAINT "leave_decision_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer" ADD CONSTRAINT "lecturer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer" ADD CONSTRAINT "lecturer_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_companion_theory_course_id_fkey" FOREIGN KEY ("companion_theory_course_id") REFERENCES "course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_equivalence_id_fkey" FOREIGN KEY ("equivalence_id") REFERENCES "course_equivalence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite" ADD CONSTRAINT "prerequisite_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequisite" ADD CONSTRAINT "prerequisite_prerequisite_course_id_fkey" FOREIGN KEY ("prerequisite_course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_block" ADD CONSTRAINT "knowledge_block_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_course" ADD CONSTRAINT "curriculum_course_knowledge_block_id_fkey" FOREIGN KEY ("knowledge_block_id") REFERENCES "knowledge_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_course" ADD CONSTRAINT "curriculum_course_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term" ADD CONSTRAINT "term_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_slot" ADD CONSTRAINT "registration_slot_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_slot_cohort" ADD CONSTRAINT "registration_slot_cohort_registration_slot_id_fkey" FOREIGN KEY ("registration_slot_id") REFERENCES "registration_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_slot_cohort" ADD CONSTRAINT "registration_slot_cohort_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offered_course" ADD CONSTRAINT "offered_course_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offered_course" ADD CONSTRAINT "offered_course_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_section" ADD CONSTRAINT "course_section_offered_course_id_fkey" FOREIGN KEY ("offered_course_id") REFERENCES "offered_course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_section" ADD CONSTRAINT "course_section_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "lecturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_section" ADD CONSTRAINT "course_section_parent_section_id_fkey" FOREIGN KEY ("parent_section_id") REFERENCES "course_section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_form" ADD CONSTRAINT "registration_form_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_form" ADD CONSTRAINT "registration_form_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "registration_form"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gradebook" ADD CONSTRAINT "gradebook_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gradebook" ADD CONSTRAINT "gradebook_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gradebook" ADD CONSTRAINT "gradebook_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_component" ADD CONSTRAINT "grade_component_gradebook_id_fkey" FOREIGN KEY ("gradebook_id") REFERENCES "gradebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_score" ADD CONSTRAINT "component_score_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_score" ADD CONSTRAINT "component_score_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "grade_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_amendment" ADD CONSTRAINT "grade_amendment_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_amendment" ADD CONSTRAINT "grade_amendment_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "grade_component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_amendment" ADD CONSTRAINT "grade_amendment_amended_by_id_fkey" FOREIGN KEY ("amended_by_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_ban" ADD CONSTRAINT "exam_ban_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_ban" ADD CONSTRAINT "exam_ban_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_ban" ADD CONSTRAINT "exam_ban_lifted_by_id_fkey" FOREIGN KEY ("lifted_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedule" ADD CONSTRAINT "fee_schedule_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "adjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_related_entry_id_fkey" FOREIGN KEY ("related_entry_id") REFERENCES "ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_matched_student_id_fkey" FOREIGN KEY ("matched_student_id") REFERENCES "student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_matched_term_id_fkey" FOREIGN KEY ("matched_term_id") REFERENCES "term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_parameter" ADD CONSTRAINT "system_parameter_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-written below: invariants Prisma's schema language cannot express.
-- They are the database-level safety net; the domain layer still checks first.
-- ─────────────────────────────────────────────────────────────────────────────

-- HS-02
ALTER TABLE "priority_group"
  ADD CONSTRAINT "priority_group_discount_rate_check" CHECK ("discount_rate" BETWEEN 0 AND 100);

-- DT-02: THEORY periods are multiples of 15, PRACTICE of 30, and credits follow from periods.
ALTER TABLE "course"
  ADD CONSTRAINT "course_periods_credits_check" CHECK (
    "total_periods" > 0 AND (
      ("type" = 'THEORY'   AND "total_periods" % 15 = 0 AND "credits" = "total_periods" / 15) OR
      ("type" = 'PRACTICE' AND "total_periods" % 30 = 0 AND "credits" = "total_periods" / 30)
    )
  ),
  ADD CONSTRAINT "course_companion_not_self_check" CHECK ("companion_theory_course_id" <> "id");

-- DT-05: no self-loops; longer cycles are rejected by the application.
ALTER TABLE "prerequisite"
  ADD CONSTRAINT "prerequisite_not_self_check" CHECK ("course_id" <> "prerequisite_course_id");

ALTER TABLE "curriculum"
  ADD CONSTRAINT "curriculum_min_total_credits_check" CHECK ("min_total_credits" > 0);

ALTER TABLE "knowledge_block"
  ADD CONSTRAINT "knowledge_block_min_credits_check" CHECK (
    ("type" = 'REQUIRED' AND "min_credits" IS NULL) OR
    ("type" = 'ELECTIVE' AND "min_credits" > 0)
  );

ALTER TABLE "curriculum_course"
  ADD CONSTRAINT "curriculum_course_suggested_term_check" CHECK ("suggested_term" >= 1);

-- HK-01, HK-02
ALTER TABLE "term"
  ADD CONSTRAINT "term_code_format_check" CHECK ("term_code" ~ '^[0-9]{4}[123]$'),
  ADD CONSTRAINT "term_milestones_order_check" CHECK (
    "registration_start_at" <  "registration_end_at" AND
    "registration_end_at"   <= "adjustment_start_at" AND
    "adjustment_start_at"   <  "adjustment_end_at"   AND
    "adjustment_end_at"     <  "tuition_deadline"    AND
    "tuition_deadline"      <  "final_exam_start_at"
  ),
  ADD CONSTRAINT "term_credit_limits_check" CHECK ("min_credits" >= 0 AND "min_credits" <= "max_credits");

-- HK-04: at most one term is in REGISTRATION or ADJUSTMENT at any time. Indexing a constant makes every
-- qualifying row collide with every other one.
CREATE UNIQUE INDEX "term_single_open_registration_key" ON "term" ((true))
  WHERE "phase" IN ('REGISTRATION', 'ADJUSTMENT');

ALTER TABLE "registration_slot"
  ADD CONSTRAINT "registration_slot_window_check" CHECK ("start_at" < "end_at");

-- DT-08, ADR-0005: the seat counter can never go negative or past capacity, whatever the code does.
ALTER TABLE "course_section"
  ADD CONSTRAINT "course_section_capacity_check" CHECK ("capacity" > 0),
  ADD CONSTRAINT "course_section_enrolled_count_check" CHECK ("enrolled_count" >= 0 AND "enrolled_count" <= "capacity"),
  ADD CONSTRAINT "course_section_parent_not_self_check" CHECK ("parent_section_id" <> "id");

-- DT-09: day 2 (Monday) … 8 (Sunday), slots 1–10, at least one week.
ALTER TABLE "meeting"
  ADD CONSTRAINT "meeting_day_of_week_check" CHECK ("day_of_week" BETWEEN 2 AND 8),
  ADD CONSTRAINT "meeting_slots_check" CHECK ("start_slot" BETWEEN 1 AND 10 AND "end_slot" BETWEEN "start_slot" AND 10),
  ADD CONSTRAINT "meeting_weeks_check" CHECK ("weeks" > 0);

ALTER TABLE "enrollment"
  ADD CONSTRAINT "enrollment_credits_check" CHECK ("credits" > 0),
  ADD CONSTRAINT "enrollment_money_check" CHECK ("credit_rate" >= 0 AND "surcharge" >= 0),
  ADD CONSTRAINT "enrollment_course_score_check" CHECK ("course_score" BETWEEN 0 AND 10),
  ADD CONSTRAINT "enrollment_status_timestamps_check" CHECK (
    ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL) AND
    ("status" = 'FINALIZED') = ("finalized_at" IS NOT NULL)
  );

-- KQ-01 (per component; the sum-to-100 rule spans rows and is checked when the gradebook is submitted).
ALTER TABLE "grade_component"
  ADD CONSTRAINT "grade_component_weight_check" CHECK ("weight" > 0 AND "weight" <= 100);

-- KQ-02
ALTER TABLE "component_score"
  ADD CONSTRAINT "component_score_range_check" CHECK ("score" BETWEEN 0 AND 10);

ALTER TABLE "grade_amendment"
  ADD CONSTRAINT "grade_amendment_range_check" CHECK ("old_score" BETWEEN 0 AND 10 AND "new_score" BETWEEN 0 AND 10),
  ADD CONSTRAINT "grade_amendment_reason_check" CHECK (length(trim("reason")) > 0);

-- CT-04: a lifted ban always records who lifted it and why.
ALTER TABLE "exam_ban"
  ADD CONSTRAINT "exam_ban_outstanding_check" CHECK ("outstanding_amount" > 0),
  ADD CONSTRAINT "exam_ban_lift_check" CHECK (
    ("lifted_at" IS NULL AND "lifted_by_id" IS NULL AND "lift_reason" IS NULL) OR
    ("lifted_at" IS NOT NULL AND "lifted_by_id" IS NOT NULL AND length(trim("lift_reason")) > 0)
  );

-- HP-01, HP-08: money is whole VND.
ALTER TABLE "fee_schedule"
  ADD CONSTRAINT "fee_schedule_money_check" CHECK (
    "base_tuition" >= 0 AND "theory_credit_rate" >= 0 AND "practice_credit_rate" >= 0
  );

-- ADR-0004: amounts are positive, the direction carries the sign; most types fix the direction.
ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "ledger_entry_direction_check" CHECK (
    CASE "type"
      WHEN 'BASE_TUITION'       THEN "direction" = 'DEBIT'
      WHEN 'SURCHARGE'          THEN "direction" = 'DEBIT'
      WHEN 'DISCOUNT_REVERSAL'  THEN "direction" = 'DEBIT'
      WHEN 'REFUND'             THEN "direction" = 'DEBIT'
      WHEN 'BALANCE_CARRY_OUT'  THEN "direction" = 'DEBIT'
      WHEN 'SURCHARGE_REVERSAL' THEN "direction" = 'CREDIT'
      WHEN 'DISCOUNT'           THEN "direction" = 'CREDIT'
      WHEN 'PAYMENT'            THEN "direction" = 'CREDIT'
      WHEN 'BALANCE_CARRY_IN'   THEN "direction" = 'CREDIT'
      ELSE TRUE -- ADJUSTMENT goes either way
    END
  ),
  ADD CONSTRAINT "ledger_entry_discount_rate_check" CHECK (
    ("type" IN ('DISCOUNT', 'DISCOUNT_REVERSAL')) = ("discount_rate" IS NOT NULL) AND
    ("discount_rate" IS NULL OR "discount_rate" BETWEEN 1 AND 100)
  ),
  ADD CONSTRAINT "ledger_entry_payment_source_check" CHECK ("type" <> 'PAYMENT' OR "receipt_id" IS NOT NULL),
  ADD CONSTRAINT "ledger_entry_adjustment_source_check" CHECK ("type" <> 'ADJUSTMENT' OR "adjustment_id" IS NOT NULL);

ALTER TABLE "adjustment"
  ADD CONSTRAINT "adjustment_reason_check" CHECK (length(trim("reason")) > 0);

ALTER TABLE "receipt"
  ADD CONSTRAINT "receipt_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "receipt_channel_source_check" CHECK (("channel" = 'BANK_TRANSFER') = ("bank_transaction_id" IS NOT NULL));

ALTER TABLE "bank_transaction"
  ADD CONSTRAINT "bank_transaction_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "bank_transaction_match_check" CHECK (
    ("status" = 'MATCHED') = ("matched_student_id" IS NOT NULL AND "matched_term_id" IS NOT NULL)
  );

-- NFR-10, ADR-0004: the ledger, the audit log and grade amendments are append-only, even for code that
-- bypasses the API. TRUNCATE (used by the dev seed) is a statement-level operation and is not affected.
CREATE FUNCTION "reject_append_only_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "ledger_entry_append_only" BEFORE UPDATE OR DELETE ON "ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
CREATE TRIGGER "audit_log_append_only" BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
CREATE TRIGGER "grade_amendment_append_only" BEFORE UPDATE OR DELETE ON "grade_amendment"
  FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
