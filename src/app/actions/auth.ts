'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { errQS } from '@/lib/errors'
import {
  createPreAuthCookie,
  createSessionCookie,
  clearAuthCookies,
  getPreAuth,
  type SessionUser,
} from '@/lib/auth'
import { issueOtp, verifyOtp } from '@/lib/otp'
import {
  normalizeEmail,
  roleHome,
  sanitizeNext,
  validateSignup,
} from '@/lib/validate'

function fail(path: string, msg: string, extra: Record<string, string> = {}): never {
  redirect(`${path}?${errQS(msg, extra)}`)
  throw new Error('unreachable')
}

export async function signupAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  const password = String(formData.get('password') ?? '')
  const role = String(formData.get('role') ?? '')
  const next = sanitizeNext(formData.get('next'))

  const errs = validateSignup({ name, email, password, role })
  if (errs.length) fail('/signup', errs.join(' '), { next: next ?? '' })

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) fail('/signup', 'An account with this email already exists', { next: next ?? '' })

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    },
  })

  await issueOtp(user.id, user.email)
  await createPreAuthCookie(user.id, next)
  redirect('/verify')
}

export async function loginStep1Action(formData: FormData) {
  const email = normalizeEmail(String(formData.get('email') ?? ''))
  const password = String(formData.get('password') ?? '')
  const next = sanitizeNext(formData.get('next'))

  const user = await db.user.findUnique({ where: { email } })
  const ok = user && (await bcrypt.compare(password, user.passwordHash))
  // never reveal whether the email or the password was wrong
  if (!ok) fail('/login', 'Invalid email or password', { next: next ?? '', email })

  await issueOtp(user!.id, user!.email)
  await createPreAuthCookie(user!.id, next)
  redirect('/verify')
}

export async function verifyStepAction(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim()
  const pre = await getPreAuth()
  if (!pre) fail('/login', 'Your session expired. Please log in again.')

  if (!/^\d{6}$/.test(code))
    fail('/verify', 'Enter the 6-digit code from the server console.')

  const res = await verifyOtp(pre!.userId, code)
  if (!res.ok) fail('/verify', res.error)

  const user = await db.user.findUnique({ where: { id: pre!.userId } })
  if (!user) fail('/login', 'Account not found.')

  await createSessionCookie(user as SessionUser)
  redirect(sanitizeNext(pre!.next) ?? roleHome(user.role))
}

export async function resendOtpAction() {
  const pre = await getPreAuth()
  if (!pre) fail('/login', 'Your session expired. Please log in again.')
  const user = await db.user.findUnique({ where: { id: pre!.userId } })
  if (!user) fail('/login', 'Account not found.')
  const res = await issueOtp(user.id, user.email)
  if (!res.ok)
    fail('/verify', `Please wait ${res.wait}s before requesting a new code.`)
  fail('/verify', 'A new code was printed in the server console.')
}

export async function logoutAction() {
  await clearAuthCookies()
  redirect('/?loggedout=1')
}
