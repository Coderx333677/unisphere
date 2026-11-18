import { DateTime } from 'luxon'
import { db } from './db'
import { HttpError } from './errors'
import { ZONE } from './time'

export type MegaEventWithRelations = Awaited<ReturnType<typeof getMegaEventById>>

export function parsePKTDate(dateStr: string, isEndOfDay = false): Date {
  const dt = DateTime.fromISO(dateStr, { zone: ZONE })
  if (!dt.isValid) return new Date(NaN)
  return (isEndOfDay ? dt.endOf('day') : dt.startOf('day')).toUTC().toJSDate()
}

export function parsePKTDateTime(dateStr: string, timeStr: string): Date {
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: ZONE })
  if (!dt.isValid) return new Date(NaN)
  return dt.toUTC().toJSDate()
}

export function validateMegaEventInput(data: {
  title: string
  description: string
  startDate: Date
  endDate: Date
  overallBudget: number
}) {
  const errors: string[] = []
  if (!data.title || data.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters.')
  }
  if (!data.description || data.description.trim().length < 5) {
    errors.push('Description must be at least 5 characters.')
  }
  if (isNaN(data.startDate.getTime())) {
    errors.push('Invalid start date.')
  }
  if (isNaN(data.endDate.getTime())) {
    errors.push('Invalid end date.')
  }
  if (data.startDate > data.endDate) {
    errors.push('Start date must be on or before end date.')
  }
  if (!Number.isInteger(data.overallBudget) || data.overallBudget < 0) {
    errors.push('Overall budget must be a whole non-negative number (PKR).')
  }
  return errors
}

export function validateSubEventInput(
  data: {
    title: string
    description: string
    startsAt: Date
    endsAt: Date
    venue: string
    supervisorRole?: string
    allocation: number
  },
  megaEvent: { startDate: Date; endDate: Date }
) {
  const errors: string[] = []
  if (!data.title || data.title.trim().length < 3) {
    errors.push('Sub-event title must be at least 3 characters.')
  }
  if (!data.description || data.description.trim().length < 5) {
    errors.push('Description must be at least 5 characters.')
  }
  if (!data.venue || data.venue.trim().length < 2) {
    errors.push('Venue is required.')
  }
  if (isNaN(data.startsAt.getTime()) || isNaN(data.endsAt.getTime())) {
    errors.push('Invalid start or end time.')
  }
  if (data.startsAt >= data.endsAt) {
    errors.push('Start time must be earlier than end time.')
  }
  // Boundary check: Sub-event date range must be within parent range inclusive
  if (data.startsAt < megaEvent.startDate || data.endsAt > megaEvent.endDate) {
    errors.push('Sub-event date and time must fall within the Mega Event start and end dates.')
  }
  if (data.supervisorRole !== 'STUDENT') {
    errors.push('Supervisor must be an existing account with role STUDENT.')
  }
  if (!Number.isInteger(data.allocation) || data.allocation < 0) {
    errors.push('Allocation must be a non-negative whole integer (PKR).')
  }
  return errors
}

export function calculateSubEventProgress(tasks: { status: string }[]): number {
  if (!tasks || tasks.length === 0) return 0
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length
  return Math.round((completed / tasks.length) * 100)
}

export async function getMegaEventById(id: string) {
  return await db.megaEvent.findUnique({
    where: { id },
    include: {
      society: {
        include: {
          president: { select: { id: true, name: true, email: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      president: { select: { id: true, name: true, email: true } },
      subEvents: {
        include: {
          supervisor: { select: { id: true, name: true, email: true } },
          tasks: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          expenses: {
            orderBy: { spentOn: 'desc' },
          },
        },
        orderBy: { startsAt: 'asc' },
      },
    },
  })
}

export async function recordSubEventExpense(
  subEventId: string,
  amount: number,
  title: string,
  note: string | null | undefined,
  currentUserId: string
) {
  return await db.$transaction(async (tx) => {
    // 1. Load sub-event + Mega Event and verify president ownership.
    const subEvent = await tx.subEvent.findUnique({
      where: { id: subEventId },
      include: { megaEvent: true },
    })
    if (!subEvent) {
      throw new HttpError(404, 'Sub-event not found')
    }
    if (subEvent.megaEvent.presidentId !== currentUserId) {
      throw new HttpError(403, 'Only the assigned Society President can record expenses')
    }

    // 2. Validate positive integer amount.
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpError(400, 'Expense amount must be a positive integer (PKR)')
    }
    if (!title || title.trim().length < 2) {
      throw new HttpError(400, 'Expense title is required (at least 2 characters)')
    }

    // 3. Sum existing expenses where subEventId = this sub-event.
    const expenseAgg = await tx.expense.aggregate({
      where: { subEventId },
      _sum: { amount: true },
    })
    const spent = expenseAgg._sum.amount ?? 0

    // 4. Reject if spent + amount > allocation.
    if (spent + amount > subEvent.allocation) {
      throw new HttpError(
        400,
        `Expense exceeds sub-event allocation. Remaining: PKR ${(subEvent.allocation - spent).toLocaleString()}`
      )
    }

    // 5. Create Expense with subEventId (eventId = null).
    const expense = await tx.expense.create({
      data: {
        subEventId,
        eventId: null,
        title: title.trim(),
        amount,
        note: note ? note.trim() : null,
        spentOn: new Date(),
      },
    })

    const newSpent = spent + amount
    // 6. If allocation > 0 AND (spent + amount) >= allocation * 0.80
    //    AND thresholdNotified === false:
    //      create in-app Notification for MegaEvent.presidentId
    //      set thresholdNotified = true.
    if (
      subEvent.allocation > 0 &&
      newSpent >= subEvent.allocation * 0.8 &&
      !subEvent.thresholdNotified
    ) {
      await tx.notification.create({
        data: {
          userId: subEvent.megaEvent.presidentId,
          type: 'BUDGET_THRESHOLD',
          message: `Sub-event "${subEvent.title}" has reached 80% of its budget allocation (PKR ${newSpent.toLocaleString()} / PKR ${subEvent.allocation.toLocaleString()}).`,
          link: `/president/mega-events/${subEvent.megaEventId}/sub-events/${subEvent.id}`,
        },
      })
      await tx.subEvent.update({
        where: { id: subEventId },
        data: { thresholdNotified: true },
      })
    }

    // Commit transaction; return updated totals.
    return {
      expense,
      spent: newSpent,
      remaining: subEvent.allocation - newSpent,
      allocation: subEvent.allocation,
    }
  })
}
