export type Ev = {
  approvalStatus: string
  cancelled: boolean
  startAt: Date
  endAt: Date
  regDeadline: Date
  approvedBudget: number | null
  capacity: number
  regCount: number
}

export const schedule = (e: Ev, now = new Date()) =>
  now < e.startAt ? 'UPCOMING' : now <= e.endAt ? 'ONGOING' : 'COMPLETED'

const started = (e: Ev, n = new Date()) => n >= e.startAt
const approved = (e: Ev) => e.approvalStatus === 'APPROVED' && !e.cancelled

// PUBLIC: link works for Approved, not cancelled (Upcoming, Ongoing, Completed)
export const isPublicLink = (e: Ev) => approved(e)
// PUBLIC LIST: same but NOT completed
export const isPublicListed = (e: Ev, n = new Date()) =>
  approved(e) && schedule(e, n) !== 'COMPLETED'

export const canEdit = (e: Ev, n = new Date()) =>
  !e.cancelled &&
  !started(e, n) &&
  ['DRAFT', 'REJECTED', 'APPROVED'].includes(e.approvalStatus)

// editing an APPROVED event -> status becomes PENDING (keep approvedBudget in force)

export const canSubmit = (e: Ev, n = new Date()) =>
  !e.cancelled &&
  !started(e, n) &&
  ['DRAFT', 'REJECTED'].includes(e.approvalStatus)

export const canCancel = (e: Ev, n = new Date()) =>
  !e.cancelled &&
  !(e.approvalStatus === 'APPROVED' && schedule(e, n) === 'COMPLETED')

export const canRegister = (e: Ev, n = new Date()) =>
  // + capacity check atomically
  approved(e) && !started(e, n) && n <= e.regDeadline

export const canCancelRegistration = (e: Ev, n = new Date()) =>
  !e.cancelled && !started(e, n)

export const canInvite = (e: Ev, n = new Date()) =>
  approved(e) && !started(e, n)

export const canCreateTask = (e: Ev) => !e.cancelled

// EXPENSES: only when APPROVED (so NOT in Pending-after-edit, NOT Rejected, NOT Cancelled)
export const canAddExpense = (e: Ev) =>
  approved(e) && e.approvedBudget !== null

// ADMIN: Pending whose start passed -> reject only
export const adminCanApprove = (e: Ev, n = new Date()) =>
  e.approvalStatus === 'PENDING' && !e.cancelled && !started(e, n)
export const adminCanReject = (e: Ev) =>
  e.approvalStatus === 'PENDING' && !e.cancelled

export function validateEventInput(
  i: {
    startAt: Date
    endAt: Date
    regDeadline: Date
    capacity: number
    proposedBudget: number
  },
  regCount = 0
) {
  const err: string[] = []
  if (!(i.startAt < i.endAt)) err.push('Start must be before end')
  if (!(i.regDeadline <= i.startAt))
    err.push('Registration deadline must be on or before start')
  if (!Number.isInteger(i.capacity) || i.capacity < 1)
    err.push('Capacity must be at least 1')
  if (i.capacity < regCount)
    err.push('Capacity cannot be below active registrations')
  if (!(i.proposedBudget >= 0)) err.push('Budget must be 0 or more')
  return err
}

export const progress = (tasks: { status: string }[]) =>
  tasks.length === 0
    ? 0
    : Math.round(
        (100 * tasks.filter((t) => t.status === 'COMPLETED').length) /
          tasks.length
      )
