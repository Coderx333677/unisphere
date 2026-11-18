'use client'

import { useState } from 'react'

type SubEventSummary = {
  title: string
  venue: string
  supervisor: string
  allocation: number
  spent: number
  tasksCount: number
  completedTasksCount: number
  taskProgress: number
}

type AnalysisStats = {
  title: string
  subEventsCount: number
  overallBudget: number
  totalAllocated: number
  availableAllocation: number
  totalSpent: number
  remainingTotal: number
  totalTasksCount: number
  completedTasksCount: number
  taskProgress: number
  subEvents: SubEventSummary[]
}

type AiResult = {
  observations: string[]
  potentialIssues: string[]
  recommendations: string[]
}

export default function PresidentAiAnalysis({
  megaEventId,
  stats,
}: {
  megaEventId: string
  stats: AnalysisStats
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiResult | null>(null)
  const [source, setSource] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleAnalyse = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mega-events/${megaEventId}/ai-analysis`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error('Analysis request failed.')
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.analysis)
      setSource(data.source || 'AI Engine')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI report'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
              ✦
            </span>
            <h3 className="font-bold text-slate-900">
              Operations Intelligence & AI Analysis
            </h3>
            <span className="badge badge-indigo text-[10px]">Optional Bonus</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Generate executive observations, risk detection, and budget velocity insights based on live database metrics.
          </p>
        </div>

        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
        >
          {loading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Analyzing...
            </>
          ) : (
            <>
              <span>⚡</span> Analyse with AI
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3 rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Analysis Results ({source})
            </span>
            <span className="text-[10px] text-slate-400">
              Authoritative DB calculations preserved
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-slate-800">
                🔍 Key Observations
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                {result.observations?.map((obs, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-indigo-500">•</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-amber-800">
                ⚠️ Potential Issues / Bottlenecks
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                {result.potentialIssues?.map((iss, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span>
                    <span>{iss}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold text-emerald-800">
                💡 Recommendations
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                {result.recommendations?.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
