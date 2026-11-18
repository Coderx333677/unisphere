'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { HttpError, errQS } from '@/lib/errors'
import { requireUser } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { validateSocietyInput } from '@/lib/validate'

const go = (path: string, msg: string, ok = false) =>
  redirect(`${path}?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`)

function handle(e: unknown, path: string): never {
  if (e instanceof HttpError) go(path, e.message || `Error ${e.status}`)
  throw e
}

export async function createSocietyAction(formData: FormData) {
  const path = '/president/society'
  try {
    const user = await requireUser('PRESIDENT')
    const existing = await db.society.findUnique({
      where: { presidentId: user.id },
    })
    if (existing)
      throw new HttpError(400, 'You already own a society. Each president can create only one.')

    const i = {
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      category: String(formData.get('category') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? '').trim(),
      contactPhone: String(formData.get('contactPhone') ?? '').trim() || null,
    }
    const errs = validateSocietyInput(i)
    if (errs.length) throw new HttpError(400, errs.join(' '))

    const clash = await db.society.findUnique({ where: { name: i.name } })
    if (clash) throw new HttpError(400, 'A society with this name already exists')

    await db.society.create({ data: { ...i, presidentId: user.id } })
    go(path, 'Society created. It is active immediately.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function updateSocietyAction(formData: FormData) {
  const path = '/president/society'
  try {
    const user = await requireUser('PRESIDENT')
    const society = await db.society.findUnique({
      where: { presidentId: user.id },
    })
    if (!society) throw new HttpError(404, 'No society found for your account')

    const i = {
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      category: String(formData.get('category') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? '').trim(),
      contactPhone: String(formData.get('contactPhone') ?? '').trim() || null,
    }
    const errs = validateSocietyInput(i)
    if (errs.length) throw new HttpError(400, errs.join(' '))

    const clash = await db.society.findUnique({ where: { name: i.name } })
    if (clash && clash.id !== society.id)
      throw new HttpError(400, 'A society with this name already exists')

    await db.society.update({ where: { id: society.id }, data: i })
    go(path, 'Society updated.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function requestJoinAction(formData: FormData) {
  const societyId = String(formData.get('societyId') ?? '')
  const path = `/societies/${societyId}`
  try {
    const user = await requireUser('STUDENT')
    const society = await db.society.findUnique({ where: { id: societyId } })
    if (!society) throw new HttpError(404, 'Society not found')

    const existing = await db.membership.findUnique({
      where: { societyId_studentId: { societyId, studentId: user.id } },
    })
    if (existing?.status === 'PENDING')
      throw new HttpError(400, 'You already have a pending request for this society')
    if (existing?.status === 'APPROVED')
      throw new HttpError(400, 'You are already a member of this society')

    if (existing) {
      await db.membership.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      })
    } else {
      await db.membership.create({
        data: { societyId, studentId: user.id, status: 'PENDING' },
      })
    }
    await notify(
      society.presidentId,
      'MEMBERSHIP_REQUEST',
      `${user.name} requested to join ${society.name}`,
      '/president/members'
    )
    go(path, 'Membership request sent to the president.', true)
  } catch (e) {
    handle(e, path)
  }
}

async function ownMembership(membershipId: string) {
  const m = await db.membership.findUnique({
    where: { id: membershipId },
    include: { society: true, student: true },
  })
  if (!m) throw new HttpError(404, 'Membership not found')
  return m
}

export async function decideMembershipAction(formData: FormData) {
  const path = '/president/members'
  try {
    const user = await requireUser('PRESIDENT')
    const decision = String(formData.get('decision') ?? '')
    if (!['APPROVED', 'REJECTED'].includes(decision))
      throw new HttpError(400, 'Invalid decision')

    const m = await ownMembership(String(formData.get('membershipId') ?? ''))
    if (m.society.presidentId !== user.id) throw new HttpError(404)
    if (m.status !== 'PENDING')
      throw new HttpError(400, 'Only pending requests can be decided')

    await db.membership.update({
      where: { id: m.id },
      data: { status: decision },
    })
    await notify(
      m.studentId,
      'MEMBERSHIP_DECISION',
      `Your request to join ${m.society.name} was ${
        decision === 'APPROVED' ? 'approved' : 'rejected'
      }`,
      '/student'
    )
    go(path, `Request ${decision === 'APPROVED' ? 'approved' : 'rejected'}.`, true)
  } catch (e) {
    handle(e, path)
  }
}

export async function removeMemberAction(formData: FormData) {
  const path = '/president/members'
  try {
    const user = await requireUser('PRESIDENT')
    const m = await ownMembership(String(formData.get('membershipId') ?? ''))
    if (m.society.presidentId !== user.id) throw new HttpError(404)
    if (m.status !== 'APPROVED')
      throw new HttpError(400, 'Only approved members can be removed')

    await db.membership.update({
      where: { id: m.id },
      data: { status: 'REMOVED' },
    })
    await notify(
      m.studentId,
      'MEMBERSHIP_DECISION',
      `You were removed from ${m.society.name}`,
      '/student'
    )
    go(path, 'Member removed.', true)
  } catch (e) {
    handle(e, path)
  }
}

export async function setMemberLabelAction(formData: FormData) {
  const path = '/president/members'
  try {
    const user = await requireUser('PRESIDENT')
    const label = String(formData.get('label') ?? '')
    if (!['MEMBER', 'CORE_MEMBER'].includes(label))
      throw new HttpError(400, 'Invalid label')

    const m = await ownMembership(String(formData.get('membershipId') ?? ''))
    if (m.society.presidentId !== user.id) throw new HttpError(404)
    if (m.status !== 'APPROVED')
      throw new HttpError(400, 'Labels can only be set on approved members')

    await db.membership.update({ where: { id: m.id }, data: { label } })
    go(path, 'Label updated.', true)
  } catch (e) {
    handle(e, path)
  }
}
