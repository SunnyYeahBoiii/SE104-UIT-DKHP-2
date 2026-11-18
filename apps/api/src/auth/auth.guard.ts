import 'reflect-metadata'

import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import { Reflector } from '@nestjs/core'

import type { Role } from '../generated/prisma/enums'
import type { AuthUser } from './auth.types'
import { SESSION_COOKIE, SessionStore, type Session } from './session.store'

const ROLES_KEY = 'auth:roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export type AuthRequest = {
  path: string
  method: string
  headers: IncomingHttpHeaders
  requestId?: string
  auth?: { session: Session; user: AuthUser }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index < 1) continue
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return cookies
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/health', '/auth/login'])

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionStore,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>()
    req.requestId ??= randomUUID()
    const path = req.path ?? ''
    if (PUBLIC_PATHS.has(path)) return true

    const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    const session = sessionId ? await this.sessions.get(sessionId) : null
    if (!session) {
      throw new HttpException(
        {
          code: 'SESSION_EXPIRED',
          message: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
        },
        401,
      )
    }
    req.auth = { session, user: this.userFrom(session) }

    // /auth/me must stay readable so the web proxy can route a first-login session to the change form.
    if (
      session.mustChangePassword &&
      !path.endsWith('/auth/change-password') &&
      !path.endsWith('/auth/me')
    ) {
      throw new HttpException(
        {
          code: 'MUST_CHANGE_PASSWORD',
          message: 'Bạn cần đổi mật khẩu trước khi tiếp tục.',
        },
        403,
      )
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin
      if (origin) {
        // Behind nginx/Next rewrites the Host is the upstream host; x-forwarded-host is the public one.
        const forwardedHost = req.headers['x-forwarded-host']
        const publicHost =
          (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host
        const originHost = new URL(origin).host
        if (originHost !== publicHost) {
          throw new HttpException(
            { code: 'BAD_ORIGIN', message: 'Nguồn yêu cầu không hợp lệ.' },
            403,
          )
        }
      }
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (required?.length) {
      const holdsRequiredRole = session.roles.some((role) => required.includes(role))
      if (!session.activeRole || !required.includes(session.activeRole)) {
        throw new HttpException(
          {
            code: holdsRequiredRole ? 'ROLE_SWITCH_REQUIRED' : 'FORBIDDEN',
            message: holdsRequiredRole
              ? 'Bạn đang dùng vai trò khác. Chọn vai trò phù hợp để tiếp tục.'
              : 'Bạn không có quyền thực hiện thao tác này.',
            switchableRoles: holdsRequiredRole ? required : undefined,
          },
          403,
        )
      }
    }
    return true
  }

  private userFrom(session: Session): AuthUser {
    return {
      id: session.userId,
      username: session.username,
      fullName: session.fullName,
      roles: session.roles,
      activeRole: session.activeRole,
      mustChangePassword: session.mustChangePassword,
      expiresAt: session.expiresAt,
      expiresIn: Math.max(0, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000)),
    }
  }
}
