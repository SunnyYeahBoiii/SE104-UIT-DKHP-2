import { type CanActivate, type ExecutionContext, HttpException, Injectable } from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'

import type { AuthRequest } from './auth.guard'
import { parseCookies } from './auth.guard'

export const CSRF_COOKIE = 'dkhp_csrf'
export const CSRF_HEADER = 'x-csrf-token'

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true

    const cookieToken = parseCookies(req.headers.cookie)[CSRF_COOKIE]
    const headerValue = req.headers[CSRF_HEADER]
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue
    if (!cookieToken || !headerToken || !equal(cookieToken, headerToken))
      throw new HttpException(
        {
          code: 'CSRF_REQUIRED',
          message: 'Thiếu hoặc sai mã CSRF. Vui lòng tải lại trang.',
        },
        403,
      )
    return true
  }
}

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
