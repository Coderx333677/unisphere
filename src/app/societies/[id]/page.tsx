import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import * as R from '@/lib/rules'
import { requestJoinAction } from '@/app/actions/societies'
import { MembershipBadge, ScheduleBadge } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function SocietyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/societies/${params.id}`)}`)

  const society = await db.society.findUnique({
    where: { id: params.id },
    include: {
      president: { select: { id: true, name: true, email: true } },
      memberships: {
        where: { status: 'APPROVED' },
        include: { student: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: { approvalStatus: 'APPROVED', cancelled: false },
        orderBy: { startAt: 'asc' },
      },
    },
  })
  if (!society) notFound()

  const myMembership =
    user.role === 'STUDENT'
      ? await db.membership.findUnique({
          where: {
            societyId_studentId: { societyId: society.id, studentId: user.id },
          },
        })
      : null

  const now = new Date()
  const listedEvents = society.events.filter((e) =>
    R.isPublicListed(e, now)
  )
  const isPresident = society.presidentId === user.id
  const canRequest =
    user.role === 'STUDENT' &&
    (!myMembership ||
      myMembership.status === 'REJECTED' ||
      myMembership.status === 'REMOVED')

  return (
    <div className="container-app">
      <Alerts searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                {society.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={society.logoUrl}
                    alt={society.name}
                    className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                  />
                )}
                <div>
                  <span className="badge badge-indigo">{society.category}</span>
                  <h1 className="mt-1 text-2xl font-black text-slate-900">
                    {society.name}
                  </h1>
                </div>
              </div>
                </h1>
              </div>
              {isPresident && (
                <Link href="/president/society" className="btn btn-secondary btn-sm">
                  Manage
                </Link>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">
              {society.description}
            </p>
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-400">President: </span>
                <span className="font-medium text-slate-700">
                  {society.president.name}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Contact: </span>
                <a
                  href={`mailto:${society.contactEmail}`}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  {society.contactEmail}
                </a>
              </div>
              {society.contactPhone && (
                <div>
                  <span className="text-slate-400">Phone: </span>
                  <span className="font-medium text-slate-700">
                    {society.contactPhone}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card mt-4">
            <h2 className="mb-3 font-bold text-slate-900">
              Upcoming public events
            </h2>
            {listedEvents.length === 0 ? (
              <p className="text-sm text-slate-500">
                No upcoming approved events yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {listedEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <Link
                        href={`/events/${e.id}`}
                        className="font-medium text-slate-800 hover:text-indigo-600"
                      >
                        {e.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {fmtPKT(e.startAt)} · {e.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScheduleBadge s={R.schedule(e, now)} />
                      <span className="text-xs text-slate-500">
                        {Math.max(0, e.capacity - e.regCount)} seats
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {user.role === 'STUDENT' && (
            <div className="card">
              <h2 className="font-bold text-slate-900">Membership</h2>
              {myMembership ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    Status: <MembershipBadge s={myMembership.status} />
                  </div>
                  {myMembership.status === 'PENDING' && (
                    <p className="text-xs text-slate-500">
                      Waiting for the president to decide.
                    </p>
                  )}
                  {myMembership.status === 'APPROVED' && (
                    <p className="text-xs text-slate-500">
                      You are a {myMembership.label.replace('_', ' ').toLowerCase()} of
                      this society.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Request to join and the president will approve or reject it.
                </p>
              )}
              {canRequest && (
                <form action={requestJoinAction} className="mt-3">
                  <input type="hidden" name="societyId" value={society.id} />
                  <button type="submit" className="btn btn-primary w-full">
                    Request to join
                  </button>
                </form>
              )}
              {(myMembership?.status === 'REJECTED' ||
                myMembership?.status === 'REMOVED') && (
                <p className="mt-2 text-xs text-slate-500">
                  You may send a new request after a rejection or removal.
                </p>
              )}
            </div>
          )}

          <div className="card">
            <h2 className="font-bold text-slate-900">
              Members ({society.memberships.length})
            </h2>
            <ul className="mt-2 space-y-1.5">
              {society.memberships.length === 0 && (
                <li className="text-sm text-slate-500">No approved members yet.</li>
              )}
              {society.memberships.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-slate-700">{m.student.name}</span>
                  {m.label === 'CORE_MEMBER' && (
                    <span className="badge badge-violet">Core</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
