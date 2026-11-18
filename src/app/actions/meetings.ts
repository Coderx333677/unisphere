'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { HttpError } from '@/lib/errors'
import { requireUser } from '@/lib/auth'
import { notifyMany } from '@/lib/notify'
import { parsePKT, fmtPKT } from '@/lib/time'

const go = (path: string, msg: string, ok = false) =>
  redirect(`${path}?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`)

function handle(e: unknown, path: string): never {
  if (e instanceof HttpError) go(path, e.message || `Error ${e.status}`)
  throw e
}

export async function createMeetingAction(formData: FormData) {
  const path = '/president/meetings'
  try {
    const user = await requireUser('PRESIDENT')
    const society = await db.society.findUnique({
      where: { presidentId: user.id },
      include: {
        memberships: {
          where: { status: 'APPROVED' },
          select: { studentId: true },
        },
      },
    })

    if (!society) {
      throw new HttpError(400, 'Create your society before scheduling meetings.')
    }

    const title = String(formData.get('title') ?? '').trim()
    const startRaw = String(formData.get('startAt') ?? '')
    const location = String(formData.get('location') ?? '').trim()
    const agenda = String(formData.get('agenda') ?? '').trim()

    const err: string[] = []
    if (title.length < 3) err.push('Meeting title must be at least 3 characters.')
    if (!startRaw) err.push('Meeting date and time is required.')
    if (location.length < 2) err.push('Meeting location is required.')
    if (agenda.length < 5) err.push('Agenda must be at least 5 characters.')

    const startAt = startRaw ? parsePKT(startRaw) : new Date(NaN)
    if (isNaN(startAt.getTime())) err.push('Invalid meeting date/time.')

    if (err.length > 0) throw new HttpError(400, err.join(' '))

    const meeting = await db.meeting.create({
      data: {
        societyId: society.id,
        title,
        startAt,
        location,
        agenda,
      },
    })

    // Notify all approved society members of the new meeting
    const memberIds = society.memberships.map((m) => m.studentId)
    if (memberIds.length > 0) {
      await notifyMany(
        memberIds,
        'MEETING_INVITATION',
        `New ${society.name} meeting: "${title}" on ${fmtPKT(startAt)} at ${location}.`,
        '/student'
      )
    }

    go(path, `Meeting "${title}" scheduled and ${memberIds.length} members notified.`, true)
  } catch (e) {
    handle(e, path)
  }
}

export async function cancelMeetingAction(formData: FormData) {
  const path = '/president/meetings'
  try {
    const user = await requireUser('PRESIDENT')
    const meetingId = String(formData.get('meetingId') ?? '')

    const meeting = await db.meeting.findUnique({
      where: { id: meetingId },
      include: {
        society: {
          include: {
            memberships: {
              where: { status: 'APPROVED' },
              select: { studentId: true },
            },
          },
        },
      },
    })

    if (!meeting || meeting.society.presidentId !== user.id) {
      throw new HttpError(404, 'Meeting not found.')
    }

    if (meeting.cancelled) {
      throw new HttpError(400, 'This meeting is already cancelled.')
    }

    await db.meeting.update({
      where: { id: meeting.id },
      data: { cancelled: true },
    })

    const memberIds = meeting.society.memberships.map((m) => m.studentId)
    if (memberIds.length > 0) {
      await notifyMany(
        memberIds,
        'MEETING_CANCELLED',
        `Meeting "${meeting.title}" for ${meeting.society.name} was cancelled.`,
        '/student'
      )
    }

    go(path, 'Meeting cancelled and members notified.', true)
  } catch (e) {
    handle(e, path)
  }
}
