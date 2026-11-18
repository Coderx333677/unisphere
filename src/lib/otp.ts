import { createHash, randomInt } from 'crypto'
import { db } from './db'

const h = (c: string) => createHash('sha256').update(c).digest('hex')

export async function issueOtp(userId: string, email: string, force = false) {
  const last = await db.otpCode.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  if (
    !force &&
    last &&
    Date.now() - last.createdAt.getTime() < 60_000
  )
    return {
      ok: false as const,
      wait: Math.ceil(
        (60_000 - (Date.now() - last.createdAt.getTime())) / 1000
      ),
    }
  await db.otpCode.updateMany({
    where: { userId, invalidated: false, consumed: false },
    data: { invalidated: true },
  })
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await db.otpCode.create({
    data: {
      userId,
      codeHash: h(code),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  })
  console.log(`\n[UniSphere OTP] ${email} -> ${code} (valid 10 min)\n`)
  return { ok: true as const }
}

export async function verifyOtp(userId: string, code: string) {
  const o = await db.otpCode.findFirst({
    where: { userId, invalidated: false, consumed: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!o)
    return { ok: false as const, error: 'No active code. Request a new one.' }
  if (o.expiresAt < new Date())
    return { ok: false as const, error: 'Code expired. Request a new one.' }
  if (o.codeHash !== h(code)) {
    const attempts = o.attempts + 1
    await db.otpCode.update({
      where: { id: o.id },
      data: { attempts, invalidated: attempts >= 5 },
    })
    return {
      ok: false as const,
      error:
        attempts >= 5
          ? 'Too many attempts. Request a new code.'
          : `Wrong code. ${5 - attempts} tries left.`,
    }
  }
  await db.otpCode.update({ where: { id: o.id }, data: { consumed: true } })
  return { ok: true as const }
}
