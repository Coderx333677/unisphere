import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import { ApprovalBadge, ScheduleBadge, money } from '@/components/badges'

export const dynamic = 'force-dynamic'

export default async function AdminMonitorPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/login?next=/admin/monitor')

  const now = new Date()
  const [events, expenses, societies] = await Promise.all([
    db.event.findMany({
      include: {
        society: { select: { name: true } },
        registrations: { where: { status: 'REGISTERED' }, select: { id: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { startAt: 'asc' },
    }),
    db.expense.groupBy({
      by: ['eventId'],
      where: { eventId: { not: null } },
      _sum: { amount: true },
    }),
    db.society.count(),
  ])
  const spentBy = new Map(expenses.map((e) => [e.eventId, e._sum.amount ?? 0]))

  return (
    <div className="container-app">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Activity monitor
          </h1>
          <p className="text-sm text-slate-500">
            {societies} societies · {events.length} events · registrations,
            task progress and budgets across the university.
          </p>
        </div>
        <Link href="/admin" className="btn btn-secondary">
          Dashboard
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-app">
          <thead>
            <tr>
              <th>Event</th>
              <th>Society</th>
              <th>Approval</th>
              <th>Schedule</th>
              <th>Registrations</th>
              <th>Progress</th>
              <th>Budget</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400">
                  No events yet.
                </td>
              </tr>
            )}
            {events.map((e) => {
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
                    <div className="flex flex-col gap-1">
                      <ApprovalBadge s={e.approvalStatus} />
                      {e.cancelled && (
                        <span className="badge badge-rose">CANCELLED</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <ScheduleBadge s={R.schedule(e, now)} />
                  </td>
                  <td>
                    {e.registrations.length}/{e.capacity}
                  </td>
                  <td>{R.progress(e.tasks)}%</td>
                  <td className="text-xs">
                    {e.approvedBudget !== null ? (
                      <>
                        <span className="font-semibold">
                          {money(e.approvedBudget)}
                        </span>{' '}
                        · spent {money(spent)} ·{' '}
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
                      </>
                    ) : (
                      <span className="text-slate-400">
                        proposed {money(e.proposedBudget)}
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
  )
}
