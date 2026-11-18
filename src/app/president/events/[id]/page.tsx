import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT, toInputPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import {
  updateEventAction,
  submitEventAction,
  cancelEventAction,
  inviteAction,
  createTaskAction,
  updateTaskStatusAction,
  assignTaskAction,
  addExpenseAction,
  editExpenseAction,
  deleteExpenseAction,
} from '@/app/actions/events'
import {
  ApprovalBadge,
  ScheduleBadge,
  TaskBadge,
  InviteBadge,
  RegBadge,
  money,
} from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

const backPath = (id: string) => `/president/events/${id}`

export default async function PresidentEventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'PRESIDENT')
    redirect(`/login?next=${encodeURIComponent(`/president/events/${params.id}`)}`)

  const ev = await db.event.findUnique({
    where: { id: params.id },
    include: {
      society: {
        include: {
          memberships: {
            where: { status: 'APPROVED' },
            include: { student: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      registrations: {
        include: { student: { select: { name: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
      },
      invitations: {
        include: { student: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      tasks: {
        include: { assignee: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      expenses: { orderBy: { spentOn: 'desc' } },
    },
  })
  if (!ev || ev.society.presidentId !== user.id) notFound()

  const now = new Date()
  const pct = R.progress(ev.tasks)
  const spent = ev.expenses.reduce((s, x) => s + x.amount, 0)
  const remaining =
    ev.approvedBudget !== null ? ev.approvedBudget - spent : null

  const invitedIds = new Set(ev.invitations.map((i) => i.studentId))
  const memberIds = new Set(ev.society.memberships.map((m) => m.student.id))
  const allStudents = await db.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  const suggested = allStudents.filter(
    (s) => memberIds.has(s.id) && !invitedIds.has(s.id)
  )
  const others = allStudents.filter(
    (s) => !memberIds.has(s.id) && !invitedIds.has(s.id)
  )
  const accepted = ev.invitations.filter((i) => i.status === 'ACCEPTED')

  const canEdit = R.canEdit(ev, now)
  const canSubmit = R.canSubmit(ev, now)
  const canCancel = R.canCancel(ev, now)
  const canInvite = R.canInvite(ev, now)
  const canAddExpense = R.canAddExpense(ev)
  const canCreateTask = R.canCreateTask(ev)

  const columns: { key: string; label: string }[] = [
    { key: 'TODO', label: 'To Do' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED', label: 'Completed' },
  ]

  return (
    <div className="container-app">
      <Alerts searchParams={searchParams} />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ApprovalBadge s={ev.approvalStatus} />
            <ScheduleBadge s={R.schedule(ev, now)} />
            {ev.cancelled && <span className="badge badge-rose">CANCELLED</span>}
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-900">{ev.title}</h1>
          <p className="text-sm text-slate-500">
            {ev.society.name} · {fmtPKT(ev.startAt)} → {fmtPKT(ev.endAt)} ·{' '}
            {ev.venue}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/president/events" className="btn btn-secondary btn-sm">
            All events
          </Link>
          {canSubmit && (
            <form action={submitEventAction}>
              <input type="hidden" name="eventId" value={ev.id} />
              <button className="btn btn-primary btn-sm" type="submit">
                Submit for approval
              </button>
            </form>
          )}
          {canCancel && !ev.cancelled && (
            <form action={cancelEventAction}>
              <input type="hidden" name="eventId" value={ev.id} />
              <button className="btn btn-danger btn-sm" type="submit">
                Cancel event
              </button>
            </form>
          )}
        </div>
      </div>

      {ev.decidedAt && (
        <div
          className={`alert ${ev.approvalStatus === 'APPROVED' ? 'alert-ok' : ev.approvalStatus === 'REJECTED' ? 'alert-error' : 'alert-error'}`}
        >
          <strong>
            Administrator decision: {ev.approvalStatus}
          </strong>{' '}
          on {fmtPKT(ev.decidedAt)}.
          {ev.adminRemarks && <> Remarks: “{ev.adminRemarks}”</>}
          {ev.approvedBudget !== null && (
            <> · Budget in force: {money(ev.approvedBudget)}</>
          )}
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Registrations
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {ev.regCount}
            <span className="text-sm font-medium text-slate-400">
              /{ev.capacity}
            </span>
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Task progress
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{pct}%</p>
          <p className="text-xs text-slate-400">
            {ev.tasks.filter((t) => t.status === 'COMPLETED').length}/
            {ev.tasks.length} completed
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Budget
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {ev.approvedBudget !== null ? money(ev.approvedBudget) : '—'}
          </p>
          <p className="text-xs text-slate-400">
            proposed {money(ev.proposedBudget)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Spent / remaining
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {money(spent)}
          </p>
          <p
            className={`text-xs ${remaining !== null && remaining < 0 ? 'font-semibold text-rose-600' : 'text-slate-400'}`}
          >
            {remaining === null
              ? 'no approved budget yet'
              : remaining < 0
                ? `over budget by ${money(-remaining)}`
                : `${money(remaining)} remaining`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* EDIT */}
        {canEdit && (
          <details className="card" open={ev.approvalStatus === 'DRAFT'}>
            <summary className="cursor-pointer font-bold text-slate-900">
              Edit event
              {ev.approvalStatus === 'APPROVED' && (
                <span className="ml-2 text-xs font-normal text-amber-600">
                  (saving sends an approved event back to Pending — budget stays
                  in force)
                </span>
              )}
            </summary>
            <form action={updateEventAction} className="mt-4 space-y-3">
              <input type="hidden" name="eventId" value={ev.id} />
              <div>
                <label className="label">Title</label>
                <input
                  name="title"
                  className="input"
                  required
                  minLength={3}
                  defaultValue={ev.title}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  name="description"
                  className="input min-h-24"
                  required
                  minLength={10}
                  defaultValue={ev.description}
                />
              </div>
              <div>
                <label className="label">Venue</label>
                <input
                  name="venue"
                  className="input"
                  required
                  defaultValue={ev.venue}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Start (PKT)</label>
                  <input
                    name="startAt"
                    type="datetime-local"
                    className="input"
                    required
                    defaultValue={toInputPKT(ev.startAt)}
                  />
                </div>
                <div>
                  <label className="label">End (PKT)</label>
                  <input
                    name="endAt"
                    type="datetime-local"
                    className="input"
                    required
                    defaultValue={toInputPKT(ev.endAt)}
                  />
                </div>
                <div>
                  <label className="label">Deadline (PKT)</label>
                  <input
                    name="regDeadline"
                    type="datetime-local"
                    className="input"
                    required
                    defaultValue={toInputPKT(ev.regDeadline)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Capacity</label>
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    className="input"
                    required
                    defaultValue={ev.capacity}
                  />
                </div>
                <div>
                  <label className="label">Proposed budget (PKR)</label>
                  <input
                    name="proposedBudget"
                    type="number"
                    min={0}
                    className="input"
                    required
                    defaultValue={ev.proposedBudget}
                  />
                </div>
              </div>
              <button className="btn btn-primary" type="submit">
                Save changes
              </button>
            </form>
          </details>
        )}

        {/* VOLUNTEERS */}
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">
              Volunteers ({ev.invitations.length})
            </h2>
            {!canInvite && (
              <span className="text-xs text-slate-400">
                new invitations closed
              </span>
            )}
          </div>

          {canInvite ? (
            <form action={inviteAction} className="mt-3 space-y-2">
              <input type="hidden" name="eventId" value={ev.id} />
              <label className="label">Invite a student</label>
              <select name="studentId" className="input" required defaultValue="">
                <option value="" disabled>
                  Choose a student…
                </option>
                {suggested.length > 0 && (
                  <optgroup label="Suggested — society members">
                    {suggested.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All students">
                  {others.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </optgroup>
              </select>
              <button className="btn btn-primary btn-sm" type="submit">
                Send invitation
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Invitations are only allowed for approved events that have not
              started.
            </p>
          )}

          <ul className="mt-3 divide-y divide-slate-100">
            {ev.invitations.length === 0 && (
              <li className="py-2 text-sm text-slate-400">
                No invitations yet.
              </li>
            )}
            {ev.invitations.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-700">
                    {i.student.name}
                  </p>
                  <p className="text-xs text-slate-400">{i.student.email}</p>
                </div>
                <InviteBadge s={i.status} />
              </li>
            ))}
          </ul>
        </div>

        {/* EXPENSES */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-900">Expenses</h2>
              <a
                href={`/api/events/${ev.id}/report`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm text-xs"
                download
              >
                📄 Download PDF Report
              </a>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>
                approved{' '}
                <strong>
                  {ev.approvedBudget !== null ? money(ev.approvedBudget) : '—'}
                </strong>
              </div>
              <div>
                spent <strong>{money(spent)}</strong>
              </div>
              <div
                className={
                  remaining !== null && remaining < 0
                    ? 'font-semibold text-rose-600'
                    : ''
                }
              >
                remaining{' '}
                <strong>
                  {remaining !== null ? money(remaining) : '—'}
                </strong>
                {remaining !== null && remaining < 0 && (
                  <span className="badge badge-rose ml-1">Over budget</span>
                )}
              </div>
            </div>
          </div>

          {canAddExpense ? (
            <form action={addExpenseAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="eventId" value={ev.id} />
              <input
                name="title"
                className="input w-40 flex-1"
                placeholder="Expense title"
                required
              />
              <input
                name="amount"
                type="number"
                min={1}
                className="input w-28"
                placeholder="Amount"
                required
              />
              <input
                name="note"
                className="input w-40 flex-1"
                placeholder="Note (optional)"
              />
              <button className="btn btn-primary btn-sm" type="submit">
                Add
              </button>
            </form>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Expenses can only be recorded while the event (and its budget) is
              Approved — not while Draft, Pending, Rejected or Cancelled.
            </p>
          )}

          <ul className="mt-3 divide-y divide-slate-100">
            {ev.expenses.length === 0 && (
              <li className="py-2 text-sm text-slate-400">No expenses yet.</li>
            )}
            {ev.expenses.map((x) => (
              <li key={x.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {x.title}
                      {x.note && (
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          — {x.note}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {money(x.amount)}
                    </span>
                  </summary>
                  <form
                    action={editExpenseAction}
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="expenseId" value={x.id} />
                    <input
                      name="title"
                      className="input w-40 flex-1"
                      defaultValue={x.title}
                      required
                    />
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      className="input w-28"
                      defaultValue={x.amount}
                      required
                    />
                    <input
                      name="note"
                      className="input w-32 flex-1"
                      defaultValue={x.note ?? ''}
                    />
                    <button className="btn btn-secondary btn-sm" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteExpenseAction} className="mt-1.5">
                    <input type="hidden" name="expenseId" value={x.id} />
                    <button
                      className="btn btn-danger btn-sm"
                      type="submit"
                    >
                      Delete
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </div>

        {/* REGISTRATIONS */}
        <div className="card">
          <h2 className="font-bold text-slate-900">
            Registrations ({ev.regCount}/{ev.capacity})
          </h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {ev.registrations.length === 0 && (
              <li className="py-2 text-sm text-slate-400">
                No registrations yet.
              </li>
            )}
            {ev.registrations.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-700">
                    {r.student.name}
                  </p>
                  <p className="text-xs text-slate-400">{r.student.email}</p>
                </div>
                <RegBadge s={r.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* TASKS */}
      <div className="card mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">
            Task board · {pct}% complete
          </h2>
          {!canCreateTask && (
            <span className="text-xs text-slate-400">
              tasks frozen — event cancelled
            </span>
          )}
        </div>

        {canCreateTask && (
          <form action={createTaskAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="eventId" value={ev.id} />
            <input
              name="title"
              className="input w-44 flex-1"
              placeholder="Task title"
              required
            />
            <input
              name="description"
              className="input w-44 flex-1"
              placeholder="Description"
              required
            />
            <select name="priority" className="input w-32" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            <input
              name="dueDate"
              type="date"
              className="input w-40"
              required
            />
            <select name="assigneeId" className="input w-48" defaultValue="">
              <option value="">No assignee (yet)</option>
              {accepted.map((i) => (
                <option key={i.studentId} value={i.studentId}>
                  {i.student.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" type="submit">
              Add task
            </button>
          </form>
        )}
        {accepted.length === 0 && canCreateTask && (
          <p className="mt-2 text-xs text-slate-400">
            Assignable volunteers: only students who accepted a volunteer
            invitation ({accepted.length} currently).
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {columns.map((col) => {
            const items = ev.tasks.filter((t) => t.status === col.key)
            return (
              <div key={col.key} className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {col.label}
                  </span>
                  <span className="badge badge-slate">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="text-xs text-slate-400">Empty</p>
                  )}
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
                    >
                      <p className="font-semibold text-slate-800">{t.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span
                          className={`badge ${t.priority === 'HIGH' ? 'badge-rose' : t.priority === 'MEDIUM' ? 'badge-amber' : 'badge-slate'}`}
                        >
                          {t.priority}
                        </span>
                        <span>due {fmtPKT(t.dueDate)}</span>
                        <TaskBadge s={t.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {t.assignee ? `→ ${t.assignee.name}` : '→ unassigned'}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {columns
                          .filter((c) => c.key !== t.status)
                          .map((c) => (
                            <form
                              key={c.key}
                              action={updateTaskStatusAction}
                              className="inline"
                            >
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="status" value={c.key} />
                              <input
                                type="hidden"
                                name="back"
                                value={backPath(ev.id)}
                              />
                              <button
                                className="btn btn-secondary btn-sm"
                                type="submit"
                              >
                                → {c.label}
                              </button>
                            </form>
                          ))}
                      </div>

                      <form
                        action={assignTaskAction}
                        className="mt-2 flex gap-1.5"
                      >
                        <input type="hidden" name="taskId" value={t.id} />
                        <select
                          name="assigneeId"
                          className="input flex-1 py-1 text-xs"
                          defaultValue={t.assigneeId ?? ''}
                        >
                          <option value="">Unassigned</option>
                          {accepted.map((i) => (
                            <option key={i.studentId} value={i.studentId}>
                              {i.student.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-secondary btn-sm" type="submit">
                          Assign
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
