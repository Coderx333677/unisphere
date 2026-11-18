import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import {
  createSocietyAction,
  updateSocietyAction,
} from '@/app/actions/societies'
import { CATEGORIES } from '@/lib/validate'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PresidentSocietyPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'PRESIDENT')
    redirect('/login?next=/president/society')

  const society = await db.society.findUnique({
    where: { presidentId: user.id },
  })

  const action = society ? updateSocietyAction : createSocietyAction

  return (
    <div className="container-app">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-black text-slate-900">
          {society ? 'Edit society profile' : 'Create your society'}
        </h1>
        <p className="mb-5 text-sm text-slate-500">
          {society
            ? 'Changes apply immediately. Each president manages exactly one society.'
            : 'A society becomes active immediately after creation — no separate administrator approval.'}
        </p>
        <Alerts searchParams={searchParams} />
        <form action={action} encType="multipart/form-data" className="card space-y-4">
          <div>
            <label className="label" htmlFor="logo">
              Society Logo <span className="text-slate-400">(optional, max 2 MB)</span>
            </label>
            {society?.logoUrl && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={society.logoUrl}
                  alt={society.name}
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                />
                <span className="text-xs text-slate-500">Current logo</span>
              </div>
            )}
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/*"
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
          <div>
            <label className="label" htmlFor="name">
              Society name
            </label>
            <input
              id="name"
              name="name"
              className="input"
              required
              minLength={3}
              defaultValue={society?.name ?? ''}
              placeholder="e.g. Robotics Society"
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="input min-h-28"
              required
              minLength={10}
              defaultValue={society?.description ?? ''}
              placeholder="What does this society do?"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                className="input"
                required
                defaultValue={society?.category ?? ''}
              >
                <option value="" disabled>
                  Select…
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="contactPhone">
                Contact phone <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                className="input"
                defaultValue={society?.contactPhone ?? ''}
                placeholder="+92 300 0000000"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="contactEmail">
              Contact email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className="input"
              required
              defaultValue={society?.contactEmail ?? user.email}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            {society ? 'Save changes' : 'Create society'}
          </button>
        </form>
      </div>
    </div>
  )
}
