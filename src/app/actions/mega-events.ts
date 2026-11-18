'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { HttpError } from '@/lib/errors'
import { requireUser } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { parsePKT } from '@/lib/time'
import { sanitizeNext } from '@/lib/validate'
import {
  parsePKTDate,
  parsePKTDateTime,
  validateMegaEventInput,
  validateSubEventInput,
  recordSubEventExpense,
} from '@/lib/mega-events'

const go = (path: string, msg: string, ok = false) =>
  redirect(`${path}?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`)

function handle(e: unknown, path: string): never {
  if (e instanceof HttpError) go(path, e.message || `Error ${e.status}`)
  console.error('Action error:', e)
  throw e
}

const TASK_STATUS = ['TODO', 'IN_PROGRESS', 'COMPLETED']

// ==========================================
// ADMIN ACTIONS
// ==========================================

export async function createMegaEventAction(formData: FormData) {
  const path = '/admin/mega-events'
  try {
    const user = await requireUser('ADMIN')

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const societyId = String(formData.get('societyId') ?? '').trim()
    const startRaw = String(formData.get('startDate') ?? '').trim()
    const endRaw = String(formData.get('endDate') ?? '').trim()
    const overallBudget = Number(formData.get('overallBudget'))

    if (!societyId) {
      throw new HttpError(400, 'Please select a society.')
    }

    const society = await db.society.findUnique({
      where: { id: societyId },
      include: { president: true },
    })
    if (!society) {
      throw new HttpError(400, 'Selected society does not exist.')
    }

    // presidentId is read from Society.presidentId; never accepted from client input
    const presidentId = society.presidentId

    const startDate = parsePKTDate(startRaw, false)
    const endDate = parsePKTDate(endRaw, true)

    const valErrors = validateMegaEventInput({
      title,
      description,
      startDate,
      endDate,
      overallBudget,
    })
    if (valErrors.length > 0) {
      throw new HttpError(400, valErrors.join(' '))
    }

    const megaEvent = await db.megaEvent.create({
      data: {
        title,
        description,
        societyId: society.id,
        presidentId,
        createdById: user.id,
        startDate,
        endDate,
        overallBudget,
      },
    })

    await notify(
      presidentId,
      'MEGA_EVENT_ASSIGNED',
      `New Mega Event "${title}" has been created for your society.`,
      `/president/mega-events/${megaEvent.id}`
    )

    go(`/admin/mega-events/${megaEvent.id}`, 'Mega Event created successfully.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function updateMegaEventTitleDescriptionAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const path = `/admin/mega-events/${id}`
  try {
    const user = await requireUser('ADMIN')

    const megaEvent = await db.megaEvent.findUnique({ where: { id } })
    if (!megaEvent) throw new HttpError(404, 'Mega Event not found.')
    if (megaEvent.createdById !== user.id) {
      throw new HttpError(403, 'You can only edit Mega Events you created.')
    }

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()

    if (!title || title.length < 3) {
      throw new HttpError(400, 'Title must be at least 3 characters.')
    }
    if (!description || description.length < 5) {
      throw new HttpError(400, 'Description must be at least 5 characters.')
    }

    // Lock society, president, dates, and overallBudget: update title and description ONLY
    await db.megaEvent.update({
      where: { id },
      data: {
        title,
        description,
      },
    })

    go(path, 'Mega Event updated successfully.', true)
  } catch (e) {
    handle(e, path)
  }
}

// ==========================================
// PRESIDENT ACTIONS
// ==========================================

export async function createSubEventAction(formData: FormData) {
  const megaEventId = String(formData.get('megaEventId') ?? '')
  const path = `/president/mega-events/${megaEventId}`
  try {
    const user = await requireUser('PRESIDENT')

    const megaEvent = await db.megaEvent.findUnique({
      where: { id: megaEventId },
    })
    if (!megaEvent) throw new HttpError(404, 'Mega Event not found.')
    if (megaEvent.presidentId !== user.id) {
      throw new HttpError(403, 'You are not the assigned president for this Mega Event.')
    }

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const date = String(formData.get('date') ?? '').trim()
    const startTime = String(formData.get('startTime') ?? '').trim()
    const endTime = String(formData.get('endTime') ?? '').trim()
    const venue = String(formData.get('venue') ?? '').trim()
    const supervisorId = String(formData.get('supervisorId') ?? '').trim()
    const allocation = Number(formData.get('allocation') ?? 0)

    const supervisor = await db.user.findUnique({
      where: { id: supervisorId },
    })
    if (!supervisor || supervisor.role !== 'STUDENT') {
      throw new HttpError(400, 'Supervisor must be an existing registered student.')
    }

    const startsAt = parsePKTDateTime(date, startTime)
    const endsAt = parsePKTDateTime(date, endTime)

    const valErrors = validateSubEventInput(
      {
        title,
        description,
        startsAt,
        endsAt,
        venue,
        supervisorRole: supervisor.role,
        allocation,
      },
      megaEvent
    )
    if (valErrors.length > 0) {
      throw new HttpError(400, valErrors.join(' '))
    }

    // Verify allocation sum <= overallBudget
    const existingAgg = await db.subEvent.aggregate({
      where: { megaEventId },
      _sum: { allocation: true },
    })
    const currentAllocTotal = existingAgg._sum.allocation ?? 0
    if (currentAllocTotal + allocation > megaEvent.overallBudget) {
      const available = megaEvent.overallBudget - currentAllocTotal
      throw new HttpError(
        400,
        `Allocation exceeds available Mega Event budget. Available: PKR ${available.toLocaleString()}`
      )
    }

    const subEvent = await db.subEvent.create({
      data: {
        megaEventId,
        title,
        description,
        startsAt,
        endsAt,
        venue,
        supervisorId,
        allocation,
      },
    })

    await notify(
      supervisorId,
      'SUPERVISOR_ASSIGNED',
      `You have been assigned as supervisor for sub-event "${title}" in "${megaEvent.title}".`,
      '/student'
    )

    go(
      `/president/mega-events/${megaEventId}/sub-events/${subEvent.id}`,
      `Sub-event "${title}" created successfully.`,
      true
    )
  } catch (e) {
    handle(e, path)
  }
}

export async function updateSubEventAction(formData: FormData) {
  const subEventId = String(formData.get('subEventId') ?? '')
  const path = `/president/mega-events/sub-events/${subEventId}`
  try {
    const user = await requireUser('PRESIDENT')

    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      include: { megaEvent: true },
    })
    if (!subEvent) throw new HttpError(404, 'Sub-event not found.')
    if (subEvent.megaEvent.presidentId !== user.id) {
      throw new HttpError(403, 'You are not the president for this Mega Event.')
    }

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const date = String(formData.get('date') ?? '').trim()
    const startTime = String(formData.get('startTime') ?? '').trim()
    const endTime = String(formData.get('endTime') ?? '').trim()
    const venue = String(formData.get('venue') ?? '').trim()
    const supervisorId = String(formData.get('supervisorId') ?? '').trim()

    const supervisor = await db.user.findUnique({
      where: { id: supervisorId },
    })
    if (!supervisor || supervisor.role !== 'STUDENT') {
      throw new HttpError(400, 'Supervisor must be an existing registered student.')
    }

    const startsAt = parsePKTDateTime(date, startTime)
    const endsAt = parsePKTDateTime(date, endTime)

    const valErrors = validateSubEventInput(
      {
        title,
        description,
        startsAt,
        endsAt,
        venue,
        supervisorRole: supervisor.role,
        allocation: subEvent.allocation, // immutable
      },
      subEvent.megaEvent
    )
    if (valErrors.length > 0) {
      throw new HttpError(400, valErrors.join(' '))
    }

    const oldSupervisorId = subEvent.supervisorId
    await db.subEvent.update({
      where: { id: subEventId },
      data: {
        title,
        description,
        startsAt,
        endsAt,
        venue,
        supervisorId,
      },
    })

    if (oldSupervisorId !== supervisorId) {
      await notify(
        supervisorId,
        'SUPERVISOR_ASSIGNED',
        `You have been assigned as supervisor for sub-event "${title}".`,
        '/student'
      )
    }

    go(
      `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEvent.id}`,
      'Sub-event updated successfully.',
      true
    )
  } catch (e) {
    handle(e, `/president/mega-events`)
  }
}

export async function assignSupervisorAction(formData: FormData) {
  const subEventId = String(formData.get('subEventId') ?? '')
  const supervisorId = String(formData.get('supervisorId') ?? '').trim()
  try {
    const user = await requireUser('PRESIDENT')
    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      include: { megaEvent: true },
    })
    if (!subEvent) throw new HttpError(404, 'Sub-event not found.')
    if (subEvent.megaEvent.presidentId !== user.id) {
      throw new HttpError(403, 'Permission denied.')
    }

    const supervisor = await db.user.findUnique({ where: { id: supervisorId } })
    if (!supervisor || supervisor.role !== 'STUDENT') {
      throw new HttpError(400, 'Supervisor must be an existing registered student.')
    }

    await db.subEvent.update({
      where: { id: subEventId },
      data: { supervisorId },
    })

    await notify(
      supervisorId,
      'SUPERVISOR_ASSIGNED',
      `You have been assigned as supervisor for sub-event "${subEvent.title}".`,
      '/student'
    )

    go(
      `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEvent.id}`,
      'Supervisor updated.',
      true
    )
  } catch (e) {
    handle(e, `/president/mega-events`)
  }
}

export async function setInitialAllocationAction(formData: FormData) {
  const subEventId = String(formData.get('subEventId') ?? '')
  try {
    const user = await requireUser('PRESIDENT')
    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      include: { megaEvent: true },
    })
    if (!subEvent) throw new HttpError(404, 'Sub-event not found.')
    if (subEvent.megaEvent.presidentId !== user.id) {
      throw new HttpError(403, 'Permission denied.')
    }

    if (subEvent.allocation > 0) {
      throw new HttpError(400, 'Allocation has already been set and is immutable.')
    }

    const allocation = Number(formData.get('allocation'))
    if (!Number.isInteger(allocation) || allocation <= 0) {
      throw new HttpError(400, 'Allocation must be a positive integer (PKR).')
    }

    const existingAgg = await db.subEvent.aggregate({
      where: { megaEventId: subEvent.megaEventId },
      _sum: { allocation: true },
    })
    const currentAllocTotal = existingAgg._sum.allocation ?? 0
    if (currentAllocTotal + allocation > subEvent.megaEvent.overallBudget) {
      const available = subEvent.megaEvent.overallBudget - currentAllocTotal
      throw new HttpError(
        400,
        `Allocation exceeds available Mega Event budget. Available: PKR ${available.toLocaleString()}`
      )
    }

    await db.subEvent.update({
      where: { id: subEventId },
      data: { allocation },
    })

    go(
      `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEvent.id}`,
      'Allocation set successfully.',
      true
    )
  } catch (e) {
    handle(e, `/president/mega-events`)
  }
}

export async function createSubEventTaskAction(formData: FormData) {
  const subEventId = String(formData.get('subEventId') ?? '')
  try {
    const user = await requireUser('PRESIDENT')
    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      include: { megaEvent: true },
    })
    if (!subEvent) throw new HttpError(404, 'Sub-event not found.')
    if (subEvent.megaEvent.presidentId !== user.id) {
      throw new HttpError(403, 'Permission denied.')
    }

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const priority = String(formData.get('priority') ?? '')
    const dueRaw = String(formData.get('dueDate') ?? '')
    const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null

    if (title.length < 3) throw new HttpError(400, 'Task title must be at least 3 characters.')
    if (description.length < 3) throw new HttpError(400, 'Task description is required.')
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
      throw new HttpError(400, 'Pick a valid priority (LOW, MEDIUM, HIGH).')
    }

    const dueDate = dueRaw ? parsePKT(dueRaw) : new Date(NaN)
    if (isNaN(dueDate.getTime())) throw new HttpError(400, 'Pick a valid due date.')

    if (assigneeId) {
      const student = await db.user.findUnique({ where: { id: assigneeId } })
      if (!student || student.role !== 'STUDENT') {
        throw new HttpError(400, 'Tasks can only be assigned to registered students.')
      }
    }

    // Integrity: subEventId set, eventId null
    const task = await db.task.create({
      data: {
        subEventId,
        eventId: null,
        title,
        description,
        priority,
        dueDate,
        assigneeId,
      },
    })

    if (assigneeId) {
      await notify(
        assigneeId,
        'TASK_ASSIGNED',
        `You were assigned the task "${title}" for sub-event "${subEvent.title}".`,
        '/student'
      )
    }

    go(
      `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEvent.id}`,
      `Task "${task.title}" created.`,
      true
    )
  } catch (e) {
    handle(e, `/president/mega-events`)
  }
}

export async function assignSubEventTaskAction(formData: FormData) {
  const taskId = String(formData.get('taskId') ?? '')
  try {
    const user = await requireUser('PRESIDENT')
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { subEvent: { include: { megaEvent: true } } },
    })
    if (!task || !task.subEvent) throw new HttpError(404, 'Task not found.')
    if (task.subEvent.megaEvent.presidentId !== user.id) {
      throw new HttpError(403, 'Permission denied.')
    }

    const assigneeId = String(formData.get('assigneeId') ?? '').trim() || null
    if (assigneeId) {
      const student = await db.user.findUnique({ where: { id: assigneeId } })
      if (!student || student.role !== 'STUDENT') {
        throw new HttpError(400, 'Tasks can only be assigned to registered students.')
      }
    }

    await db.task.update({
      where: { id: taskId },
      data: { assigneeId },
    })

    if (assigneeId) {
      await notify(
        assigneeId,
        'TASK_ASSIGNED',
        `You were assigned the task "${task.title}" for sub-event "${task.subEvent.title}".`,
        '/student'
      )
    }

    go(
      `/president/mega-events/${task.subEvent.megaEventId}/sub-events/${task.subEvent.id}`,
      assigneeId ? 'Task assigned.' : 'Task unassigned.',
      true
    )
  } catch (e) {
    handle(e, `/president/mega-events`)
  }
}

export async function recordSubEventExpenseAction(formData: FormData) {
  const subEventId = String(formData.get('subEventId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const amount = Number(formData.get('amount'))
  const note = String(formData.get('note') ?? '').trim() || null

  try {
    const user = await requireUser('PRESIDENT')
    const res = await recordSubEventExpense(subEventId, amount, title, note, user.id)

    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      select: { megaEventId: true },
    })

    go(
      `/president/mega-events/${subEvent?.megaEventId}/sub-events/${subEventId}`,
      `Expense recorded. Spent: PKR ${res.spent.toLocaleString()} / Remaining: PKR ${res.remaining.toLocaleString()}`,
      true
    )
  } catch (e) {
    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      select: { megaEventId: true },
    })
    handle(
      e,
      subEvent
        ? `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEventId}`
        : `/president/mega-events`
    )
  }
}

// ==========================================
// TASK STATUS UPDATE (SHARED)
// ==========================================

export async function updateSubEventTaskStatusAction(formData: FormData) {
  const taskId = String(formData.get('taskId') ?? '')
  const status = String(formData.get('status') ?? '')
  const path = sanitizeNext(formData.get('back')) ?? '/student'

  try {
    const user = await requireUser()
    if (!TASK_STATUS.includes(status)) {
      throw new HttpError(400, 'Invalid status')
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        subEvent: {
          include: {
            megaEvent: true,
          },
        },
      },
    })
    if (!task || !task.subEvent) {
      throw new HttpError(404, 'Task not found.')
    }

    const isPresident =
      user.role === 'PRESIDENT' && task.subEvent.megaEvent.presidentId === user.id
    const isSupervisor =
      user.role === 'STUDENT' && task.subEvent.supervisorId === user.id
    const isAssignee = task.assigneeId === user.id

    // Supervisor manages all tasks in their own sub-event; students update only their own assigned tasks
    if (!isPresident && !isSupervisor && !isAssignee) {
      throw new HttpError(403, 'Permission denied.')
    }

    await db.task.update({
      where: { id: taskId },
      data: { status },
    })

    // In-app notifications:
    if (isAssignee || isSupervisor) {
      await notify(
        task.subEvent.megaEvent.presidentId,
        'TASK_UPDATE',
        `${user.name} moved "${task.title}" to ${status.replace('_', ' ')}`,
        `/president/mega-events/${task.subEvent.megaEventId}/sub-events/${task.subEvent.id}`
      )
    }
    if (isPresident && task.assigneeId && task.assigneeId !== user.id) {
      await notify(
        task.assigneeId,
        'TASK_UPDATE',
        `Your task "${task.title}" is now ${status.replace('_', ' ')}`,
        '/student'
      )
    }

    go(path, 'Task updated.', true)
  } catch (e) {
    handle(e, path)
  }
}
