import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common'

import type { Role } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { INVALID_CREDENTIALS, type AuthUser, type LoginResult } from './auth.types'
import { LoginRateLimiter } from './login-rate-limiter'
import { PasswordHasher, passwordProblems } from './password.hasher'
import { SessionStore, type Session } from './session.store'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionStore,
    private readonly limiter: LoginRateLimiter,
  ) {}

  private toUser(session: Session): AuthUser {
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

  async login(username: string, password: string, ip: string): Promise<LoginResult> {
    const retryAfter = await this.limiter.retryAfter(username, ip)
    if (retryAfter > 0) {
      const minutes = Math.ceil(retryAfter / 60)
      throw new HttpException(
        {
          code: 'LOGIN_LOCKED',
          message: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${minutes} phút.`,
          retryAfter,
        },
        429,
      )
    }

    const user = await this.prisma.user.findUnique({ where: { username } })
    const valid = user?.isActive ? await this.hasher.verify(password, user.passwordHash) : false
    if (!user || !valid) {
      await this.limiter.recordFailure(username, ip)
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: INVALID_CREDENTIALS })
    }

    await this.limiter.clear(username, ip)
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const session = await this.sessions.create({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      roles: user.roles,
      activeRole: user.roles.length > 1 ? null : (user.roles[0] ?? null),
      mustChangePassword: user.mustChangePassword,
    })

    if (user.mustChangePassword)
      return { status: 'MUST_CHANGE_PASSWORD', user: this.toUser(session), session }
    if (!session.activeRole)
      return { status: 'ROLE_SELECTION', user: this.toUser(session), session }
    return { status: 'OK', user: this.toUser(session), session }
  }

  me(session: Session): AuthUser {
    return this.toUser(session)
  }

  async changePassword(session: Session, current: string, next: string): Promise<AuthUser> {
    const problems = passwordProblems(next)
    if (problems.length > 0)
      throw new HttpException(
        { code: 'WEAK_PASSWORD', message: 'Mật khẩu chưa đạt yêu cầu.', problems },
        400,
      )

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } })
    if (!user || !(await this.hasher.verify(current, user.passwordHash))) {
      throw new HttpException(
        { code: 'INVALID_CURRENT_PASSWORD', message: 'Mật khẩu hiện tại không đúng.' },
        400,
      )
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.hasher.hash(next), mustChangePassword: false },
    })
    await this.sessions.deleteAllExcept(user.id, session.id)
    const updated = await this.sessions.update(session.id, { mustChangePassword: false })
    return this.toUser(updated ?? session)
  }

  async switchRole(session: Session, role: Role): Promise<AuthUser> {
    if (!session.roles.includes(role)) {
      throw new HttpException(
        { code: 'ROLE_NOT_HELD', message: 'Tài khoản không có vai trò này.' },
        403,
      )
    }
    const updated = await this.sessions.update(session.id, { activeRole: role })
    return this.toUser(updated ?? session)
  }

  async logout(session: Session): Promise<void> {
    await this.sessions.delete(session.id)
  }
}
