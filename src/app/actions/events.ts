'use server'

import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { HttpError } from '@/lib/errors'
import { requireUser, requireOwnEvent } from '@/lib/auth'
import { notify, notifyMany } from '@/lib/notify'
import { publish } from '@/lib/sse'
import * as R from '@/lib/rules'
import { parsePKT } from '@/lib/time'
import { sanitizeNext } from '@/lib/validate'

const go = (path: string, msg: string, ok = false) =>
  redirect(`${path}?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`)

function handle(e: unknown, path: string): never {
  if (e instanceof HttpError) go(path, e.message || `Error ${e.status}`)
  throw e
}

const TASK_STATUS = ['TODO', 'IN_PROGRESS', 'COMPLETED']

function parseEventForm(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const venue = String(formData.get('venue') ?? '').trim()
  const startRaw = String(formData.get('startAt') ?? '')
  const endRaw = String(formData.get('endAt') ?? '')
  const deadlineRaw = String(formData.get('regDeadline') ?? '')
  const capacity = Number(formData.get('capacity'))
  const proposedBudget = Number(formData.get('proposedBudget'))

  const err: string[] = []
  if (title.length < 3) err.push('Title must be at least 3 characters')
  if (description.length < 10)
    err.push('Description must be at least 10 characters')
  if (venue.length < 2) err.push('Venue is required')
  if (!startRaw || !endRaw || !deadlineRaw)
    err.push('Start, end and registration deadline are required')

  const startAt = startRaw ? parsePKT(startRaw) : new Date(NaN)
  const endAt = endRaw ? parsePKT(endRaw) : new Date(NaN)
  const regDeadline = deadlineRaw ? parsePKT(deadlineRaw) : new Date(NaN)
  if (isNaN(startAt.getTime())) err.push('Invalid start date/time')
  if (isNaN(endAt.getTime())) err.push('Invalid end date/time')
  if (isNaN(regDeadline.getTime()))
    err.push('Invalid registration deadline')
  if (!Number.isFinite(capacity)) err.push('Capacity must be a number')
  if (!Number.isFinite(proposedBudget)) err.push('Budget must be a number')

  const i = { startAt, endAt, regDeadline, capacity, proposedBudget }
  return { title, description, venue, i, err }
}

async function publishSeats(eventId: string) {
  const ev = await db.event.findUnique({ where: { id: eventId } })
  if (ev)
    publish(`event:${eventId}`, {
      kind: 'seats',
      left: Math.max(0, ev.capacity - ev.regCount),
    })
}

export async function createEventAction(formData: FormData) {
  const path = '/president/events/new'
  try {
    const user = await requireUser('PRESIDENT')
    const society = await db.society.findUnique({
      where: { presidentId: user.id },
    })
    if (!society)
      throw new HttpError(400, 'Create your society before adding events')

    const { title, description, venue, i, err } = parseEventForm(formData)
    if (err.length) throw new HttpError(400, err.join(' '))
    const ruleErrs = R.validateEventInput(i)
    if (ruleErrs.length) throw new HttpError(400, ruleErrs.join(' '))

    const ev = await db.event.create({
      data: {
        societyId: society.id,
        title,
        description,
        venue,
        ...i,
        approvalStatus: 'DRAFT',
      },
    })
    go(`/president/events/${ev.id}`, 'Event created as Draft.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function updateEventAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/president/events/${eventId}`
  try {
    const user = await requireUser('PRESIDENT')
    const ev = await requireOwnEvent(user, eventId)
    if (!R.canEdit(ev))
      throw new HttpError(
        400,
        ev.cancelled
          ? 'A cancelled event cannot be edited'
          : ev.approvalStatus === 'PENDING'
            ? 'Editing is locked while the event is pending review'
            : 'This event can no longer be edited'
      )

    const { title, description, venue, i, err } = parseEventForm(formData)
    if (err.length) throw new HttpError(400, err.join(' '))
    const ruleErrs = R.validateEventInput(i, ev.regCount)
    if (ruleErrs.length) throw new HttpError(400, ruleErrs.join(' '))

    // editing an APPROVED event -> back to PENDING, approvedBudget stays in force
    const approvalStatus =
      ev.approvalStatus === 'APPROVED' ? 'PENDING' : ev.approvalStatus

    await db.event.update({
      where: { id: ev.id },
      data: { title, description, venue, ...i, approvalStatus },
    })
    go(
      path,
      approvalStatus === 'PENDING'
        ? 'Event updated. It was sent back to Pending for review; the approved budget stays in force.'
        : 'Event updated.',
      true
    )
  } catch (e) {
    handle(e, path)
  }
}

export async function submitEventAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/president/events/${eventId}`
  try {
    const user = await requireUser('PRESIDENT')
    const ev = await requireOwnEvent(user, eventId)
    if (!R.canSubmit(ev))
      throw new HttpError(
        400,
        ev.cancelled
          ? 'A cancelled event cannot be submitted'
          : ev.startAt <= new Date()
            ? 'The start time has passed: this event can only be cancelled'
            : 'This event is not in a submittable state'
      )

    await db.event.update({
      where: { id: ev.id },
      data: { approvalStatus: 'PENDING', decidedAt: null, adminRemarks: null },
    })
    const admins = await db.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    })
    await notifyMany(
      admins.map((a) => a.id),
      'EVENT_SUBMIT',
      `New event proposal: "${ev.title}" (proposed budget PKR ${ev.proposedBudget.toLocaleString()})`,
      `/admin/events/${ev.id}`
    )
    go(path, 'Submitted for administrator approval.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function cancelEventAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/president/events/${eventId}`
  try {
    const user = await requireUser('PRESIDENT')
    const ev = await requireOwnEvent(user, eventId)
    if (!R.canCancel(ev))
      throw new HttpError(
        400,
        ev.cancelled
          ? 'This event is already cancelled'
          : 'A completed approved event cannot be cancelled'
      )

    const registered = await db.registration.findMany({
      where: { eventId: ev.id, status: 'REGISTERED' },
      select: { studentId: true },
    })
    const volunteers = await db.invitation.findMany({
      where: { eventId: ev.id, status: { in: ['PENDING', 'ACCEPTED'] } },
      select: { studentId: true },
    })

    await db.$transaction([
      db.event.update({
        where: { id: ev.id },
        data: {
          cancelled: true,
          regCount: 0,
          registrations: {
            updateMany: {
              where: { status: 'REGISTERED' },
              data: { status: 'CANCELLED' },
            },
          },
        },
      }),
    ])

    await notifyMany(
      [
        ...registered.map((r) => r.studentId),
        ...volunteers.map((v) => v.studentId),
      ],
      'EVENT_CANCELLED',
      `Event "${ev.title}" was cancelled`,
      '/student'
    )
    go(path, 'Event cancelled. Registrations were marked CANCELLED.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function decideEventAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/admin/events/${eventId}`
  try {
    await requireUser('ADMIN')
    const decision = String(formData.get('decision') ?? '')
    const remarks = String(formData.get('remarks') ?? '').trim()

    const ev = await db.event.findUnique({
      where: { id: eventId },
      include: { society: true },
    })
    if (!ev) throw new HttpError(404, 'Event not found')

    if (decision === 'approve') {
      if (!R.adminCanApprove(ev))
        throw new HttpError(
          400,
          ev.startAt <= new Date()
            ? 'The start time has passed: this pending event can only be rejected'
            : 'This event is not pending approval'
        )
      await db.event.update({
        where: { id: ev.id },
        data: {
          approvalStatus: 'APPROVED',
          approvedBudget: ev.proposedBudget,
          adminRemarks: remarks || null,
          decidedAt: new Date(),
        },
      })
      await notify(
        ev.society.presidentId,
        'EVENT_DECISION',
        `Approved: "${ev.title}" with budget PKR ${ev.proposedBudget.toLocaleString()}${
          remarks ? ` — Remarks: ${remarks}` : ''
        }`,
        `/president/events/${ev.id}`
      )
      go(path, 'Event and budget approved.', true)
    } else if (decision === 'reject') {
      if (!R.adminCanReject(ev))
        throw new HttpError(400, 'This event is not pending approval')
      if (!remarks) throw new HttpError(400, 'Remarks are required when rejecting')
      await db.event.update({
        where: { id: ev.id },
        data: {
          approvalStatus: 'REJECTED',
          adminRemarks: remarks,
          decidedAt: new Date(),
        },
      })
      await notify(
        ev.society.presidentId,
        'EVENT_DECISION',
        `Rejected: "${ev.title}" — Remarks: ${remarks}`,
        `/president/events/${ev.id}`
      )
      go(path, 'Event rejected.', true)
    } else {
      throw new HttpError(400, 'Invalid decision')
    }
  } catch (e) {
    handle(e, path)
  }
}

export async function registerAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/events/${eventId}`
  try {
    const user = await requireUser('STUDENT')
    const ev = await db.event.findUnique({
      where: { id: eventId },
      include: { society: true },
    })
    if (!ev || !R.canRegister(ev))
      throw new HttpError(400, 'Registration is closed for this event')

    await db.$transaction(async (tx) => {
      const existing = await tx.registration.findUnique({
        where: { eventId_studentId: { eventId, studentId: user.id } },
      })
      if (existing?.status === 'REGISTERED')
        throw new HttpError(409, 'You are already registered for this event')
      // ATOMIC seat grab: only succeeds if a seat is left
      const n = await tx.$executeRaw`UPDATE "Event" SET "regCount" = "regCount" + 1 WHERE id = ${eventId} AND "regCount" < "capacity"`
      if (n === 0) throw new HttpError(409, 'Event is full')
      if (existing)
        await tx.registration.update({
          where: { id: existing.id },
          data: { status: 'REGISTERED' },
        })
      else
        await tx.registration.create({
          data: { eventId, studentId: user.id, status: 'REGISTERED' },
        })
    })

    await notify(
      ev.society.presidentId,
      'REGISTRATION',
      `${user.name} registered for "${ev.title}"`,
      `/president/events/${ev.id}`
    )
    await publishSeats(eventId)
    go(path, 'You are registered for this event!', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function cancelRegistrationAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/events/${eventId}`
  try {
    const user = await requireUser('STUDENT')
    const ev = await db.event.findUnique({ where: { id: eventId } })
    if (!ev || !R.canCancelRegistration(ev))
      throw new HttpError(400, 'Cannot cancel right now')

    await db.$transaction(async (tx) => {
      const r = await tx.registration.findUnique({
        where: { eventId_studentId: { eventId, studentId: user.id } },
      })
      if (!r || r.status !== 'REGISTERED')
        throw new HttpError(400, 'You are not registered for this event')
      await tx.registration.update({
        where: { id: r.id },
        data: { status: 'CANCELLED' },
      })
      await tx.$executeRaw`UPDATE "Event" SET "regCount" = "regCount" - 1 WHERE id = ${eventId}`
    })

    await publishSeats(eventId)
    go(path, 'Registration cancelled. Your seat was released.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function inviteAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/president/events/${eventId}`
  try {
    const user = await requireUser('PRESIDENT')
    const ev = await requireOwnEvent(user, eventId)
    if (!R.canInvite(ev))
      throw new HttpError(
        400,
        ev.cancelled
          ? 'A cancelled event cannot have new invitations'
          : 'Invitations are only allowed for approved events that have not started'
      )

    const studentId = String(formData.get('studentId') ?? '')
    const student = await db.user.findUnique({ where: { id: studentId } })
    if (!student || student.role !== 'STUDENT')
      throw new HttpError(400, 'You can only invite student accounts')

    const existing = await db.invitation.findUnique({
      where: { eventId_studentId: { eventId, studentId } },
    })
    if (existing)
      throw new HttpError(
        400,
        'This student already has an invitation for this event (declines are final)'
      )

    await db.invitation.create({ data: { eventId, studentId } })
    await notify(
      studentId,
      'INVITATION',
      `You were invited to volunteer for "${ev.title}"`,
      '/student'
    )
    go(path, `Invited ${student.name}.`, true)
  } catch (e) {
    handle(e, path)
  }
}

export async function respondInvitationAction(formData: FormData) {
  const path = '/student'
  try {
    const user = await requireUser('STUDENT')
    const invitationId = String(formData.get('invitationId') ?? '')
    const decision = String(formData.get('decision') ?? '')
    if (!['ACCEPTED', 'DECLINED'].includes(decision))
      throw new HttpError(400, 'Invalid decision')

    const inv = await db.invitation.findUnique({
      where: { id: invitationId },
      include: { event: { include: { society: true } } },
    })
    if (!inv || inv.studentId !== user.id) throw new HttpError(404)
    if (inv.status !== 'PENDING')
      throw new HttpError(400, 'This invitation has already been answered')

    await db.invitation.update({
      where: { id: inv.id },
      data: { status: decision },
    })
    await notify(
      inv.event.society.presidentId,
      'INVITATION_RESPONSE',
      `${user.name} ${decision === 'ACCEPTED' ? 'accepted' : 'declined'} the invitation for "${inv.event.title}"`,
      `/president/events/${inv.eventId}`
    )
    go(
      path,
      decision === 'ACCEPTED'
        ? 'Invitation accepted. The president can now assign you tasks.'
        : 'Invitation declined.',
      true
    )
  } catch (e) {
    handle(e, path)
  }
}

export async function withdrawVolunteerAction(formData: FormData) {
  const path = '/student'
  try {
    const user = await requireUser('STUDENT')
    const invitationId = String(formData.get('invitationId') ?? '')
    const inv = await db.invitation.findUnique({
      where: { id: invitationId },
      include: { event: { include: { society: true } } },
    })
    if (!inv || inv.studentId !== user.id) throw new HttpError(404)
    if (inv.status !== 'ACCEPTED')
      throw new HttpError(400, 'Only accepted volunteer invitations can be withdrawn')

    await db.$transaction([
      db.invitation.update({
        where: { id: inv.id },
        data: { status: 'WITHDRAWN' },
      }),
      // Incomplete assigned tasks become unassigned; In Progress tasks reset to To Do
      db.task.updateMany({
        where: {
          eventId: inv.eventId,
          assigneeId: user.id,
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'TODO',
          assigneeId: null,
        },
      }),
      db.task.updateMany({
        where: {
          eventId: inv.eventId,
          assigneeId: user.id,
          status: 'TODO',
        },
        data: {
          assigneeId: null,
        },
      }),
      // Completed tasks remain associated with that volunteer for history
    ])

    await notify(
      inv.event.society.presidentId,
      'VOLUNTEER_WITHDRAWN',
      `${user.name} withdrew as a volunteer for "${inv.event.title}". Incomplete tasks were reset.`,
      `/president/events/${inv.eventId}`
    )
    go(path, 'You have withdrawn from volunteering for this event.', true)
  } catch (e) {
    handle(e, path)
  }
}

async function taskForUpdate(taskId: string, userId: string, role: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { event: { include: { society: true } } },
  })
  if (!task) throw new HttpError(404, 'Task not found')
  const isPresident =
    role === 'PRESIDENT' && task.event.society.presidentId === userId
  const isAssignee = task.assigneeId === userId
  if (!isPresident && !isAssignee) throw new HttpError(403)
  return { task, isPresident, isAssignee }
}

export async function createTaskAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/president/events/${eventId}`
  try {
    const user = await requireUser('PRESIDENT')
    const ev = await requireOwnEvent(user, eventId)
    if (!R.canCreateTask(ev))
      throw new HttpError(400, 'Tasks cannot be added to a cancelled event')

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const priority = String(formData.get('priority') ?? '')
    const dueRaw = String(formData.get('dueDate') ?? '')
    const assigneeId = String(formData.get('assigneeId') ?? '').trim()

    const err: string[] = []
    if (title.length < 3) err.push('Task title must be at least 3 characters')
    if (description.length < 3) err.push('Task description is required')
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority))
      err.push('Pick a priority')
    const dueDate = dueRaw ? parsePKT(dueRaw) : new Date(NaN)
    if (isNaN(dueDate.getTime())) err.push('Pick a valid due date')
    if (err.length) throw new HttpError(400, err.join(' '))

    if (assigneeId) {
      const inv = await db.invitation.findUnique({
        where: { eventId_studentId: { eventId, studentId: assigneeId } },
      })
      if (!inv || inv.status !== 'ACCEPTED')
        throw new HttpError(
          400,
          'Tasks can only be assigned to students who accepted a volunteer invitation'
        )
    }

    const task = await db.task.create({
      data: {
        eventId,
        title,
        description,
        priority,
        dueDate,
        assigneeId: assigneeId || null,
      },
    })
    if (assigneeId)
      await notify(
        assigneeId,
        'TASK_ASSIGNED',
        `You were assigned the task "${title}"`,
        '/student'
      )
    go(path, `Task "${task.title}" created.`, true)
  } catch (e) {
    handle(e, path)
  }
}

export async function updateTaskStatusAction(formData: FormData) {
  const taskId = String(formData.get('taskId') ?? '')
  const status = String(formData.get('status') ?? '')
  const path = sanitizeNext(formData.get('back')) ?? '/student'
  try {
    const user = await requireUser()
    if (!TASK_STATUS.includes(status)) throw new HttpError(400, 'Invalid status')
    const { task, isPresident, isAssignee } = await taskForUpdate(
      taskId,
      user.id,
      user.role
    )

    await db.task.update({ where: { id: task.id }, data: { status } })

    if (isAssignee)
      await notify(
        task.event.society.presidentId,
        'TASK_UPDATE',
        `${user.name} moved "${task.title}" to ${status.replace('_', ' ')}`,
        `/president/events/${task.eventId}`
      )
    if (isPresident && task.assigneeId && task.assigneeId !== user.id)
      await notify(
        task.assigneeId,
        'TASK_UPDATE',
        `Your task "${task.title}" is now ${status.replace('_', ' ')}`,
        '/student'
      )
    go(path, 'Task updated.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function assignTaskAction(formData: FormData) {
  const taskId = String(formData.get('taskId') ?? '')
  try {
    const user = await requireUser('PRESIDENT')
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { event: true },
    })
    if (!task) throw new HttpError(404, 'Task not found')
    await requireOwnEvent(user, task.eventId)

    const assigneeId = String(formData.get('assigneeId') ?? '').trim()
    const path = `/president/events/${task.eventId}`
    if (assigneeId) {
      const inv = await db.invitation.findUnique({
        where: {
          eventId_studentId: { eventId: task.eventId, studentId: assigneeId },
        },
      })
      if (!inv || inv.status !== 'ACCEPTED')
        throw new HttpError(
          400,
          'Only students who accepted a volunteer invitation can be assigned'
        )
    }

    await db.task.update({
      where: { id: task.id },
      data: { assigneeId: assigneeId || null },
    })
    if (assigneeId)
      await notify(
        assigneeId,
        'TASK_ASSIGNED',
        `You were assigned the task "${task.title}"`,
        '/student'
      )
    go(path, assigneeId ? 'Task assigned.' : 'Task unassigned.', true)
  } catch (e) {
    handle(e, '/president/events')
  }
}

async function ownExpense(expenseId: string, userId: string) {
  const ex = await db.expense.findUnique({
    where: { id: expenseId },
    include: { event: { include: { society: true } } },
  })
  if (!ex) throw new HttpError(404, 'Expense not found')
  if (ex.event.society.presidentId !== userId) throw new HttpError(404)
  return ex
}

async function sumExpenses(
  tx: Prisma.TransactionClient,
  eventId: string,
  excludeId?: string
) {
  const rows = await tx.expense.findMany({
    where: { eventId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { amount: true },
  })
  return rows.reduce((s, r) => s + r.amount, 0)
}

export async function addExpenseAction(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const path = `/president/events/${eventId}`
  try {
    const user = await requireUser('PRESIDENT')
    await requireOwnEvent(user, eventId)
    const title = String(formData.get('title') ?? '').trim()
    const amount = Number(formData.get('amount'))
    const note = String(formData.get('note') ?? '').trim() || null

    if (title.length < 2) throw new HttpError(400, 'Expense title is required')
    if (!Number.isInteger(amount) || amount <= 0)
      throw new HttpError(400, 'Amount must be a whole positive number (PKR)')

    await db.$transaction(async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: eventId } })
      if (!ev || !R.canAddExpense(ev))
        throw new HttpError(400, 'Expenses are not allowed in this state')
      const spent = await sumExpenses(tx, eventId)
      if (spent > ev.approvedBudget!)
        throw new HttpError(400, 'Over budget - new expenses blocked')
      if (spent + amount > ev.approvedBudget!)
        throw new HttpError(
          400,
          `Exceeds approved budget. Remaining: PKR ${(ev.approvedBudget! - spent).toLocaleString()}`
        )
      await tx.expense.create({ data: { eventId, title, amount, note } })
    })
    go(path, 'Expense recorded.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function editExpenseAction(formData: FormData) {
  const expenseId = String(formData.get('expenseId') ?? '')
  try {
    const user = await requireUser('PRESIDENT')
    const ex = await ownExpense(expenseId, user.id)
    const path = `/president/events/${ex.eventId}`
    const title = String(formData.get('title') ?? '').trim()
    const amount = Number(formData.get('amount'))
    const note = String(formData.get('note') ?? '').trim() || null

    if (title.length < 2) throw new HttpError(400, 'Expense title is required')
    if (!Number.isInteger(amount) || amount <= 0)
      throw new HttpError(400, 'Amount must be a whole positive number (PKR)')

    await db.$transaction(async (tx) => {
      const ev = await tx.event.findUnique({ where: { id: ex.eventId } })
      if (!ev || !R.canAddExpense(ev))
        throw new HttpError(400, 'Expenses are not allowed in this state')
      const totalWithout = await sumExpenses(tx, ex.eventId, ex.id)
      if (totalWithout + amount > ev.approvedBudget!)
        throw new HttpError(
          400,
          `Exceeds approved budget. Remaining: PKR ${(ev.approvedBudget! - totalWithout).toLocaleString()}`
        )
      await tx.expense.update({
        where: { id: ex.id },
        data: { title, amount, note },
      })
    })
    go(path, 'Expense updated.', true)
  } catch (e) {
    handle(e, '/president/events')
  }
}

export async function deleteExpenseAction(formData: FormData) {
  const expenseId = String(formData.get('expenseId') ?? '')
  try {
    const user = await requireUser('PRESIDENT')
    const ex = await ownExpense(expenseId, user.id)
    await db.expense.delete({ where: { id: ex.id } })
    go(`/president/events/${ex.eventId}`, 'Expense deleted.', true)
  } catch (e) {
    handle(e, '/president/events')
  }
}
