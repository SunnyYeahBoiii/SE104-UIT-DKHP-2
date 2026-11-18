import { Suspense } from 'react'

import { StudentList } from '@/components/students/student-list'

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  return (
    <Suspense>
      <StudentList initialQuery={q} />
    </Suspense>
  )
}
