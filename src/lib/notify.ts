import { db } from './db'
import { publish } from './sse'

export async function notify(
  userId: string,
  type: string,
  message: string,
  link?: string
) {
  const n = await db.notification.create({
    data: { userId, type, message, link },
  })
  publish(`user:${userId}`, { kind: 'notification', n })
  return n
}

export async function notifyMany(
  userIds: string[],
  type: string,
  message: string,
  link?: string
) {
  for (const id of new Set(userIds)) await notify(id, type, message, link)
}
