import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import {
  submitEventAction,
  cancelEventAction,
} from '@/app/actions/events'
import { ApprovalBadge, ScheduleBadge, money } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PresidentEventsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'PRESIDENT')
    redirect('/login?next=/president/events')

  const society = await db.society.findUnique({
    where: { presidentId: user.id },
  })
  if (!society) redirect('/president/society')

  const now = new Date()
  const events = await db.event.findMany({
    where: { societyId: society.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Events</h1>
          <p className="text-sm text-slate-500">
            Create drafts, submit them for approval, track decisions.
          </p>
        </div>
        <Link href="/president/events/new" className="btn btn-primary">
          New event
        </Link>
      </div>
      <Alerts searchParams={searchParams} />

      {events.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No events yet — create your first draft.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-56">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/president/events/${e.id}`}
                    className="font-bold text-slate-900 hover:text-indigo-600"
                  >
                    {e.title}
                  </Link>
                  {e.cancelled && <span className="badge badge-rose">CANCELLED</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {fmtPKT(e.startAt)} · {e.venue} ·{' '}
                  {e.regCount}/{e.capacity} registered · {money(e.proposedBudget)}
                  {e.approvedBudget !== null &&
                    ` · approved ${money(e.approvedBudget)}`}
                </p>
                {e.adminRemarks && (
                  <p className="mt-1 text-xs text-slate-500">
                    Admin remarks: {e.adminRemarks}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ApprovalBadge s={e.approvalStatus} />
                <ScheduleBadge s={R.schedule(e, now)} />
                <Link
                  href={`/president/events/${e.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  Open
                </Link>
                {R.canSubmit(e, now) && (
                  <form action={submitEventAction}>
                    <input type="hidden" name="eventId" value={e.id} />
                    <button className="btn btn-primary btn-sm" type="submit">
                      Submit
                    </button>
                  </form>
                )}
                {R.canCancel(e, now) && !e.cancelled && (
                  <form action={cancelEventAction}>
                    <input type="hidden" name="eventId" value={e.id} />
                    <button className="btn btn-danger btn-sm" type="submit">
                      Cancel event
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
