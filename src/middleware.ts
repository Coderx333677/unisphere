import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'change-me'
)

const guards: Record<string, string> = {
  '/president': 'PRESIDENT',
  '/student': 'STUDENT',
  '/admin': 'ADMIN',
}

async function getSessionRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('us_session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

const dashboardFor = (role: string | null) =>
  role === 'PRESIDENT' ? '/president' : role === 'ADMIN' ? '/admin' : '/student'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const role = await getSessionRole(req)

  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/events/') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/verify' ||
    pathname.startsWith('/api/')

  // logged-in users should not sit on auth pages
  if (role && ['/login', '/signup', '/verify'].includes(pathname)) {
    return NextResponse.redirect(new URL(dashboardFor(role), req.url))
  }

  if (isPublic) return NextResponse.next()

  // everything else needs a session
  if (!role) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  for (const [prefix, required] of Object.entries(guards)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      if (role !== required) {
        return NextResponse.redirect(new URL(dashboardFor(role), req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|woff2?|ico)).*)'],
}
