import { Suspense } from 'react'

import { StudentSchedule } from '@/components/student/student-schedule'

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <StudentSchedule />
    </Suspense>
  )
}
