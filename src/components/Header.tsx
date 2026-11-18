import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { logoutAction } from '@/app/actions/auth'
import Bell from './Bell'

const NAV: Record<string, { href: string; label: string }[]> = {
  PRESIDENT: [
    { href: '/president', label: 'Dashboard' },
    { href: '/president/events', label: 'Events' },
    { href: '/president/members', label: 'Members' },
    { href: '/societies', label: 'Societies' },
  ],
  STUDENT: [
    { href: '/student', label: 'My Space' },
    { href: '/societies', label: 'Societies' },
    { href: '/notifications', label: 'Notifications' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/societies', label: 'Societies' },
    { href: '/admin/monitor', label: 'Monitor' },
  ],
}

export default async function Header() {
  const user = await getSessionUser()
  const links = user ? (NAV[user.role] ?? []) : []
  const unread = user
    ? await db.notification.count({ where: { userId: user.id, read: false } })
    : 0

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white">
            US
          </span>
          <span className="text-lg tracking-tight">UniSphere</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Bell initialUnread={unread} />
              <span className="hidden text-sm text-slate-500 sm:inline">
                {user.name.split(' ')[0]} ·{' '}
                <span className="font-semibold text-slate-700">{user.role}</span>
              </span>
              <form action={logoutAction}>
                <button type="submit" className="btn btn-secondary btn-sm">
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary btn-sm">
                Login
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
      {/* mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-1.5 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
