import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtDateOnlyPKT } from '@/lib/time'
import { money } from '@/components/badges'
import Alerts from '@/components/Alerts'
import AdminMegaEventForm from '@/components/AdminMegaEventForm'

export const dynamic = 'force-dynamic'

export default async function AdminMegaEventsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/login?next=/admin/mega-events')

  const [megaEvents, societies] = await Promise.all([
    db.megaEvent.findMany({
      where: { createdById: user.id },
      include: {
        society: { select: { id: true, name: true } },
        president: { select: { id: true, name: true, email: true } },
        subEvents: {
          select: {
            id: true,
            allocation: true,
            tasks: { select: { status: true } },
            expenses: { select: { amount: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.society.findMany({
      include: {
        president: { select: { id: true, name: true, email: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Mega Events</h1>
          <p className="text-sm text-slate-500">
            Create and monitor society mega events · scoped to your admin account.
          </p>
        </div>
        <Link href="/admin" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>

      <Alerts searchParams={searchParams} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Create Mega Event Form */}
        <div className="card lg:col-span-1">
          <h2 className="mb-1 text-lg font-bold text-slate-900">
            Create Mega Event
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Select a society to auto-assign its president and allocate an overall budget.
          </p>
          {societies.length === 0 ? (
            <p className="text-sm text-amber-600">
              No societies exist yet. Create a society first.
            </p>
          ) : (
            <AdminMegaEventForm societies={societies} />
          )}
        </div>

        {/* Right: List of Created Mega Events */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              My Created Mega Events ({megaEvents.length})
            </h2>
          </div>

          {megaEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                You have not created any Mega Events yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Use the form on the left to set up a new parent Mega Event.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {megaEvents.map((m) => {
                const totalAllocated = m.subEvents.reduce(
                  (sum, s) => sum + s.allocation,
                  0
                )
                const totalSpent = m.subEvents.reduce(
                  (sum, s) =>
                    sum + s.expenses.reduce((es, e) => es + e.amount, 0),
                  0
                )
                const allTasks = m.subEvents.flatMap((s) => s.tasks)
                const completedTasks = allTasks.filter(
                  (t) => t.status === 'COMPLETED'
                ).length
                const taskPct =
                  allTasks.length === 0
                    ? 0
                    : Math.round((completedTasks / allTasks.length) * 100)

                return (
                  <div key={m.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/mega-events/${m.id}`}
                          className="text-base font-bold text-indigo-600 hover:underline"
                        >
                          {m.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          Society:{' '}
                          <span className="font-semibold text-slate-700">
                            {m.society.name}
                          </span>{' '}
                          · President:{' '}
                          <span className="font-medium text-slate-700">
                            {m.president.name}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          🗓 {fmtDateOnlyPKT(m.startDate)} –{' '}
                          {fmtDateOnlyPKT(m.endDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Link
                          href={`/admin/mega-events/${m.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View / Edit
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-slate-400">Budget:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {money(m.overallBudget)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Allocated:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {money(totalAllocated)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Sub-events:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {m.subEvents.length}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Task Progress:</span>{' '}
                        <span className="font-semibold text-emerald-600">
                          {taskPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
