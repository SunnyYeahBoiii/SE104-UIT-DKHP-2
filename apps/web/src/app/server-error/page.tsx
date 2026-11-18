import { Suspense } from 'react'

import { ServerError } from './client'

export default function ServerErrorPage() {
  return (
    <Suspense>
      <ServerError />
    </Suspense>
  )
}
