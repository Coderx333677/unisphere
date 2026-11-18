'use client'

import { createSubEventAction } from '@/app/actions/mega-events'
import { money } from './badges'

type StudentOption = {
  id: string
  name: string
  email: string
}

export default function PresidentSubEventForm({
  megaEventId,
  minDate,
  maxDate,
  availableBudget,
  students,
}: {
  megaEventId: string
  minDate: string
  maxDate: string
  availableBudget: number
  students: StudentOption[]
}) {
  return (
    <form action={createSubEventAction} className="space-y-4">
      <input type="hidden" name="megaEventId" value={megaEventId} />

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sub-Event Title
        </label>
        <input
          name="title"
          type="text"
          required
          placeholder="e.g. CodeSprint Hackathon"
          className="input-app mt-1"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Description
        </label>
        <textarea
          name="description"
          rows={3}
          required
          placeholder="Specific operational plan, guidelines, and objectives for this sub-event..."
          className="input-app mt-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Date (Within Range)
          </label>
          <input
            name="date"
            type="date"
            min={minDate}
            max={maxDate}
            required
            className="input-app mt-1"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Range: {minDate} to {maxDate}
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Start Time (PKT)
          </label>
          <input
            name="startTime"
            type="time"
            required
            className="input-app mt-1"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            End Time (PKT)
          </label>
          <input
            name="endTime"
            type="time"
            required
            className="input-app mt-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Venue
        </label>
        <input
          name="venue"
          type="text"
          required
          placeholder="e.g. Main Auditorium / Lab 3"
          className="input-app mt-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Supervisor (Registered Student)
          </label>
          <select
            name="supervisorId"
            required
            className="input-app mt-1"
          >
            <option value="">Select a student supervisor...</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.email})
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-400">
            Supervisor can manage all tasks in this sub-event.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Initial Allocation (PKR)
          </label>
          <input
            name="allocation"
            type="number"
            min="0"
            max={availableBudget}
            step="1"
            defaultValue="0"
            required
            className="input-app mt-1"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Available: {money(availableBudget)} (immutable once created)
          </p>
        </div>
      </div>

      <button type="submit" className="btn btn-primary w-full sm:w-auto">
        Create Sub-Event
      </button>
    </form>
  )
}
