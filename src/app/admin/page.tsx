import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import { ApprovalBadge, ScheduleBadge, money } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

const TABS = ['pending', 'approved', 'upcoming', 'ongoing', 'completed'] as const

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; tab?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/login?next=/admin')

  const now = new Date()
  const [societyCount, eventCount, regCount, pending, events, expenses, myMegaEvents] =
    await Promise.all([
      db.society.count(),
      db.event.count(),
      db.registration.count({ where: { status: 'REGISTERED' } }),
      db.event.findMany({
        where: { approvalStatus: 'PENDING', cancelled: false },
        include: { society: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      db.event.findMany({
        include: {
          society: { select: { name: true } },
          tasks: { select: { status: true } },
          _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
        },
        orderBy: { startAt: 'asc' },
      }),
      db.expense.groupBy({
        by: ['eventId'],
        where: { eventId: { not: null } },
        _sum: { amount: true },
      }),
      db.megaEvent.findMany({
        where: { createdById: user.id },
        include: {
          society: { select: { name: true } },
          president: { select: { name: true } },
          _count: { select: { subEvents: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

  const spentBy = new Map(
    expenses.map((e) => [e.eventId, e._sum.amount ?? 0])
  )

  const tab = (TABS as readonly string[]).includes(searchParams.tab ?? '')
    ? searchParams.tab!
    : 'pending'

  const visible = events.filter((e) => {
    if (e.cancelled) return false
    const sched = R.schedule(e, now)
    if (tab === 'pending') return e.approvalStatus === 'PENDING'
    if (tab === 'approved')
      return e.approvalStatus === 'APPROVED' && sched !== 'COMPLETED'
    return e.approvalStatus === 'APPROVED' && sched === tab.toUpperCase()
  })

  return (
    <div className="container-app">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">
          Administrator dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Live counts from the database · event and budget decisions are made
          together.
        </p>
      </div>
      <Alerts searchParams={searchParams} />

      <div className="grid gap-4 sm:grid-cols-5">
        {[
          { l: 'Societies', v: societyCount },
          { l: 'Events', v: eventCount },
          { l: 'Active registrations', v: regCount },
          { l: 'Pending proposals', v: pending.length },
          { l: 'My Mega Events', v: myMegaEvents.length },
        ].map((s) => (
          <div key={s.l} className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {s.l}
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">{s.v}</p>
          </div>
        ))}
      </div>

      {/* Task 2: Mega Events Section */}
      <div className="card mt-5 border-l-4 border-l-indigo-600">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Mega Events Management</h2>
            <p className="text-xs text-slate-500">
              Parent mega events created by you with multi-sub-event allocations.
            </p>
          </div>
          <Link
            href="/admin/mega-events"
            className="btn btn-primary btn-sm"
          >
            Manage Mega Events →
          </Link>
        </div>
        {myMegaEvents.length === 0 ? (
          <p className="text-sm text-slate-500">
            No Mega Events created yet.{' '}
            <Link
              href="/admin/mega-events"
              className="text-indigo-600 hover:underline"
            >
              Create a Mega Event
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-app">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Society</th>
                  <th>Assigned President</th>
                  <th>Budget</th>
                  <th>Sub-Events</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {myMegaEvents.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold text-slate-800">{m.title}</td>
                    <td>{m.society.name}</td>
                    <td>{m.president.name}</td>
                    <td className="font-semibold">{money(m.overallBudget)}</td>
                    <td>{m._count.subEvents} sub-events</td>
                    <td className="text-right">
                      <Link
                        href={`/admin/mega-events/${m.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Pending proposals</h2>
          <Link
            href="/admin/societies"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            All societies
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing waiting for review.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-app">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Society</th>
                  <th>Start</th>
                  <th>Proposed budget</th>
                  <th>Capacity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium text-slate-800">{e.title}</td>
                    <td>{e.society.name}</td>
                    <td>{fmtPKT(e.startAt)}</td>
                    <td className="font-semibold">{money(e.proposedBudget)}</td>
                    <td>
                      {e.regCount}/{e.capacity}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/admin?tab=${t}`}
              className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="table-app">
            <thead>
              <tr>
                <th>Event</th>
                <th>Society</th>
                <th>Status</th>
                <th>Regs</th>
                <th>Task progress</th>
                <th>Budget (approved / spent / remaining)</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400">
                    No events in this tab.
                  </td>
                </tr>
              )}
              {visible.map((e) => {
                const spent = spentBy.get(e.id) ?? 0
                const rem =
                  e.approvedBudget !== null ? e.approvedBudget - spent : null
                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {e.title}
                      </Link>
                      <p className="text-xs text-slate-400">{fmtPKT(e.startAt)}</p>
                    </td>
                    <td>{e.society.name}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <ApprovalBadge s={e.approvalStatus} />
                        <ScheduleBadge s={R.schedule(e, now)} />
                      </div>
                    </td>
                    <td>
                      {e._count.registrations}/{e.capacity}
                    </td>
                    <td>{R.progress(e.tasks)}%</td>
                    <td>
                      {e.approvedBudget !== null ? (
                        <span className="text-xs">
                          {money(e.approvedBudget)} / {money(spent)} /{' '}
                          <span
                            className={
                              rem !== null && rem < 0
                                ? 'font-semibold text-rose-600'
                                : 'font-semibold'
                            }
                          >
                            {rem !== null ? money(rem) : '—'}
                            {rem !== null && rem < 0 && (
                              <span className="badge badge-rose ml-1">
                                Over budget
                              </span>
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          not approved
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
