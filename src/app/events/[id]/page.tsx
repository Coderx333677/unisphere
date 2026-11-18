import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import { registerAction, cancelRegistrationAction } from '@/app/actions/events'
import { ApprovalBadge, ScheduleBadge, money } from '@/components/badges'
import LiveSeats from '@/components/LiveSeats'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const ev = await db.event.findUnique({
    where: { id: params.id },
    include: { society: { select: { name: true, id: true } } },
  })
  if (!ev) notFound()

  // Pending after an edit: previously approved, hidden while re-reviewed
  if (
    ev.approvalStatus === 'PENDING' &&
    ev.approvedBudget !== null &&
    !ev.cancelled
  ) {
    return (
      <div className="container-app flex min-h-[60vh] items-center justify-center">
        <div className="card max-w-lg text-center">
          <h1 className="text-xl font-bold text-slate-900">
            This page is temporarily unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            “{ev.title}” was edited after approval and is waiting for the
            administrator to re-review it. Existing registrations and
            invitations are kept.
          </p>
          <Link href="/" className="btn btn-secondary mt-5">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (!R.isPublicLink(ev)) notFound()

  const now = new Date()
  const user = await getSessionUser()
  const myReg =
    user && user.role === 'STUDENT'
      ? await db.registration.findUnique({
          where: { eventId_studentId: { eventId: ev.id, studentId: user.id } },
        })
      : null
  const mine = myReg?.status === 'REGISTERED'
  const seatsLeft = Math.max(0, ev.capacity - ev.regCount)
  const canReg = R.canRegister(ev, now) && seatsLeft > 0
  const canCancelReg = mine && R.canCancelRegistration(ev, now)

  return (
    <div className="container-app">
      <Alerts searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ApprovalBadge s={ev.approvalStatus} />
              <ScheduleBadge s={R.schedule(ev, now)} />
              <span className="badge badge-indigo">{ev.society.name}</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900">{ev.title}</h1>
            <p className="mt-4 whitespace-pre-wrap text-slate-700">
              {ev.description}
            </p>
          </div>

          <div className="card mt-4">
            <h2 className="mb-3 font-bold text-slate-900">Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Starts
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {fmtPKT(ev.startAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Ends
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {fmtPKT(ev.endAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Venue
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {ev.venue}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Organizer
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {ev.society.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Registration deadline
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {fmtPKT(ev.regDeadline)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Capacity
                </dt>
                <dd className="text-sm font-medium text-slate-800">
                  {ev.capacity} participants
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-slate-900">Registration</h2>
            <p className="mt-2 text-sm text-slate-600">
              <LiveSeats eventId={ev.id} initialLeft={seatsLeft} /> of{' '}
              {ev.capacity} seats
            </p>

            <div className="mt-4">
              {mine ? (
                <div className="space-y-2">
                  <div className="alert alert-ok mb-0">
                    You are registered for this event.
                  </div>
                  {canCancelReg && (
                    <form action={cancelRegistrationAction}>
                      <input type="hidden" name="eventId" value={ev.id} />
                      <button type="submit" className="btn btn-danger w-full">
                        Cancel registration
                      </button>
                    </form>
                  )}
                </div>
              ) : canReg ? (
                user && user.role === 'STUDENT' ? (
                  <form action={registerAction}>
                    <input type="hidden" name="eventId" value={ev.id} />
                    <button type="submit" className="btn btn-primary w-full">
                      Register now
                    </button>
                  </form>
                ) : user ? (
                  <p className="alert alert-error mb-0">
                    Only Student / Volunteer accounts can register for events.
                  </p>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/events/${ev.id}`)}`}
                    className="btn btn-primary w-full"
                  >
                    Log in to register
                  </Link>
                )
              ) : (
                <p className="alert alert-error mb-0">
                  {seatsLeft === 0
                    ? 'This event is full.'
                    : ev.cancelled
                      ? 'This event was cancelled.'
                      : now > ev.regDeadline
                        ? 'The registration deadline has passed.'
                        : R.schedule(ev, now) !== 'UPCOMING'
                          ? 'The event has started — registration is closed.'
                          : 'Registration is closed.'}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-900">Budget</h2>
            <p className="mt-2 text-sm text-slate-600">
              Approved budget:{' '}
              <span className="font-semibold text-slate-800">
                {ev.approvedBudget !== null ? money(ev.approvedBudget) : '—'}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Proposed: {money(ev.proposedBudget)}
            </p>
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-900">Find more</h2>
            <Link
              href="/"
              className="mt-2 block text-sm font-medium text-indigo-600 hover:underline"
            >
              ← All upcoming events
            </Link>
            {!user && (
              <Link
                href={`/signup?next=${encodeURIComponent(`/events/${ev.id}`)}`}
                className="mt-1 block text-sm font-medium text-indigo-600 hover:underline"
              >
                New here? Sign up
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
