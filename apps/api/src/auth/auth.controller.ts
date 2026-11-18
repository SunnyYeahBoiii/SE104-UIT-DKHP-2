import { Body, Controller, Get, HttpCode, HttpException, Post, Req, Res } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

import { Role } from '../generated/prisma/enums'
import { CSRF_COOKIE } from './csrf.guard'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './session.store'
import { AuthService } from './auth.service'
import type { AuthRequest } from './auth.guard'

type CookieResponse = { setHeader(name: string, value: string | string[]): void }

function stringField(body: unknown, name: string): string {
  const value = (body as Record<string, unknown> | null)?.[name]
  if (typeof value !== 'string' || value.length === 0)
    throw new HttpException({ code: 'INVALID_REQUEST', message: `${name} là bắt buộc.` }, 400)
  return value
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setCookie(res: CookieResponse, id: string, maxAge: number, csrf = false): void {
    const cookies = [
      `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
    ]
    if (csrf) {
      const token = id ? randomBytes(32).toString('base64url') : ''
      cookies.push(`${CSRF_COOKIE}=${token}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`)
    }
    res.setHeader('Set-Cookie', cookies)
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ) {
    const username = stringField(body, 'username').trim()
    const password = stringField(body, 'password')
    const forwarded = req.headers['x-forwarded-for']
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
      req.headers['x-real-ip']?.toString() ||
      'unknown'
    const result = await this.auth.login(username, password, ip)
    this.setCookie(res, result.session.id, SESSION_TTL_SECONDS, true)
    return { status: result.status, user: result.user }
  }

  @Get('me')
  me(@Req() req: AuthRequest) {
    return { user: this.auth.me(req.auth!.session) }
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() body: unknown, @Req() req: AuthRequest) {
    const currentPassword = stringField(body, 'currentPassword')
    const newPassword = stringField(body, 'newPassword')
    const user = await this.auth.changePassword(req.auth!.session, currentPassword, newPassword)
    return { user }
  }

  @Post('switch-role')
  @HttpCode(200)
  async switchRole(@Body() body: unknown, @Req() req: AuthRequest) {
    const requested = stringField(body, 'role') as Role
    if (!Object.values(Role).includes(requested))
      throw new HttpException({ code: 'ROLE_NOT_HELD', message: 'Vai trò không hợp lệ.' }, 400)
    return { user: await this.auth.switchRole(req.auth!.session, requested) }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: CookieResponse) {
    await this.auth.logout(req.auth!.session)
    this.setCookie(res, '', 0, true)
    return { ok: true }
  }
}
