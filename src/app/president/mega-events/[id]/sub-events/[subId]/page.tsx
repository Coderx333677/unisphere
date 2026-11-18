import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { fmtPKT, fmtDateOnlyPKT, toInputPKT } from '@/lib/time'
import { money, TaskBadge } from '@/components/badges'
import Alerts from '@/components/Alerts'
import {
  createSubEventTaskAction,
  assignSubEventTaskAction,
  recordSubEventExpenseAction,
  assignSupervisorAction,
  setInitialAllocationAction,
  updateSubEventTaskStatusAction,
} from '@/app/actions/mega-events'
import { calculateSubEventProgress } from '@/lib/mega-events'

export const dynamic = 'force-dynamic'

export default async function PresidentSubEventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; subId: string }
  searchParams: { error?: string; ok?: string }
}) {
  const user = await requireUser('PRESIDENT').catch(() => null)
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/president/mega-events/${params.id}/sub-events/${params.subId}`
      )}`
    )
  }

  const subEvent = await db.subEvent.findUnique({
    where: { id: params.subId },
    include: {
      megaEvent: {
        include: {
          society: true,
          subEvents: { select: { id: true, allocation: true } },
        },
      },
      supervisor: { select: { id: true, name: true, email: true } },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueDate: 'asc' },
      },
      expenses: {
        orderBy: { spentOn: 'desc' },
      },
    },
  })

  // Enforce ownership: president of the Mega Event
  if (
    !subEvent ||
    subEvent.megaEventId !== params.id ||
    subEvent.megaEvent.presidentId !== user.id
  ) {
    notFound()
  }

  const allStudents = await db.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  const spent = subEvent.expenses.reduce((s, e) => s + e.amount, 0)
  const remaining = subEvent.allocation - spent
  const isOver80 =
    subEvent.allocation > 0 && spent >= subEvent.allocation * 0.8
  const taskProgress = calculateSubEventProgress(subEvent.tasks)

  const currentMegaEventAllocTotal = subEvent.megaEvent.subEvents.reduce(
    (acc, s) => acc + s.allocation,
    0
  )
  const availableMegaEventBudget =
    subEvent.megaEvent.overallBudget - currentMegaEventAllocTotal

  const backUrl = `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEvent.id}`

  return (
    <div className="container-app">
      {/* Header Breadcrumbs */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/president/mega-events/${subEvent.megaEventId}`}
              className="text-xs font-semibold uppercase tracking-wider text-indigo-600 hover:underline"
            >
              ← {subEvent.megaEvent.title}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">
              Sub-Event
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900">
              {subEvent.title}
            </h1>
            {isOver80 && (
              <span className="badge badge-rose text-xs">
                ⚠️ 80%+ Budget Threshold Reached
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            📍 {subEvent.venue} · 🕒 {fmtPKT(subEvent.startsAt)} to{' '}
            {fmtPKT(subEvent.endsAt)}
          </p>
        </div>

        <Link
          href={`/president/mega-events/${subEvent.megaEventId}`}
          className="btn btn-secondary"
        >
          Back to Mega Event
        </Link>
      </div>

      <Alerts searchParams={searchParams} />

      {/* Threshold Alert Banner if spending >= 80% */}
      {isOver80 && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">
                Budget Alert: 80% Allocation Threshold Reached
              </p>
              <p className="mt-0.5 text-xs text-rose-700">
                Spending has reached PKR {spent.toLocaleString()} (
                {Math.round((spent / subEvent.allocation) * 100)}% of the PKR{' '}
                {subEvent.allocation.toLocaleString()} allocation). An automated
                in-app notification has been logged for this sub-event.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sub-Event Allocation
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {money(subEvent.allocation)}
          </p>
          <p className="text-xs text-slate-400">
            {subEvent.allocation === 0
              ? 'Unallocated (set below)'
              : 'Fixed allocation'}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Amount Spent
          </p>
          <p className="mt-1 text-2xl font-black text-rose-600">
            {money(spent)}
          </p>
          <p className="text-xs text-slate-400">
            {subEvent.expenses.length} recorded expense(s)
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Remaining Balance
          </p>
          <p
            className={`mt-1 text-2xl font-black ${
              remaining < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {money(remaining)}
          </p>
          <p className="text-xs text-slate-400">
            {subEvent.allocation > 0
              ? `${Math.round((remaining / subEvent.allocation) * 100)}% left`
              : '—'}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Task Progress
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">
              {taskProgress}%
            </span>
            <span className="text-xs text-slate-400">
              ({subEvent.tasks.filter((t) => t.status === 'COMPLETED').length}/
              {subEvent.tasks.length} tasks)
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-indigo-600"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Supervisor Assignment & Initial Allocation (if unallocated) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Supervisor Box */}
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
            Sub-Event Supervisor
          </h2>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div>
              <p className="font-bold text-slate-800">
                {subEvent.supervisor.name}
              </p>
              <p className="text-xs text-slate-500">
                {subEvent.supervisor.email} · Role: Student / Volunteer
              </p>
            </div>
            <span className="badge badge-emerald">Active Supervisor</span>
          </div>

          <form action={assignSupervisorAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="subEventId" value={subEvent.id} />
            <select
              name="supervisorId"
              defaultValue={subEvent.supervisorId}
              required
              className="input-app text-xs"
            >
              {allStudents.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.email})
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-sm whitespace-nowrap">
              Reassign Supervisor
            </button>
          </form>
          <p className="mt-1 text-[11px] text-slate-400">
            When reassigned, supervision permissions immediately transfer to the new student.
          </p>
        </div>

        {/* Initial Allocation Form if 0 */}
        {subEvent.allocation === 0 ? (
          <div className="card border-l-4 border-l-amber-500">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Set Initial Allocation
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This sub-event has no budget allocation. Set an initial allocation from the remaining Mega Event budget pool (Available: {money(availableMegaEventBudget)}).
            </p>
            <form action={setInitialAllocationAction} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="subEventId" value={subEvent.id} />
              <input
                name="allocation"
                type="number"
                min="1"
                max={availableMegaEventBudget}
                step="1"
                placeholder="Amount (PKR)"
                required
                className="input-app text-xs"
              />
              <button type="submit" className="btn btn-primary btn-sm whitespace-nowrap">
                Set Allocation
              </button>
            </form>
          </div>
        ) : (
          <div className="card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Budget Status & Rules
            </h2>
            <p className="mt-2 text-xs text-slate-600">
              Initial allocation of <strong>{money(subEvent.allocation)}</strong> is immutable. All recorded expenses are validated against this ceiling. An automatic alert triggers at 80% utilization.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400">80% Trigger Point:</span>{' '}
                <span className="font-semibold text-slate-700">
                  {money(Math.round(subEvent.allocation * 0.8))}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Notification Sent:</span>{' '}
                <span className="font-semibold text-slate-700">
                  {subEvent.thresholdNotified ? 'Yes (Logged)' : 'Not yet'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Section: Left = Tasks & Checklist, Right = Budget & Expenses (Visible ONLY to President) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Task Management & Checklist Panel */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Preparation Tasks ({subEvent.tasks.length})
              </h2>
              <p className="text-xs text-slate-500">
                Checklist managed by President and Sub-Event Supervisor.
              </p>
            </div>
          </div>

          {/* Add Task Form */}
          <details className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-indigo-700">
              + Add Preparation Task
            </summary>
            <form action={createSubEventTaskAction} className="mt-3 space-y-3">
              <input type="hidden" name="subEventId" value={subEvent.id} />
              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Task Title
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Set up networking switches & cables"
                  className="input-app mt-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={2}
                  required
                  placeholder="Task instructions and checklist items..."
                  className="input-app mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Priority
                  </label>
                  <select name="priority" required className="input-app mt-1 text-xs">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM" selected>Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Due Date (PKT)
                  </label>
                  <input
                    name="dueDate"
                    type="datetime-local"
                    required
                    className="input-app mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600">
                  Assignee (Optional registered student)
                </label>
                <select name="assigneeId" className="input-app mt-1 text-xs">
                  <option value="">Unassigned (Open task)</option>
                  {allStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary btn-sm">
                Create Task
              </button>
            </form>
          </details>

          {/* Task Checklist Items */}
          {subEvent.tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              No tasks added yet. Add tasks above to track sub-event preparation.
            </div>
          ) : (
            <ul className="space-y-3">
              {subEvent.tasks.map((t) => {
                const isCompleted = t.status === 'COMPLETED'
                const isInProgress = t.status === 'IN_PROGRESS'

                return (
                  <li
                    key={t.id}
                    className={`rounded-lg border p-3 text-xs transition-colors ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {/* Checklist indicator */}
                        <div className="mt-0.5">
                          {isCompleted ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-600 text-[10px] text-white">
                              ✓
                            </span>
                          ) : isInProgress ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded border border-indigo-500 bg-indigo-50 text-[10px] text-indigo-700">
                              ◐
                            </span>
                          ) : (
                            <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-slate-50 text-[10px] text-slate-400">
                              ○
                            </span>
                          )}
                        </div>

                        <div>
                          <p
                            className={`font-semibold ${
                              isCompleted
                                ? 'text-slate-500 line-through'
                                : 'text-slate-900'
                            }`}
                          >
                            {t.title}
                          </p>
                          <p className="mt-0.5 text-slate-500">{t.description}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Due {fmtPKT(t.dueDate)} · Assignee:{' '}
                            <span className="font-medium text-slate-700">
                              {t.assignee?.name || 'Unassigned'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <TaskBadge s={t.status} />
                        <span
                          className={`badge text-[10px] ${
                            t.priority === 'HIGH'
                              ? 'badge-rose'
                              : t.priority === 'MEDIUM'
                              ? 'badge-amber'
                              : 'badge-slate'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    </div>

                    {/* Status Toggle & Reassignment Buttons */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-1">
                        {(['TODO', 'IN_PROGRESS', 'COMPLETED'] as const)
                          .filter((s) => s !== t.status)
                          .map((s) => (
                            <form
                              key={s}
                              action={updateSubEventTaskStatusAction}
                              className="inline"
                            >
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="status" value={s} />
                              <input type="hidden" name="back" value={backUrl} />
                              <button
                                type="submit"
                                className="btn btn-secondary btn-sm text-[10px] py-0.5 px-2"
                              >
                                → {s === 'TODO' ? 'To Do' : s === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                              </button>
                            </form>
                          ))}
                      </div>

                      {/* Quick Assign Dropdown */}
                      <form
                        action={assignSubEventTaskAction}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="taskId" value={t.id} />
                        <select
                          name="assigneeId"
                          defaultValue={t.assigneeId || ''}
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700"
                        >
                          <option value="">Unassigned</option>
                          {allStudents.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="btn btn-secondary btn-sm text-[10px] py-0.5 px-2"
                        >
                          Assign
                        </button>
                      </form>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Budget & Expenses Panel (Visible ONLY to President) */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Expenses & Budget Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Visible only to Society President · Sub-event ceiling: {money(subEvent.allocation)}
              </p>
            </div>
          </div>

          {/* Record Expense Form */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Record New Expense
            </h3>
            {subEvent.allocation <= 0 ? (
              <p className="mt-2 text-xs text-amber-700">
                Set an initial budget allocation above before recording expenses.
              </p>
            ) : remaining <= 0 ? (
              <p className="mt-2 text-xs text-rose-700 font-semibold">
                Allocation fully spent. No further expenses can be recorded.
              </p>
            ) : (
              <form action={recordSubEventExpenseAction} className="mt-3 space-y-3">
                <input type="hidden" name="subEventId" value={subEvent.id} />

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Expense Title / Item
                  </label>
                  <input
                    name="title"
                    type="text"
                    required
                    placeholder="e.g. Stage Sound System & Mics"
                    className="input-app mt-1 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Amount (PKR)
                    </label>
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      max={remaining}
                      step="1"
                      required
                      placeholder={`Max ${remaining}`}
                      className="input-app mt-1 text-xs"
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Max available: {money(remaining)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Note / Vendor (Optional)
                    </label>
                    <input
                      name="note"
                      type="text"
                      placeholder="e.g. Invoice #4021"
                      className="input-app mt-1 text-xs"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-sm">
                  Record Expense
                </button>
              </form>
            )}
          </div>

          {/* Expense Ledger Table */}
          {subEvent.expenses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              No expenses recorded yet. Use the form above to record expenses.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-app text-xs">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {subEvent.expenses.map((ex) => (
                    <tr key={ex.id}>
                      <td className="font-semibold text-slate-800">
                        {ex.title}
                      </td>
                      <td className="text-slate-500">{fmtPKT(ex.spentOn)}</td>
                      <td className="font-bold text-slate-900">
                        {money(ex.amount)}
                      </td>
                      <td className="text-slate-500">{ex.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
