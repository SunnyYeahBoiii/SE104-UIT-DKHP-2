import type { Role } from '../generated/prisma/enums'
import type { Session } from './session.store'

export type AuthUser = {
  id: number
  username: string
  fullName: string
  roles: Role[]
  activeRole: Role | null
  mustChangePassword: boolean
  expiresAt: string
  expiresIn: number
}

export type LoginResult =
  | { status: 'OK'; user: AuthUser; session: Session }
  | { status: 'MUST_CHANGE_PASSWORD'; user: AuthUser; session: Session }
  | { status: 'ROLE_SELECTION'; user: AuthUser; session: Session }

/** A.6: one sentence for every bad credential, never revealing which field was wrong. */
export const INVALID_CREDENTIALS = 'Thông tin đăng nhập không đúng. Vui lòng thử lại.'
