const APPROVAL: Record<string, string> = {
  DRAFT: 'badge-slate',
  PENDING: 'badge-amber',
  APPROVED: 'badge-emerald',
  REJECTED: 'badge-rose',
}

const SCHEDULE: Record<string, string> = {
  UPCOMING: 'badge-sky',
  ONGOING: 'badge-violet',
  COMPLETED: 'badge-slate',
}

const MEMBERSHIP: Record<string, string> = {
  PENDING: 'badge-amber',
  APPROVED: 'badge-emerald',
  REJECTED: 'badge-rose',
  REMOVED: 'badge-slate',
}

const TASK: Record<string, string> = {
  TODO: 'badge-slate',
  IN_PROGRESS: 'badge-amber',
  COMPLETED: 'badge-emerald',
}

const INVITE: Record<string, string> = {
  PENDING: 'badge-amber',
  ACCEPTED: 'badge-emerald',
  DECLINED: 'badge-rose',
  WITHDRAWN: 'badge-slate',
}

const REG: Record<string, string> = {
  REGISTERED: 'badge-emerald',
  CANCELLED: 'badge-rose',
}

const pick = (m: Record<string, string>, s: string, fallback = 'badge-slate') =>
  m[s] ?? fallback

export const ApprovalBadge = ({ s }: { s: string }) => (
  <span className={`badge ${pick(APPROVAL, s)}`}>{s}</span>
)
export const ScheduleBadge = ({ s }: { s: string }) => (
  <span className={`badge ${pick(SCHEDULE, s)}`}>{s}</span>
)
export const MembershipBadge = ({ s }: { s: string }) => (
  <span className={`badge ${pick(MEMBERSHIP, s)}`}>{s}</span>
)
export const TaskBadge = ({ s }: { s: string }) => (
  <span className={`badge ${pick(TASK, s)}`}>{s.replace('_', ' ')}</span>
)
export const InviteBadge = ({ s }: { s: string }) => (
  <span className={`badge ${pick(INVITE, s)}`}>{s}</span>
)
export const RegBadge = ({ s }: { s: string }) => (
  <span className={`badge ${pick(REG, s)}`}>{s}</span>
)

export const money = (n: number) => `PKR ${n.toLocaleString('en-US')}`
