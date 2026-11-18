import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import {
  cancelRegistrationAction,
  respondInvitationAction,
  updateTaskStatusAction,
  withdrawVolunteerAction,
} from '@/app/actions/events'
import { requestJoinAction } from '@/app/actions/societies'
import {
  MembershipBadge,
  InviteBadge,
  TaskBadge,
  ScheduleBadge,
} from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function StudentPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'STUDENT') redirect('/login?next=/student')

  const now = new Date()
  const [registrations, memberships, invitations, tasks] = await Promise.all([
    db.registration.findMany({
      where: { studentId: user.id },
      include: {
        event: {
          include: { society: { select: { name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.membership.findMany({
      where: { studentId: user.id },
      include: { society: { select: { name: true, id: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    db.invitation.findMany({
      where: { studentId: user.id },
      include: {
        event: {
          include: { society: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.task.findMany({
      where: { assigneeId: user.id },
      include: { event: { select: { title: true, id: true } } },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  const activeRegs = registrations.filter((r) => r.status === 'REGISTERED')
  const pastRegs = registrations.filter((r) => r.status !== 'REGISTERED')

  const approvedSocietyIds = memberships
    .filter((m) => m.status === 'APPROVED')
    .map((m) => m.society.id)

  const meetings =
    approvedSocietyIds.length > 0
      ? await db.meeting.findMany({
          where: { societyId: { in: approvedSocietyIds } },
          include: { society: { select: { name: true } } },
          orderBy: { startAt: 'asc' },
        })
      : []

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            My space, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-500">
            Registrations, memberships, volunteer invitations and assigned
            tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/societies" className="btn btn-secondary">
            Browse societies
          </Link>
          <Link href="/" className="btn btn-secondary">
            Events
          </Link>
        </div>
      </div>
      <Alerts searchParams={searchParams} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-bold text-slate-900">
            My registrations ({activeRegs.length})
          </h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {activeRegs.length === 0 && (
              <li className="py-3 text-sm text-slate-500">
                You have no active registrations.{' '}
                <Link href="/" className="text-indigo-600 hover:underline">
                  Find an event
                </Link>
                .
              </li>
            )}
            {activeRegs.map((r) => {
              const canCancel = R.canCancelRegistration(r.event, now)
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <Link
                      href={`/events/${r.eventId}`}
                      className="font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {r.event.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {r.event.society.name} · {fmtPKT(r.event.startAt)} ·{' '}
                      {r.event.venue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScheduleBadge s={R.schedule(r.event, now)} />
                    {canCancel && (
                      <form action={cancelRegistrationAction}>
                        <input type="hidden" name="eventId" value={r.eventId} />
                        <button
                          className="btn btn-secondary btn-sm"
                          type="submit"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {pastRegs.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400">
                Cancelled registrations ({pastRegs.length})
              </summary>
              <ul className="mt-1.5 space-y-1">
                {pastRegs.map((r) => (
                  <li key={r.id} className="text-xs text-slate-500">
                    {r.event.title} — cancelled
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-900">Volunteer invitations</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {invitations.length === 0 && (
              <li className="py-3 text-sm text-slate-500">
                No invitations yet. Accept one to receive task assignments.
              </li>
            )}
            {invitations.map((i) => (
              <li key={i.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/events/${i.eventId}`}
                      className="font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {i.event.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {i.event.society.name} · invited{' '}
                      {fmtPKT(i.createdAt)}
                    </p>
                  </div>
                  <InviteBadge s={i.status} />
                </div>
                {i.status === 'PENDING' && (
                  <div className="mt-2 flex gap-2">
                    <form action={respondInvitationAction}>
                      <input type="hidden" name="invitationId" value={i.id} />
                      <input type="hidden" name="decision" value="ACCEPTED" />
                      <button className="btn btn-success btn-sm" type="submit">
                        Accept
                      </button>
                    </form>
                    <form action={respondInvitationAction}>
                      <input type="hidden" name="invitationId" value={i.id} />
                      <input type="hidden" name="decision" value="DECLINED" />
                      <button className="btn btn-danger btn-sm" type="submit">
                        Decline
                      </button>
                    </form>
                  </div>
                )}
                {i.status === 'ACCEPTED' && (
                  <div className="mt-2">
                    <form action={withdrawVolunteerAction}>
                      <input type="hidden" name="invitationId" value={i.id} />
                      <button className="btn btn-secondary btn-sm" type="submit">
                        Withdraw from volunteering
                      </button>
                    </form>
                  </div>
                )}
                {i.status === 'DECLINED' && (
                  <p className="mt-1 text-xs text-slate-400">
                    Your response is final — declined invitations cannot be
                    accepted later.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-900">
            My memberships ({memberships.length})
          </h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {memberships.length === 0 && (
              <li className="py-3 text-sm text-slate-500">
                You have not joined any society yet.{' '}
                <Link href="/societies" className="text-indigo-600 hover:underline">
                  Browse societies
                </Link>
                .
              </li>
            )}
            {memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <Link
                    href={`/societies/${m.societyId}`}
                    className="font-medium text-slate-800 hover:text-indigo-600"
                  >
                    {m.society.name}
                  </Link>
                  {m.label === 'CORE_MEMBER' && (
                    <span className="badge badge-violet ml-1.5">Core</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MembershipBadge s={m.status} />
                  {(m.status === 'REJECTED' || m.status === 'REMOVED') && (
                    <form action={requestJoinAction}>
                      <input type="hidden" name="societyId" value={m.societyId} />
                      <button className="btn btn-secondary btn-sm" type="submit">
                        Request again
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-900">
            Society Meetings ({meetings.length})
          </h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {meetings.length === 0 && (
              <li className="py-3 text-sm text-slate-500">
                No meetings scheduled for your joined societies.
              </li>
            )}
            {meetings.map((m) => (
              <li key={m.id} className="py-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{m.title}</p>
                    <p className="text-xs text-slate-500">
                      {m.society.name} · 🕒 {fmtPKT(m.startAt)} · 📍 {m.location}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      <strong>Agenda:</strong> {m.agenda}
                    </p>
                  </div>
                  {m.cancelled ? (
                    <span className="badge badge-rose">Cancelled</span>
                  ) : (
                    <span className="badge badge-emerald">Scheduled</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-900">
            My tasks ({tasks.length})
          </h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {tasks.length === 0 && (
              <li className="py-3 text-sm text-slate-500">
                No tasks assigned to you yet.
              </li>
            )}
            {tasks.map((t) => (
              <li key={t.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      <Link
                        href={`/events/${t.eventId}`}
                        className="hover:text-indigo-600"
                      >
                        {t.event.title}
                      </Link>{' '}
                      · due {fmtPKT(t.dueDate)}
                    </p>
                  </div>
                  <TaskBadge s={t.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(['TODO', 'IN_PROGRESS', 'COMPLETED'] as const)
                    .filter((s) => s !== t.status)
                    .map((s) => (
                      <form key={s} action={updateTaskStatusAction} className="inline">
                        <input type="hidden" name="taskId" value={t.id} />
                        <input type="hidden" name="status" value={s} />
                        <input type="hidden" name="back" value="/student" />
                        <button className="btn btn-secondary btn-sm" type="submit">
                          → {s.replace('_', ' ')}
                        </button>
                      </form>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
