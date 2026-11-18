import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import { markAllReadAction } from '@/app/actions/notifications'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/notifications')

  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const unread = items.filter((n) => !n.read).length

  return (
    <div className="container-app">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              Notifications
            </h1>
            <p className="text-sm text-slate-500">
              {unread} unread · updates arrive live without refreshing.
            </p>
          </div>
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={unread === 0}
            >
              Mark all as read
            </button>
          </form>
        </div>
        <Alerts searchParams={searchParams} />

        <div className="card divide-y divide-slate-100 p-0">
          {items.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nothing here yet — membership requests, approvals, invitations
              and task updates will show up here.
            </p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 px-5 py-3.5 ${n.read ? 'opacity-60' : ''}`}
            >
              <div>
                <p className="text-sm text-slate-800">
                  {!n.read && (
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-500 align-middle" />
                  )}
                  {n.message}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {n.type} · {fmtPKT(n.createdAt)}
                </p>
              </div>
              {n.link && (
                <Link
                  href={n.link}
                  className="whitespace-nowrap text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
