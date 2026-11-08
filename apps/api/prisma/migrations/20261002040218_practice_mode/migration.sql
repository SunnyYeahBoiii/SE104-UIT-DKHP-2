-- CreateEnum
CREATE TYPE "PracticeMode" AS ENUM ('SCHEDULED', 'SELF_SCHEDULED');

-- AlterTable
ALTER TABLE "course_section" ADD COLUMN     "practice_mode" "PracticeMode";

-- DT-01: every PRACTICE course has exactly one companion THEORY course; a THEORY course has none. That the
-- companion is itself THEORY spans two rows and is checked by the application.
ALTER TABLE "course"
  ADD CONSTRAINT "course_companion_check" CHECK (("type" = 'PRACTICE') = ("companion_theory_course_id" IS NOT NULL));

-- DT-08, DT-11: practice sections are coded `.1` or `.2`, and only the parent THEORY section carries the
-- practice mode. Group count, HT2 capacity and HT2 having no meetings span rows and are checked by the
-- application.
ALTER TABLE "course_section"
  ADD CONSTRAINT "course_section_practice_code_check" CHECK ("parent_section_id" IS NULL OR "code" ~ '\.[12]$'),
  ADD CONSTRAINT "course_section_practice_mode_check" CHECK ("parent_section_id" IS NULL OR "practice_mode" IS NULL);
