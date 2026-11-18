import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtDateOnlyPKT, fmtPKT } from '@/lib/time'
import { money } from '@/components/badges'
import Alerts from '@/components/Alerts'
import { updateMegaEventTitleDescriptionAction } from '@/app/actions/mega-events'
import { calculateSubEventProgress } from '@/lib/mega-events'

export const dynamic = 'force-dynamic'

export default async function AdminMegaEventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    redirect(`/login?next=/admin/mega-events/${params.id}`)
  }

  const megaEvent = await db.megaEvent.findUnique({
    where: { id: params.id },
    include: {
      society: {
        select: { id: true, name: true, category: true },
      },
      president: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
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

  // Enforce visibility rule: Creator admin sees only records where createdById = their user ID
  if (!megaEvent || megaEvent.createdById !== user.id) {
    notFound()
  }

  const totalAllocated = megaEvent.subEvents.reduce(
    (sum, s) => sum + s.allocation,
    0
  )
  const availableAllocation = megaEvent.overallBudget - totalAllocated
  const totalSpent = megaEvent.subEvents.reduce(
    (sum, s) => sum + s.expenses.reduce((es, e) => es + e.amount, 0),
    0
  )

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/mega-events"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
            >
              ← Mega Events
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">Details</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            {megaEvent.title}
          </h1>
          <p className="text-sm text-slate-500">
            Hosted by {megaEvent.society.name} · Assigned to President {megaEvent.president.name}
          </p>
        </div>
        <Link href="/admin/mega-events" className="btn btn-secondary">
          Back to Mega Events
        </Link>
      </div>

      <Alerts searchParams={searchParams} />

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Overall Budget
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {money(megaEvent.overallBudget)}
          </p>
          <p className="text-xs text-slate-400">Fixed at creation</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Total Allocated
          </p>
          <p className="mt-1 text-2xl font-black text-indigo-600">
            {money(totalAllocated)}
          </p>
          <p className="text-xs text-slate-400">
            {megaEvent.subEvents.length} sub-events
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
          <p className="text-xs text-slate-400">Remaining unallocated</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sub-Events Spending
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {money(totalSpent)}
          </p>
          <p className="text-xs text-slate-400">Recorded by president</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Edit Title & Description Form (Locked fields are read-only) */}
        <div className="card lg:col-span-1">
          <h2 className="mb-1 text-lg font-bold text-slate-900">
            Mega Event Settings
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Only title and description may be modified. All structural fields are locked.
          </p>

          <form action={updateMegaEventTitleDescriptionAction} className="space-y-4">
            <input type="hidden" name="id" value={megaEvent.id} />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Title (Editable)
              </label>
              <input
                name="title"
                type="text"
                defaultValue={megaEvent.title}
                required
                className="input-app mt-1 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Description (Editable)
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={megaEvent.description}
                required
                className="input-app mt-1"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
              <p className="font-bold uppercase tracking-wider text-slate-500">
                🔒 Locked Structural Metadata
              </p>
              <div>
                <span className="text-slate-400">Host Society:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {megaEvent.society.name}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Assigned President:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {megaEvent.president.name} ({megaEvent.president.email})
                </span>
              </div>
              <div>
                <span className="text-slate-400">Date Range:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {fmtDateOnlyPKT(megaEvent.startDate)} –{' '}
                  {fmtDateOnlyPKT(megaEvent.endDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Overall Budget:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {money(megaEvent.overallBudget)}
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full">
              Save Changes
            </button>
          </form>
        </div>

        {/* Right: Sub-events list */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Sub-Events ({megaEvent.subEvents.length})
            </h2>
            <span className="text-xs text-slate-400">
              Managed by Society President
            </span>
          </div>

          {megaEvent.subEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No sub-events created yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                President {megaEvent.president.name} will create and supervise
                sub-events under this Mega Event.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-app">
                <thead>
                  <tr>
                    <th>Sub-Event</th>
                    <th>Supervisor</th>
                    <th>Date & Time (PKT)</th>
                    <th>Progress</th>
                    <th>Budget Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {megaEvent.subEvents.map((s) => {
                    const pct = calculateSubEventProgress(s.tasks)
                    const spent = s.expenses.reduce(
                      (acc, e) => acc + e.amount,
                      0
                    )
                    return (
                      <tr key={s.id}>
                        <td>
                          <p className="font-bold text-slate-800">{s.title}</p>
                          <p className="text-xs text-slate-400">📍 {s.venue}</p>
                        </td>
                        <td>
                          <p className="font-medium text-slate-700">
                            {s.supervisor.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {s.supervisor.email}
                          </p>
                        </td>
                        <td className="text-xs text-slate-600">
                          {fmtPKT(s.startsAt)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              {pct}%
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {s.tasks.length} tasks
                          </span>
                        </td>
                        <td>
                          <span className="text-xs font-medium text-slate-700">
                            {money(s.allocation)}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Spent: {money(spent)}
                          </p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
