import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import { ApprovalBadge, ScheduleBadge, MembershipBadge, money } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PresidentDashboard({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await requireUser('PRESIDENT').catch(() => null)
  if (!user) redirect('/login?next=/president')

  const society = await db.society.findUnique({
    where: { presidentId: user.id },
    include: {
      _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
    },
  })

  if (!society) {
    return (
      <div className="container-app">
        <Alerts searchParams={searchParams} />
        <div className="card mx-auto max-w-lg text-center">
          <h1 className="text-xl font-bold text-slate-900">
            Create your society first
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Each Society President can create and manage exactly one society.
            It becomes active immediately — no admin approval needed.
          </p>
          <Link href="/president/society" className="btn btn-primary mt-5">
            Create society
          </Link>
        </div>
      </div>
    )
  }

  const now = new Date()
  const [events, pendingMembers, pendingInvitations] = await Promise.all([
    db.event.findMany({
      where: { societyId: society.id },
      orderBy: { startAt: 'desc' },
    }),
    db.membership.findMany({
      where: { societyId: society.id, status: 'PENDING' },
      include: { student: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.invitation.findMany({
      where: { status: 'PENDING', event: { societyId: society.id } },
      include: {
        student: { select: { name: true } },
        event: { select: { title: true, id: true } },
      },
    }),
  ])

  const upcoming = events
    .filter((e) => R.schedule(e, now) === 'UPCOMING' && !e.cancelled)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .slice(0, 5)

  const stats = {
    total: events.length,
    pending: events.filter((e) => e.approvalStatus === 'PENDING').length,
    approved: events.filter((e) => e.approvalStatus === 'APPROVED').length,
    members: society._count.memberships,
  }

  return (
    <div className="container-app">
      <Alerts searchParams={searchParams} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {society.name}
          </h1>
          <p className="text-sm text-slate-500">
            President dashboard · {society.category}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/president/society" className="btn btn-secondary">
            Edit society
          </Link>
          <Link href="/president/events/new" className="btn btn-primary">
            New event
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: 'Events', v: stats.total },
          { l: 'Pending approval', v: stats.pending },
          { l: 'Approved', v: stats.approved },
          { l: 'Members', v: stats.members },
        ].map((s) => (
          <div key={s.l} className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {s.l}
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Membership requests</h2>
            <Link
              href="/president/members"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Manage all
            </Link>
          </div>
          {pendingMembers.length === 0 ? (
            <p className="text-sm text-slate-500">No pending requests.</p>
          ) : (
            <ul className="space-y-2">
              {pendingMembers.slice(0, 5).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{m.student.name}</p>
                    <p className="text-xs text-slate-400">{m.student.email}</p>
                  </div>
                  <MembershipBadge s={m.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Upcoming events</h2>
            <Link
              href="/president/events"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              All events
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming events.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <Link
                      href={`/president/events/${e.id}`}
                      className="font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {e.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {fmtPKT(e.startAt)} · {money(e.proposedBudget)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ApprovalBadge s={e.approvalStatus} />
                    <ScheduleBadge s={R.schedule(e, now)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <div className="card mt-4">
          <h2 className="mb-3 font-bold text-slate-900">
            Invitation responses waiting for you
          </h2>
          <ul className="space-y-1.5 text-sm">
            {pendingInvitations.map((i) => (
              <li key={i.id} className="text-slate-600">
                <span className="font-medium">{i.student.name}</span> was
                invited to{' '}
                <Link
                  href={`/president/events/${i.event.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {i.event.title}
                </Link>{' '}
                — awaiting response.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
