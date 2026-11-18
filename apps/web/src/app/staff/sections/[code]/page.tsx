import { ClassRoster } from '@/components/monitoring/class-roster'

export default async function SectionRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ term?: string }>
}) {
  const [{ code }, { term }] = await Promise.all([params, searchParams])
  return <ClassRoster termCode={term ?? ''} sectionCode={code} />
}
