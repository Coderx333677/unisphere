import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DateTime } from 'luxon'

const db = new PrismaClient()

const pkt = (daysFromNow: number, hour: number, minute = 0) =>
  DateTime.now()
    .setZone('Asia/Karachi')
    .plus({ days: daysFromNow })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate()

async function main() {
  console.log('Seeding UniSphere…')

  const adminHash = await bcrypt.hash('Admin@12345', 10)
  const passHash = await bcrypt.hash('Pass@12345', 10)

  const admin = await db.user.upsert({
    where: { email: 'admin@unisphere.test' },
    update: {},
    create: {
      email: 'admin@unisphere.test',
      name: 'University Administrator',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  })

  const president1 = await db.user.upsert({
    where: { email: 'president1@unisphere.test' },
    update: {},
    create: {
      email: 'president1@unisphere.test',
      name: 'Ali Raza',
      passwordHash: passHash,
      role: 'PRESIDENT',
    },
  })

  const president2 = await db.user.upsert({
    where: { email: 'president2@unisphere.test' },
    update: {},
    create: {
      email: 'president2@unisphere.test',
      name: 'Sara Ahmed',
      passwordHash: passHash,
      role: 'PRESIDENT',
    },
  })

  const nexusSociety = await db.society.upsert({
    where: { name: 'NEXUS Society' },
    update: {},
    create: {
      name: 'NEXUS Society',
      description:
        'Interdisciplinary leadership, innovation and mega events across university departments.',
      category: 'Academic',
      contactEmail: 'nexus@unisphere.test',
      contactPhone: '+92 300 7654321',
      presidentId: president2.id,
    },
  })

  const students = [] as { id: string; name: string }[]
  for (let i = 1; i <= 5; i++) {
    const u = await db.user.upsert({
      where: { email: `student${i}@unisphere.test` },
      update: {},
      create: {
        email: `student${i}@unisphere.test`,
        name: `Student ${i}`,
        passwordHash: passHash,
        role: 'STUDENT',
      },
    })
    students.push({ id: u.id, name: u.name })
  }

  const society = await db.society.upsert({
    where: { name: 'Tech Society' },
    update: {},
    create: {
      name: 'Tech Society',
      description:
        'The campus technology society: workshops, hackathons and seminars that help students build real projects together.',
      category: 'Technology',
      contactEmail: 'tech@unisphere.test',
      contactPhone: '+92 300 1234567',
      presidentId: president1.id,
    },
  })

  // memberships: one row per (society, student) that flips status on re-request
  const membership = (studentId: string, status: string, label: string) =>
    db.membership.upsert({
      where: {
        societyId_studentId: { societyId: society.id, studentId },
      },
      update: { status, label },
      create: { societyId: society.id, studentId, status, label },
    })

  await membership(students[0].id, 'APPROVED', 'CORE_MEMBER')
  await membership(students[1].id, 'APPROVED', 'MEMBER')
  await membership(students[2].id, 'PENDING', 'MEMBER')

  // ---- Events (times in the future, PKT) ----
  const aiStart = pkt(7, 14)
  const aiEnd = pkt(7, 17)
  const aiDeadline = pkt(5, 23, 59)

  const ai = await db.event.upsert({
    where: { id: 'seed-ai-workshop' },
    update: {},
    create: {
      id: 'seed-ai-workshop',
      societyId: society.id,
      title: 'AI Workshop',
      description:
        'Hands-on workshop covering practical machine learning: datasets, models, evaluation and a mini project. Beginners welcome.',
      venue: 'Computer Lab 2, Block C',
      startAt: aiStart,
      endAt: aiEnd,
      regDeadline: aiDeadline,
      capacity: 3,
      regCount: 2,
      proposedBudget: 50000,
      approvedBudget: 50000,
      approvalStatus: 'APPROVED',
      adminRemarks: 'Approved for the semester activities plan.',
      decidedAt: new Date(),
    },
  })

  const hackStart = pkt(14, 9)
  const hack = await db.event.upsert({
    where: { id: 'seed-hackathon' },
    update: {},
    create: {
      id: 'seed-hackathon',
      societyId: society.id,
      title: 'Hackathon',
      description:
        '24-hour inter-university hackathon with mentorship, prizes and demo judging. Teams of up to four.',
      venue: 'Main Auditorium',
      startAt: hackStart,
      endAt: pkt(15, 9),
      regDeadline: pkt(12, 23, 59),
      capacity: 60,
      proposedBudget: 120000,
      approvalStatus: 'PENDING',
    },
  })

  await db.event.upsert({
    where: { id: 'seed-seminar' },
    update: {},
    create: {
      id: 'seed-seminar',
      societyId: society.id,
      title: 'Seminar',
      description:
        'Seminar on emerging trends in software engineering with guest speakers from industry.',
      venue: 'Seminar Hall',
      startAt: pkt(21, 11),
      endAt: pkt(21, 13),
      regDeadline: pkt(19, 23, 59),
      capacity: 80,
      proposedBudget: 30000,
      approvalStatus: 'DRAFT',
    },
  })

  await db.event.upsert({
    where: { id: 'seed-old-meetup' },
    update: {},
    create: {
      id: 'seed-old-meetup',
      societyId: society.id,
      title: 'Old Meetup',
      description:
        'A past community meetup — kept for the record. Viewable by direct link only, registration closed.',
      venue: 'Common Room',
      startAt: pkt(-10, 16),
      endAt: pkt(-10, 18),
      regDeadline: pkt(-12, 23, 59),
      capacity: 40,
      regCount: 0,
      proposedBudget: 15000,
      approvedBudget: 15000,
      approvalStatus: 'APPROVED',
      adminRemarks: 'Approved.',
      decidedAt: new Date(),
    },
  })

  // registrations for the AI workshop (2 of 3 seats filled)
  const reg = (eventId: string, studentId: string, status: string) =>
    db.registration.upsert({
      where: { eventId_studentId: { eventId, studentId } },
      update: { status },
      create: { eventId, studentId, status },
    })

  await reg(ai.id, students[0].id, 'REGISTERED')
  await reg(ai.id, students[1].id, 'REGISTERED')

  // one accepted volunteer invitation
  await db.invitation.upsert({
    where: {
      eventId_studentId: { eventId: ai.id, studentId: students[3].id },
    },
    update: { status: 'ACCEPTED' },
    create: {
      eventId: ai.id,
      studentId: students[3].id,
      status: 'ACCEPTED',
    },
  })
  await db.invitation.upsert({
    where: {
      eventId_studentId: { eventId: ai.id, studentId: students[4].id },
    },
    update: { status: 'PENDING' },
    create: {
      eventId: ai.id,
      studentId: students[4].id,
      status: 'PENDING',
    },
  })

  // tasks on the AI workshop
  const task = (
    id: string,
    title: string,
    description: string,
    priority: string,
    status: string,
    dueDays: number,
    assigneeId: string | null
  ) =>
    db.task.upsert({
      where: { id },
      update: {},
      create: {
        id,
        eventId: ai.id,
        title,
        description,
        priority,
        status,
        dueDate: pkt(dueDays, 12),
        assigneeId,
      },
    })

  await task(
    'seed-task-1',
    'Reserve lab',
    'Book Computer Lab 2 and check projector.',
    'HIGH',
    'COMPLETED',
    3,
    students[3].id
  )
  await task(
    'seed-task-2',
    'Print posters',
    'Design and print A3 posters for the workshop.',
    'MEDIUM',
    'COMPLETED',
    4,
    null
  )
  await task(
    'seed-task-3',
    'Prepare datasets',
    'Download and clean the demo datasets for the session.',
    'MEDIUM',
    'TODO',
    5,
    students[3].id
  )

  // expenses on the approved AI workshop (budget 50000)
  await db.expense.deleteMany({ where: { eventId: ai.id } })
  await db.expense.createMany({
    data: [
      {
        eventId: ai.id,
        title: 'Refreshments',
        amount: 8000,
        note: 'Tea and snacks for 30 participants',
        spentOn: new Date(),
      },
      {
        eventId: ai.id,
        title: 'Printing',
        amount: 4500,
        note: 'Posters and handouts',
        spentOn: new Date(),
      },
    ],
  })

  console.log('\n────────── Demo credentials ──────────')
  console.log(`ADMIN     admin@unisphere.test      / Admin@12345`)
  console.log(`PRESIDENT president1@unisphere.test / Pass@12345  (owns Tech Society)`)
  console.log(`PRESIDENT president2@unisphere.test / Pass@12345  (owns NEXUS Society)`)
  for (let i = 1; i <= 5; i++)
    console.log(`STUDENT   student${i}@unisphere.test / Pass@12345`)
  console.log('──────────────────────────────────────\n')
  console.log(`Admin user id: ${admin.id}`)
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
