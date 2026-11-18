import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createEventAction } from '@/app/actions/events'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'PRESIDENT')
    redirect('/login?next=/president/events/new')
  const society = await db.society.findUnique({
    where: { presidentId: user.id },
  })
  if (!society) redirect('/president/society')

  return (
    <div className="container-app">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              New event for {society.name}
            </h1>
            <p className="text-sm text-slate-500">
              Saved as Draft — submit it for approval when ready.
            </p>
          </div>
          <Link href="/president/events" className="btn btn-secondary btn-sm">
            Back
          </Link>
        </div>
        <Alerts searchParams={searchParams} />
        <form action={createEventAction} className="card space-y-4">
          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              className="input"
              required
              minLength={3}
              placeholder="e.g. AI Workshop"
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
              placeholder="What is this event about?"
            />
          </div>
          <div>
            <label className="label" htmlFor="venue">
              Venue
            </label>
            <input
              id="venue"
              name="venue"
              className="input"
              required
              placeholder="e.g. Auditorium, Block C"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="startAt">
                Start (PKT)
              </label>
              <input
                id="startAt"
                name="startAt"
                type="datetime-local"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="endAt">
                End (PKT)
              </label>
              <input
                id="endAt"
                name="endAt"
                type="datetime-local"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="regDeadline">
                Reg. deadline (PKT)
              </label>
              <input
                id="regDeadline"
                name="regDeadline"
                type="datetime-local"
                className="input"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="capacity">
                Participant capacity
              </label>
              <input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                className="input"
                required
                placeholder="e.g. 50"
              />
            </div>
            <div>
              <label className="label" htmlFor="proposedBudget">
                Proposed budget (PKR)
              </label>
              <input
                id="proposedBudget"
                name="proposedBudget"
                type="number"
                min={0}
                className="input"
                required
                placeholder="e.g. 50000"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Times are interpreted as Pakistan Standard Time (Asia/Karachi)
            regardless of your browser timezone, stored in UTC and displayed in
            PKT.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Create draft
            </button>
            <Link href="/president/events" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
