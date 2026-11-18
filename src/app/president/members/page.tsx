import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import {
  decideMembershipAction,
  removeMemberAction,
  setMemberLabelAction,
} from '@/app/actions/societies'
import { MembershipBadge } from '@/components/badges'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PresidentMembersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'PRESIDENT')
    redirect('/login?next=/president/members')

  const society = await db.society.findUnique({
    where: { presidentId: user.id },
  })
  if (!society) redirect('/president/society')

  const members = await db.membership.findMany({
    where: { societyId: society.id },
    include: { student: { select: { name: true, email: true } } },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  })

  const order = ['PENDING', 'APPROVED', 'REJECTED', 'REMOVED']
  members.sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  )

  return (
    <div className="container-app">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Members of {society.name}
          </h1>
          <p className="text-sm text-slate-500">
            Approve or reject pending requests, remove members, assign Member /
            Core Member labels.
          </p>
        </div>
        <Link href="/president" className="btn btn-secondary">
          Dashboard
        </Link>
      </div>
      <Alerts searchParams={searchParams} />

      <div className="card overflow-x-auto p-0">
        <table className="table-app">
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>Label</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400">
                  No membership requests yet. Share your society page with
                  students.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <p className="font-medium text-slate-800">{m.student.name}</p>
                  <p className="text-xs text-slate-400">{m.student.email}</p>
                </td>
                <td>
                  <MembershipBadge s={m.status} />
                </td>
                <td>
                  {m.status === 'APPROVED' ? (
                    <form
                      action={setMemberLabelAction}
                      className="flex items-center gap-1.5"
                    >
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select
                        name="label"
                        className="input w-36 py-1 text-xs"
                        defaultValue={m.label}
                      >
                        <option value="MEMBER">Member</option>
                        <option value="CORE_MEMBER">Core Member</option>
                      </select>
                      <button className="btn btn-secondary btn-sm" type="submit">
                        Set
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {m.status === 'PENDING' && (
                      <>
                        <form action={decideMembershipAction}>
                          <input type="hidden" name="membershipId" value={m.id} />
                          <input type="hidden" name="decision" value="APPROVED" />
                          <button className="btn btn-success btn-sm" type="submit">
                            Approve
                          </button>
                        </form>
                        <form action={decideMembershipAction}>
                          <input type="hidden" name="membershipId" value={m.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <button className="btn btn-danger btn-sm" type="submit">
                            Reject
                          </button>
                        </form>
                      </>
                    )}
                    {m.status === 'APPROVED' && (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="btn btn-secondary btn-sm" type="submit">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
