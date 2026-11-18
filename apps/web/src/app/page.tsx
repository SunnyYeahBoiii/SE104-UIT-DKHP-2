import { redirect } from 'next/navigation'

/** The middleware sends each role to its own home; this is only a safety net. */
export default function Home() {
  redirect('/student')
}
