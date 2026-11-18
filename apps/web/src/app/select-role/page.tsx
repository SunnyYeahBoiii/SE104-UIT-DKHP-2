import { Suspense } from 'react'

import { RoleSelectForm } from '@/components/role-select-form'

export default function SelectRolePage() {
  return (
    <Suspense>
      <RoleSelectForm />
    </Suspense>
  )
}
