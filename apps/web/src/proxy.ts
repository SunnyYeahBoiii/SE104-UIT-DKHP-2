import { NextResponse, type NextRequest } from 'next/server'

import { homeFor, ROLE_LABELS, type AuthUser, type Role } from './lib/auth'

const PUBLIC_PATHS = ['/login', '/offline', '/server-error']

function redirect(request: NextRequest, path: string, query: Record<string, string> = {}) {
  const url = request.nextUrl.clone()
  url.pathname = path
  url.search = ''
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname.startsWith('/api') || PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  const session = request.cookies.get('dkhp_session')?.value
  const me = await fetch(new URL('/api/auth/me', request.url), {
    headers: session ? { cookie: `dkhp_session=${session}` } : {},
    cache: 'no-store',
  }).catch(() => null)

  if (!me) return redirect(request, '/offline')
  if (me.status >= 500) {
    const body = (await me.json().catch(() => ({}))) as { requestId?: string }
    return redirect(request, '/server-error', {
      requestId: me.headers.get('x-request-id') ?? body.requestId ?? 'unknown',
    })
  }
  if (me.status === 401) {
    return redirect(request, '/login', {
      returnTo: `${pathname}${search}`,
      reason: 'expired',
    })
  }

  const body = (await me.json().catch(() => ({}))) as { user?: AuthUser; code?: string }
  const user = body.user
  if (!user) return redirect(request, '/login', { returnTo: `${pathname}${search}` })

  if (user.mustChangePassword && pathname !== '/change-password')
    return redirect(request, '/change-password', { returnTo: `${pathname}${search}` })

  if (!user.activeRole && pathname !== '/select-role')
    return redirect(request, '/select-role', { returnTo: `${pathname}${search}` })

  if (pathname === '/select-role' && user.activeRole)
    return redirect(request, homeFor(user.activeRole))
  if (pathname === '/') return redirect(request, homeFor(user.activeRole))

  const role = user.activeRole as Role
  const wrongRole =
    (pathname.startsWith('/student') && role !== 'STUDENT') ||
    (pathname.startsWith('/staff') && role === 'STUDENT')
  if (wrongRole) {
    const alternative = user.roles.filter((held) => held !== role).map((held) => ROLE_LABELS[held])
    return redirect(
      request,
      '/forbidden',
      alternative.length ? { switchable: alternative.join(', ') } : {},
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|uit-logo.png|.*\\..*).*)'],
}
