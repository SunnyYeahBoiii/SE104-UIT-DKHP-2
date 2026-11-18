import { StudentDetail } from '@/components/students/student-detail'

export default async function StudentDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <StudentDetail code={code} />
}
