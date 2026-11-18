'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { publish } from '@/lib/sse'

export async function markAllReadAction() {
  const user = await requireUser()
  await db.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  })
  publish(`user:${user.id}`, { kind: 'unread', count: 0 })
  redirect('/notifications?ok=All+notifications+marked+as+read')
}
