import { getSessionUser } from '@/lib/auth'
import { subscribe } from '@/lib/sse'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const ch = url.searchParams.get('channel') ?? ''

  let key: string
  if (ch === 'user') {
    const user = await getSessionUser()
    if (!user) return new Response('unauthorized', { status: 401 })
    key = `user:${user.id}`
  } else if (ch.startsWith('event:')) {
    const id = ch.slice('event:'.length)
    if (!/^[\w-]{1,64}$/.test(id))
      return new Response('bad channel', { status: 400 })
    key = `event:${id}`
  } else {
    return new Response('bad channel', { status: 400 })
  }

  const enc = new TextEncoder()
  let off = () => {}
  let ping: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream({
    start(c) {
      off = subscribe(key, (d) => {
        try {
          c.enqueue(enc.encode(`data: ${d}\n\n`))
        } catch {
          /* stream closed */
        }
      })
      ping = setInterval(() => {
        try {
          c.enqueue(enc.encode(': ping\n\n'))
        } catch {
          /* stream closed */
        }
      }, 25_000)
      req.signal.addEventListener('abort', () => {
        if (ping) clearInterval(ping)
        off()
        try {
          c.close()
        } catch {
          /* already closed */
        }
      })
    },
    cancel() {
      if (ping) clearInterval(ping)
      off()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
