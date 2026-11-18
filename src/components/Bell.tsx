'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type N = {
  id: string
  type: string
  message: string
  link?: string | null
  createdAt: string
}

export default function Bell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<N[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/stream?channel=user')
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.kind === 'notification') {
          setUnread((u) => u + 1)
          setToast(d.n?.message ?? 'New notification')
          window.setTimeout(() => setToast(null), 4500)
        } else if (d.kind === 'unread') {
          setUnread(typeof d.count === 'number' ? d.count : 0)
        }
      } catch {
        /* ignore malformed frames */
      }
    }
    return () => es.close()
  }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => alive && setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">
                No notifications yet
              </li>
            )}
            {items.map((n) => (
              <li key={n.id} className="border-b border-slate-50 px-4 py-2.5 last:border-0">
                <Link
                  href={n.link || '/notifications'}
                  onClick={() => setOpen(false)}
                  className="block text-sm text-slate-700 hover:text-indigo-600"
                >
                  {n.message}
                </Link>
                <span className="text-xs text-slate-400">{n.type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-500 align-middle" />
          {toast}
        </div>
      )}
    </div>
  )
}
