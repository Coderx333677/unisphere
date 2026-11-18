import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      type: true,
      message: true,
      link: true,
      read: true,
      createdAt: true,
    },
  })
  const unread = await db.notification.count({
    where: { userId: user.id, read: false },
  })
  return NextResponse.json({ items, unread })
}
