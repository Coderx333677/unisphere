import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminSocietiesPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/login?next=/admin/societies')

  const societies = await db.society.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      president: { select: { name: true, email: true } },
      _count: {
        select: {
          memberships: { where: { status: 'APPROVED' } },
          events: true,
        },
      },
    },
  })

  return (
    <div className="container-app">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Societies</h1>
          <p className="text-sm text-slate-500">
            Visible as soon as they are created — no admin approval needed for
            society registration.
          </p>
        </div>
        <Link href="/admin" className="btn btn-secondary">
          Dashboard
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-app">
          <thead>
            <tr>
              <th>Society</th>
              <th>Category</th>
              <th>President</th>
              <th>Members</th>
              <th>Events</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {societies.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400">
                  No societies yet.
                </td>
              </tr>
            )}
            {societies.map((s) => (
              <tr key={s.id}>
                <td className="font-medium text-slate-800">{s.name}</td>
                <td>
                  <span className="badge badge-indigo">{s.category}</span>
                </td>
                <td>
                  {s.president.name}
                  <p className="text-xs text-slate-400">{s.president.email}</p>
                </td>
                <td>{s._count.memberships}</td>
                <td>{s._count.events}</td>
                <td className="text-xs text-slate-500">
                  {s.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
