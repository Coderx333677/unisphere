import Link from 'next/link'
import { loginStep1Action } from '@/app/actions/auth'
import { sanitizeNext } from '@/lib/validate'
import Alerts from '@/components/Alerts'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; email?: string }
}) {
  const next = sanitizeNext(searchParams.next) ?? ''

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Step 1 of 2 — password first, then a 6-digit code from the server
          console.
        </p>
        <Alerts searchParams={searchParams} />
        <form action={loginStep1Action} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={searchParams.email ?? ''}
              placeholder="you@university.edu"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              placeholder="At least 8 characters"
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Continue
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          No account yet?{' '}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-semibold text-indigo-600 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
