import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db } from './db'
import { HttpError } from './errors'
import { sanitizeNext, roleHome } from './validate'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'change-me')

export const SESSION_COOKIE = 'us_session'
export const PRE_COOKIE = 'us_pre'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'PRESIDENT' | 'STUDENT' | 'ADMIN'
}

async function sign(payload: object, maxAge: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secret())
}

async function verify(token: string) {
  const { payload } = await jwtVerify(token, secret())
  return payload as Record<string, unknown>
}

export async function createSessionCookie(user: SessionUser) {
  const token = await sign(
    { sub: user.id, role: user.role },
    7 * 24 * 60 * 60
  )
  const jar = cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })
  jar.delete(PRE_COOKIE)
}

export async function createPreAuthCookie(userId: string, next?: string | null) {
  const token = await sign({ sub: userId, next: sanitizeNext(next) }, 15 * 60)
  cookies().set(PRE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  })
}

export async function clearAuthCookies() {
  cookies().delete(SESSION_COOKIE)
  cookies().delete(PRE_COOKIE)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const payload = await verify(token)
    const id = String(payload.sub ?? '')
    if (!id) return null
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    })
    if (!user) return null
    return user as SessionUser
  } catch {
    return null
  }
}

export async function getPreAuth(): Promise<{ userId: string; next: string | null } | null> {
  const token = cookies().get(PRE_COOKIE)?.value
  if (!token) return null
  try {
    const payload = await verify(token)
    const userId = String(payload.sub ?? '')
    if (!userId) return null
    return { userId, next: sanitizeNext(payload.next) }
  } catch {
    return null
  }
}

export async function requireUser(role?: 'PRESIDENT' | 'STUDENT' | 'ADMIN') {
  const u = await getSessionUser()
  if (!u) throw new HttpError(401)
  if (role && u.role !== role) throw new HttpError(403)
  return u
}

export async function requireOwnEvent(user: SessionUser, eventId: string) {
  const ev = await db.event.findUnique({
    where: { id: eventId },
    include: { society: true },
  })
  if (!ev || ev.society.presidentId !== user.id) throw new HttpError(404)
  return ev
}

export const dashboardFor = roleHome
