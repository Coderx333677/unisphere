import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'UniSphere — University Society & Event Management',
  description:
    'UniSphere connects society presidents, students and university administration: societies, events, approvals, volunteers, tasks and budgets in one place.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          UniSphere · University Society &amp; Event Management · Hackathon MVP
        </footer>
      </body>
    </html>
  )
}
