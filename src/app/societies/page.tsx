import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SocietiesPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/societies')

  const q = searchParams.q?.trim()
  const societies = await db.society.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { category: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
    include: {
      president: { select: { name: true } },
      _count: {
        select: { memberships: { where: { status: 'APPROVED' } } },
      },
    },
  })

  const myMemberships = await db.membership.findMany({
    where: { studentId: user.id },
    select: { societyId: true, status: true },
  })
  const mine = new Map(myMemberships.map((m) => [m.societyId, m.status]))

  return (
    <div className="container-app">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Societies</h1>
          <p className="text-sm text-slate-500">
            Browse campus societies — login required. Request to join and the
            president decides.
          </p>
        </div>
        <form method="GET" className="flex gap-2">
          <input
            className="input w-56"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search name or category…"
          />
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
      </div>

      {societies.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No societies found{q ? ` for “${q}”` : ''} yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {societies.map((s) => {
            const status = mine.get(s.id)
            return (
              <Link
                key={s.id}
                href={`/societies/${s.id}`}
                className="card block transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="badge badge-indigo">{s.category}</span>
                  {status && (
                    <span
                      className={`badge ${status === 'APPROVED' ? 'badge-emerald' : status === 'PENDING' ? 'badge-amber' : 'badge-slate'}`}
                    >
                      {status}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 font-bold text-slate-900">{s.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {s.description}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  President: {s.president.name} · {s._count.memberships}{' '}
                  member{s._count.memberships === 1 ? '' : 's'}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
