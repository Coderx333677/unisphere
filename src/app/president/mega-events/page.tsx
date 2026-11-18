import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { fmtDateOnlyPKT } from '@/lib/time'
import { money } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PresidentMegaEventsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await requireUser('PRESIDENT').catch(() => null)
  if (!user) redirect('/login?next=/president/mega-events')

  const megaEvents = await db.megaEvent.findMany({
    where: { presidentId: user.id },
    include: {
      society: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      subEvents: {
        include: {
          supervisor: { select: { name: true } },
          tasks: { select: { status: true } },
          expenses: { select: { amount: true } },
        },
        orderBy: { startsAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Assigned Mega Events
          </h1>
          <p className="text-sm text-slate-500">
            Mega events assigned to your society by university administration.
          </p>
        </div>
        <Link href="/president" className="btn btn-secondary">
          Dashboard
        </Link>
      </div>

      <Alerts searchParams={searchParams} />

      {megaEvents.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-base font-semibold text-slate-700">
            No Mega Events assigned yet.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            When university administration creates a Mega Event for your society, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {megaEvents.map((m) => {
            const totalAllocated = m.subEvents.reduce(
              (sum, s) => sum + s.allocation,
              0
            )
            const available = m.overallBudget - totalAllocated
            const allTasks = m.subEvents.flatMap((s) => s.tasks)
            const completedTasks = allTasks.filter(
              (t) => t.status === 'COMPLETED'
            ).length
            const taskPct =
              allTasks.length === 0
                ? 0
                : Math.round((completedTasks / allTasks.length) * 100)
            const totalSpent = m.subEvents.reduce(
              (sum, s) =>
                sum + s.expenses.reduce((es, e) => es + e.amount, 0),
              0
            )

            return (
              <div key={m.id} className="card flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="badge badge-indigo">
                        {m.society.name}
                      </span>
                      <h2 className="mt-2 text-lg font-bold text-slate-900">
                        {m.title}
                      </h2>
                    </div>
                    <Link
                      href={`/president/mega-events/${m.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Open Event →
                    </Link>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                    {m.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    🗓 {fmtDateOnlyPKT(m.startDate)} – {fmtDateOnlyPKT(m.endDate)}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-slate-400">Budget</p>
                      <p className="font-bold text-slate-800">
                        {money(m.overallBudget)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Allocated</p>
                      <p className="font-bold text-indigo-600">
                        {money(totalAllocated)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Available</p>
                      <p className="font-bold text-slate-700">
                        {money(available)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Task Progress</p>
                      <p className="font-bold text-emerald-600">{taskPct}%</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {m.subEvents.length} sub-events created
                    </span>
                    <span>
                      Spent: {money(totalSpent)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
