import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'
import {
  createMeetingAction,
  cancelMeetingAction,
} from '@/app/actions/meetings'
import Alerts from '@/components/Alerts'

export const dynamic = 'force-dynamic'

export default async function PresidentMeetingsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'PRESIDENT') {
    redirect('/login?next=/president/meetings')
  }

  const society = await db.society.findUnique({
    where: { presidentId: user.id },
    include: {
      meetings: {
        orderBy: { startAt: 'desc' },
      },
      memberships: {
        where: { status: 'APPROVED' },
      },
    },
  })

  if (!society) {
    redirect('/president/society?error=Create your society first')
  }

  const approvedMemberCount = society.memberships.length

  return (
    <div className="container-app">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Society Meetings</h1>
          <p className="text-sm text-slate-500">
            Schedule meetings for <strong>{society.name}</strong>. Approved members ({approvedMemberCount}) are automatically notified.
          </p>
        </div>
        <Link href="/president" className="btn btn-secondary btn-sm">
          ← Back to Dashboard
        </Link>
      </div>

      <Alerts searchParams={searchParams} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Schedule Form */}
        <div className="lg:col-span-1">
          <div className="card space-y-4">
            <h2 className="font-bold text-slate-900">Schedule New Meeting</h2>
            <form action={createMeetingAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="title">
                  Meeting Title
                </label>
                <input
                  id="title"
                  name="title"
                  className="input"
                  required
                  placeholder="e.g. Weekly Executive Sync"
                />
              </div>

              <div>
                <label className="label" htmlFor="startAt">
                  Date & Time (PKT)
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
                <label className="label" htmlFor="location">
                  Location / Venue
                </label>
                <input
                  id="location"
                  name="location"
                  className="input"
                  required
                  placeholder="e.g. Campus Hall B / Google Meet"
                />
              </div>

              <div>
                <label className="label" htmlFor="agenda">
                  Agenda / Notes
                </label>
                <textarea
                  id="agenda"
                  name="agenda"
                  className="input min-h-24"
                  required
                  placeholder="Items to discuss, goals, or preparation needed..."
                />
              </div>

              <button type="submit" className="btn btn-primary w-full">
                Schedule & Notify Members
              </button>
            </form>
          </div>
        </div>

        {/* Existing Meetings List */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="mb-3 font-bold text-slate-900">
              Meetings History ({society.meetings.length})
            </h2>

            {society.meetings.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No meetings scheduled yet. Use the form on the left to schedule your first meeting.
              </p>
            ) : (
              <div className="space-y-4">
                {society.meetings.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      m.cancelled
                        ? 'border-slate-200 bg-slate-50 opacity-75'
                        : 'border-slate-200 bg-white shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
                          {m.cancelled ? (
                            <span className="badge badge-rose">Cancelled</span>
                          ) : (
                            <span className="badge badge-emerald">Scheduled</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          🕒 {fmtPKT(m.startAt)} • 📍 {m.location}
                        </p>
                      </div>

                      {!m.cancelled && (
                        <form action={cancelMeetingAction}>
                          <input type="hidden" name="meetingId" value={m.id} />
                          <button
                            type="submit"
                            className="btn btn-danger btn-sm text-xs"
                          >
                            Cancel Meeting
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
                      <strong>Agenda:</strong> {m.agenda}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
