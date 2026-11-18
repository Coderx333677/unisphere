import Link from 'next/link'
import { signupAction } from '@/app/actions/auth'
import { sanitizeNext } from '@/lib/validate'
import Alerts from '@/components/Alerts'

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string }
}) {
  const next = sanitizeNext(searchParams.next) ?? ''

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Choose your role — it cannot be changed later. Administrator accounts
          are created by seed only.
        </p>
        <Alerts searchParams={searchParams} />
        <form action={signupAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className="input"
              name="name"
              required
              minLength={2}
              placeholder="Ayesha Khan"
            />
          </div>
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
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="label" htmlFor="role">
              I am a…
            </label>
            <select id="role" name="role" className="input" required defaultValue="">
              <option value="" disabled>
                Select your role
              </option>
              <option value="PRESIDENT">Society President / Organizer</option>
              <option value="STUDENT">Student / Volunteer</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Sign up &amp; send code
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-semibold text-indigo-600 hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
