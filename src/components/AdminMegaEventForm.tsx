'use client'

import { useState } from 'react'
import { createMegaEventAction } from '@/app/actions/mega-events'

type SocietyOption = {
  id: string
  name: string
  president: {
    id: string
    name: string
    email: string
  }
}

export default function AdminMegaEventForm({
  societies,
}: {
  societies: SocietyOption[]
}) {
  const [selectedSocietyId, setSelectedSocietyId] = useState<string>(
    societies[0]?.id || ''
  )

  const selectedSociety = societies.find((s) => s.id === selectedSocietyId)

  return (
    <form action={createMegaEventAction} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Mega Event Title
        </label>
        <input
          name="title"
          type="text"
          required
          placeholder="e.g. Annual Tech Symposium 2026"
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
          placeholder="Detailed description of the mega event and its overarching goals..."
          className="input-app mt-1"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Host Society
        </label>
        <select
          name="societyId"
          value={selectedSocietyId}
          onChange={(e) => setSelectedSocietyId(e.target.value)}
          required
          className="input-app mt-1"
        >
          {societies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {selectedSociety && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Automatically Assigned President (Read-only)
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {selectedSociety.president.name}{' '}
            <span className="font-normal text-slate-500">
              ({selectedSociety.president.email})
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            President is auto-derived from the selected society and cannot be spoofed.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Start Date (PKT)
          </label>
          <input
            name="startDate"
            type="date"
            required
            className="input-app mt-1"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            End Date (PKT)
          </label>
          <input
            name="endDate"
            type="date"
            required
            className="input-app mt-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Overall Budget (PKR)
        </label>
        <input
          name="overallBudget"
          type="number"
          min="0"
          step="1"
          required
          placeholder="e.g. 500000"
          className="input-app mt-1"
        />
        <p className="mt-1 text-xs text-slate-400">
          Whole non-negative integer in PKR.
        </p>
      </div>

      <button type="submit" className="btn btn-primary w-full sm:w-auto">
        Create Mega Event
      </button>
    </form>
  )
}
