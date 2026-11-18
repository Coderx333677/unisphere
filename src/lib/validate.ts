export const CATEGORIES = [
  'Technology',
  'Arts',
  'Sports',
  'Academic',
  'Social Service',
  'Business',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const ROLES = ['PRESIDENT', 'STUDENT'] as const
export type PublicRole = (typeof ROLES)[number]

// next URL must start with '/' and not '//'
export const sanitizeNext = (next: unknown): string | null => {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.startsWith('/api/')) return null
  return next
}

export const roleHome = (role: string) =>
  role === 'PRESIDENT'
    ? '/president'
    : role === 'ADMIN'
      ? '/admin'
      : '/student'

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

export function validateSignup(i: {
  name: string
  email: string
  password: string
  role: string
}) {
  const err: string[] = []
  if (i.name.trim().length < 2) err.push('Name must be at least 2 characters')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email))
    err.push('Enter a valid email address')
  if (i.password.length < 8) err.push('Password must be at least 8 characters')
  if (!(ROLES as readonly string[]).includes(i.role))
    err.push('Invalid role: only Society President or Student can sign up')
  return err
}

export function validateSocietyInput(i: {
  name: string
  description: string
  category: string
  contactEmail: string
  contactPhone?: string
}) {
  const err: string[] = []
  if (i.name.trim().length < 3) err.push('Name must be at least 3 characters')
  if (i.description.trim().length < 10)
    err.push('Description must be at least 10 characters')
  if (!(CATEGORIES as readonly string[]).includes(i.category))
    err.push('Pick a category from the list')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.contactEmail))
    err.push('Enter a valid contact email')
  if (i.contactPhone && !/^[0-9+\-\s()]{7,20}$/.test(i.contactPhone))
    err.push('Enter a valid contact phone')
  return err
}
