-- DK-06: keep the reason a line was auto-cancelled by the daily prerequisite job.
-- Shown in the form history ("Đã huỷ"); NULL for student-initiated cancellations.
ALTER TABLE "enrollment" ADD COLUMN "cancellation_reason" TEXT;
