export type Role = 'STUDENT' | 'ACADEMIC_OFFICE' | 'FINANCE_OFFICE'

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

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Sinh viên',
  ACADEMIC_OFFICE: 'Phòng Đào tạo',
  FINANCE_OFFICE: 'Phòng Tài vụ',
}

export function homeFor(role: Role | null): string {
  if (role === 'STUDENT') return '/student'
  if (role === 'ACADEMIC_OFFICE' || role === 'FINANCE_OFFICE') return '/staff'
  return '/select-role'
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export function csrfToken(): string {
  if (typeof document === 'undefined') return ''
  const entry = document.cookie.split('; ').find((part) => part.startsWith('dkhp_csrf='))
  return entry ? decodeURIComponent(entry.slice('dkhp_csrf='.length)) : ''
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (!['GET', 'HEAD'].includes(method)) {
    const token = csrfToken()
    if (token) headers['x-csrf-token'] = token
  }
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new ApiError(
      response.status,
      String(body.code ?? 'UNKNOWN'),
      String(body.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'),
      body,
    )
  }
  return body as T
}

export function withReturnTo(path: string, returnTo: string): string {
  return `${path}?returnTo=${encodeURIComponent(returnTo)}`
}
