import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import { decideEventAction } from '@/app/actions/events'
import {
  ApprovalBadge,
  ScheduleBadge,
  money,
} from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function AdminEventReviewPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN')
    redirect(`/login?next=${encodeURIComponent(`/admin/events/${params.id}`)}`)

  const ev = await db.event.findUnique({
    where: { id: params.id },
    include: {
      society: { include: { president: { select: { name: true, email: true } } } },
      registrations: { select: { id: true, status: true } },
      tasks: { select: { status: true } },
      expenses: { select: { amount: true } },
    },
  })
  if (!ev) notFound()

  const now = new Date()
  const activeRegs = ev.registrations.filter((r) => r.status === 'REGISTERED')
  const spent = ev.expenses.reduce((s, x) => s + x.amount, 0)
  const canApprove = R.adminCanApprove(ev, now)
  const canReject = R.adminCanReject(ev)

  return (
    <div className="container-app">
      <Alerts searchParams={searchParams} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <ApprovalBadge s={ev.approvalStatus} />
            <ScheduleBadge s={R.schedule(ev, now)} />
            {ev.cancelled && <span className="badge badge-rose">CANCELLED</span>}
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-900">
            {ev.title}
          </h1>
          <p className="text-sm text-slate-500">
            {ev.society.name} · proposed by {ev.society.president.name} (
            {ev.society.president.email})
          </p>
        </div>
        <Link href="/admin" className="btn btn-secondary">
          ← Dashboard
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card">
            <h2 className="mb-2 font-bold text-slate-900">Proposal</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {ev.description}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Venue
                </dt>
                <dd className="font-medium">{ev.venue}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Schedule (PKT)
                </dt>
                <dd className="font-medium">
                  {fmtPKT(ev.startAt)} → {fmtPKT(ev.endAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Registration deadline
                </dt>
                <dd className="font-medium">{fmtPKT(ev.regDeadline)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Capacity
                </dt>
                <dd className="font-medium">
                  {activeRegs.length} registered / {ev.capacity} seats
                </dd>
              </div>
            </dl>
          </div>

          {ev.decidedAt && (
            <div
              className={`alert ${ev.approvalStatus === 'APPROVED' ? 'alert-ok' : 'alert-error'}`}
            >
              <strong>Previously decided: {ev.approvalStatus}</strong> on{' '}
              {fmtPKT(ev.decidedAt)}.
              {ev.adminRemarks && <> Remarks: “{ev.adminRemarks}”</>}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-slate-900">Budget review</h2>
            <p className="mt-3 text-3xl font-black text-slate-900">
              {money(ev.proposedBudget)}
            </p>
            <p className="text-xs text-slate-400">proposed budget (PKR)</p>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Budget in force</span>
                <span className="font-semibold">
                  {ev.approvedBudget !== null
                    ? money(ev.approvedBudget)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Expenses recorded</span>
                <span className="font-semibold">{money(spent)}</span>
              </div>
              <div className="flex justify-between">
                <span>Task progress</span>
                <span className="font-semibold">{R.progress(ev.tasks)}%</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              One decision covers both the event and its budget. The requested
              amount cannot be edited here.
            </p>
          </div>

          {canApprove || canReject ? (
            <div className="card space-y-4">
              <h2 className="font-bold text-slate-900">Decision</h2>
              <form action={decideEventAction} className="space-y-2">
                <input type="hidden" name="eventId" value={ev.id} />
                <div>
                  <label className="label" htmlFor="remarks">
                    Remarks
                  </label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    className="input min-h-20"
                    placeholder="Required when rejecting; optional when approving."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approve"
                    className="btn btn-success"
                    disabled={!canApprove}
                  >
                    Approve event + budget
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="reject"
                    className="btn btn-danger"
                    disabled={!canReject}
                  >
                    Reject
                  </button>
                </div>
                {ev.startAt <= now && ev.approvalStatus === 'PENDING' && (
                  <p className="text-xs text-rose-600">
                    The start time has passed — this pending event can only be
                    rejected.
                  </p>
                )}
                {ev.approvalStatus !== 'PENDING' && (
                  <p className="text-xs text-slate-400">
                    Only pending events can be decided.
                  </p>
                )}
              </form>
            </div>
          ) : (
            <div className="card">
              <p className="text-sm text-slate-500">
                This event is not pending review. Current status:{' '}
                <ApprovalBadge s={ev.approvalStatus} />
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
