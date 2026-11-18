import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPreAuth } from '@/lib/auth'
import { verifyStepAction, resendOtpAction } from '@/app/actions/auth'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const pre = await getPreAuth()
  if (!pre) {
    redirect('/login?error=Your+verification+session+expired.+Please+log+in+again.')
  }
  const user = await db.user.findUnique({ where: { id: pre!.userId } })
  if (!user) redirect('/login?error=Account+not+found.')

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">
          Enter your 6-digit code
        </h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          We sent a code to <span className="font-semibold">{user!.email}</span>.
          For this local demo the code is printed in the terminal running the
          server — it is never shown in the UI.
        </p>
        <Alerts searchParams={searchParams} />
        <form action={verifyStepAction} className="space-y-3">
          <div>
            <label className="label" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              className="input text-center text-2xl tracking-[0.5em]"
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              placeholder="000000"
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Verify &amp; continue
          </button>
        </form>
        <form action={resendOtpAction} className="mt-3">
          <button type="submit" className="btn btn-secondary w-full">
            Resend code (60s cooldown)
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Wrong email?{' '}
          <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
            Start over
          </Link>
        </p>
      </div>
    </div>
  )
}
