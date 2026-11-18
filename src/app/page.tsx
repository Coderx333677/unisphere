import Link from 'next/link'
import { db } from '@/lib/db'
import { fmtPKT } from '@/lib/time'
import { money, ScheduleBadge } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: { loggedout?: string; error?: string; ok?: string }
}) {
  const now = new Date()
  const events = await db.event.findMany({
    where: {
      approvalStatus: 'APPROVED',
      cancelled: false,
      startAt: { gt: now },
    },
    orderBy: { startAt: 'asc' },
    take: 6,
    include: { society: { select: { name: true } } },
  })

  return (
    <div>
      {searchParams.loggedout && (
        <div className="container-app pb-0">
          <div className="alert alert-ok">You have been logged out.</div>
        </div>
      )}
      <section className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-200">
            University Society &amp; Event Management
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Campus activities, coordinated in one place.
          </h1>
          <p className="mt-4 max-w-2xl text-indigo-100">
            UniSphere connects society presidents, students and university
            administration — societies, event proposals, budgets, volunteers,
            tasks and expenses with a single approval workflow and live updates.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="btn bg-white text-indigo-700 hover:bg-indigo-50"
            >
              Get started — Sign up
            </Link>
            <Link
              href="/login"
              className="btn border border-white/40 text-white hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      <section className="container-app">
        <Alerts searchParams={searchParams} />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              t: 'Students discover',
              d: 'Browse societies, request membership, register for approved events and complete volunteer tasks.',
            },
            {
              t: 'Organizers coordinate',
              d: 'Presidents create one society, propose events and budgets, invite volunteers and track expenses.',
            },
            {
              t: 'Admin oversees',
              d: 'University administration reviews event + budget proposals as one decision and monitors activity.',
            },
          ].map((c) => (
            <div key={c.t} className="card">
              <h3 className="font-bold text-slate-900">{c.t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-app pt-2">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Next upcoming events
            </h2>
            <p className="text-sm text-slate-500">
              Approved events, live from the database
            </p>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="card text-sm text-slate-500">
            No upcoming approved events yet. Check back soon!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="card block transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <ScheduleBadge s="UPCOMING" />
                  <span className="text-xs font-semibold text-slate-500">
                    {e.society.name}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900">{e.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {fmtPKT(e.startAt)} · {e.venue}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {Math.max(0, e.capacity - e.regCount)} of {e.capacity} seats
                  left · budget {money(e.proposedBudget)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-app pb-10">
        <div className="card flex flex-col items-start justify-between gap-4 bg-slate-900 text-white sm:flex-row sm:items-center">
          <div>
            <h3 className="font-bold">Ready to run your society?</h3>
            <p className="text-sm text-slate-300">
              Sign up as a Society President or Student — OTP login in two
              steps.
            </p>
          </div>
          <Link href="/signup" className="btn btn-primary">
            Create an account
          </Link>
        </div>
      </section>
    </div>
  )
}
