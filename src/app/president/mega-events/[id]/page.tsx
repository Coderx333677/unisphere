import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { DateTime } from 'luxon'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ZONE, fmtDateOnlyPKT, fmtPKT } from '@/lib/time'
import { money } from '@/components/badges'
import Alerts from '@/components/Alerts'
import PresidentSubEventForm from '@/components/PresidentSubEventForm'
import { calculateSubEventProgress } from '@/lib/mega-events'
import PresidentAiAnalysis from '@/components/PresidentAiAnalysis'

export const dynamic = 'force-dynamic'

export default async function PresidentMegaEventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const user = await requireUser('PRESIDENT').catch(() => null)
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/president/mega-events/${params.id}`)}`)
  }

  const megaEvent = await db.megaEvent.findUnique({
    where: { id: params.id },
    include: {
      society: true,
      president: true,
      createdBy: { select: { id: true, name: true } },
      subEvents: {
        include: {
          supervisor: { select: { id: true, name: true, email: true } },
          tasks: { select: { id: true, status: true } },
          expenses: { select: { id: true, amount: true } },
        },
        orderBy: { startsAt: 'asc' },
      },
    },
  })

  // Enforce visibility rule: President sees only records where presidentId = their user ID
  if (!megaEvent || megaEvent.presidentId !== user.id) {
    notFound()
  }

  const allStudents = await db.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  const minDate = DateTime.fromJSDate(megaEvent.startDate)
    .setZone(ZONE)
    .toFormat('yyyy-LL-dd')
  const maxDate = DateTime.fromJSDate(megaEvent.endDate)
    .setZone(ZONE)
    .toFormat('yyyy-LL-dd')

  const totalAllocated = megaEvent.subEvents.reduce(
    (sum, s) => sum + s.allocation,
    0
  )
  const availableAllocation = megaEvent.overallBudget - totalAllocated
  const totalSpent = megaEvent.subEvents.reduce(
    (sum, s) => sum + s.expenses.reduce((es, e) => es + e.amount, 0),
    0
  )
  const remainingTotal = megaEvent.overallBudget - totalSpent

  const allTasks = megaEvent.subEvents.flatMap((s) => s.tasks)
  const totalTasksCount = allTasks.length
  const completedTasksCount = allTasks.filter(
    (t) => t.status === 'COMPLETED'
  ).length
  const overallTaskProgress =
    totalTasksCount === 0
      ? 0
      : Math.round((completedTasksCount / totalTasksCount) * 100)

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/president/mega-events"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
            >
              ← Assigned Mega Events
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              {megaEvent.society.name}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            {megaEvent.title}
          </h1>
          <p className="text-sm text-slate-500">
            🗓 {fmtDateOnlyPKT(megaEvent.startDate)} –{' '}
            {fmtDateOnlyPKT(megaEvent.endDate)} · Created by Admin{' '}
            {megaEvent.createdBy.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/president/mega-events" className="btn btn-secondary">
            All Mega Events
          </Link>
        </div>
      </div>

      <Alerts searchParams={searchParams} />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Overall Budget
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {money(megaEvent.overallBudget)}
          </p>
          <p className="text-xs text-slate-400">Allocated to Mega Event</p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Total Allocated
          </p>
          <p className="mt-1 text-2xl font-black text-indigo-600">
            {money(totalAllocated)}
          </p>
          <p className="text-xs text-slate-400">
            Across {megaEvent.subEvents.length} sub-events
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Available to Allocate
          </p>
          <p
            className={`mt-1 text-2xl font-black ${
              availableAllocation < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {money(availableAllocation)}
          </p>
          <p className="text-xs text-slate-400">Budget pool remaining</p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Overall Task Progress
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">
              {overallTaskProgress}%
            </span>
            <span className="text-xs text-slate-400">
              ({completedTasksCount}/{totalTasksCount} tasks)
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${overallTaskProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* AI Analysis Panel (Bonus feature) */}
      <div className="mt-5">
        <PresidentAiAnalysis
          megaEventId={megaEvent.id}
          stats={{
            title: megaEvent.title,
            subEventsCount: megaEvent.subEvents.length,
            overallBudget: megaEvent.overallBudget,
            totalAllocated,
            availableAllocation,
            totalSpent,
            remainingTotal,
            totalTasksCount,
            completedTasksCount,
            taskProgress: overallTaskProgress,
            subEvents: megaEvent.subEvents.map((s) => ({
              title: s.title,
              venue: s.venue,
              supervisor: s.supervisor.name,
              allocation: s.allocation,
              spent: s.expenses.reduce((sum, e) => sum + e.amount, 0),
              tasksCount: s.tasks.length,
              completedTasksCount: s.tasks.filter((t) => t.status === 'COMPLETED').length,
              taskProgress: calculateSubEventProgress(s.tasks),
            })),
          }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Create Sub-Event Form */}
        <div className="card lg:col-span-1">
          <h2 className="mb-1 text-lg font-bold text-slate-900">
            Create Sub-Event
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Add a sub-event, assign a student supervisor, and allocate budget from the available pool.
          </p>

          <PresidentSubEventForm
            megaEventId={megaEvent.id}
            minDate={minDate}
            maxDate={maxDate}
            availableBudget={availableAllocation}
            students={allStudents}
          />
        </div>

        {/* Right: Sub-events List */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Sub-Events ({megaEvent.subEvents.length})
            </h2>
            <span className="text-xs text-slate-400">
              Click a sub-event to manage tasks and expenses
            </span>
          </div>

          {megaEvent.subEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No sub-events created yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                According to the specification, create at least two sub-events and assign one supervisor to each.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {megaEvent.subEvents.map((s) => {
                const pct = calculateSubEventProgress(s.tasks)
                const spent = s.expenses.reduce((sum, e) => sum + e.amount, 0)
                const remaining = s.allocation - spent
                const isOver80 = s.allocation > 0 && spent >= s.allocation * 0.8

                return (
                  <div key={s.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/president/mega-events/${megaEvent.id}/sub-events/${s.id}`}
                            className="text-base font-bold text-indigo-600 hover:underline"
                          >
                            {s.title}
                          </Link>
                          {isOver80 && (
                            <span className="badge badge-rose text-[10px]">
                              80%+ Budget Used
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          📍 {s.venue} · 🕒 {fmtPKT(s.startsAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Supervisor:{' '}
                          <span className="font-semibold text-slate-800">
                            {s.supervisor.name}
                          </span>{' '}
                          ({s.supervisor.email})
                        </p>
                      </div>

                      <div className="text-right">
                        <Link
                          href={`/president/mega-events/${megaEvent.id}/sub-events/${s.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Manage Sub-Event →
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-slate-400">Allocation:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {money(s.allocation)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Spent:</span>{' '}
                        <span className="font-semibold text-slate-800">
                          {money(spent)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Remaining:</span>{' '}
                        <span
                          className={`font-semibold ${
                            remaining < 0
                              ? 'text-rose-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {money(remaining)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Task Progress:</span>{' '}
                        <span className="font-semibold text-indigo-600">
                          {pct}% ({s.tasks.filter((t) => t.status === 'COMPLETED').length}/{s.tasks.length})
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
