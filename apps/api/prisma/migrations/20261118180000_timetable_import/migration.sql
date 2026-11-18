-- TKB-03 / ADR-0019: rooms are seed-only reference data used to validate the timetable file.
CREATE TABLE "room" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_code_key" ON "room"("code");

-- ADR-0017 / TKB-05: credits belong to the offering in a term and may be zero.
ALTER TABLE "offered_course" ADD COLUMN "credits" INTEGER NOT NULL DEFAULT 0;

-- TKB-07: cohort reserved for a section is display/filter only, stored as an admission year.
ALTER TABLE "course_section"
  ADD COLUMN "reserved_admission_year" INTEGER,
  ADD COLUMN "note" TEXT;

ALTER TABLE "course_section"
  ADD CONSTRAINT "course_section_reserved_admission_year_check" CHECK ("reserved_admission_year" IS NULL OR "reserved_admission_year" > 0);

-- ADR-0002 / QĐ11.7: practice groups are coded <parent>.n with n >= 1, not capped at two.
ALTER TABLE "course_section" DROP CONSTRAINT "course_section_practice_code_check";
ALTER TABLE "course_section"
  ADD CONSTRAINT "course_section_practice_code_check" CHECK ("parent_section_id" IS NULL OR "code" ~ '\.[1-9][0-9]*$');
