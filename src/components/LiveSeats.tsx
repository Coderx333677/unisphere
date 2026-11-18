'use client'

import { useEffect, useState } from 'react'

export default function LiveSeats({
  eventId,
  initialLeft,
}: {
  eventId: string
  initialLeft: number
}) {
  const [left, setLeft] = useState(initialLeft)

  useEffect(() => {
    const es = new EventSource(`/api/stream?channel=event:${eventId}`)
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.kind === 'seats' && typeof d.left === 'number') setLeft(d.left)
      } catch {
        /* ignore */
      }
    }
    return () => es.close()
  }, [eventId])

  return (
    <span data-testid="seats-left" className="font-semibold text-slate-900">
      {left} seat{left === 1 ? '' : 's'} remaining
    </span>
  )
}
