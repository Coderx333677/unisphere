import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { fmtPKT } from '@/lib/time'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const eventId = params.id
  const ev = await db.event.findUnique({
    where: { id: eventId },
    include: {
      society: true,
      expenses: { orderBy: { spentOn: 'desc' } },
    },
  })

  if (!ev) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Only the society president or an administrator may download the expense report
  if (user.role !== 'ADMIN' && ev.society.presidentId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const spent = ev.expenses.reduce((s, x) => s + x.amount, 0)
  const approvedBudget = ev.approvedBudget ?? 0
  const remaining = approvedBudget - spent

  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []

  doc.on('data', (chunk) => chunks.push(chunk))

  // Header
  doc.fontSize(22).font('Helvetica-Bold').text('UniSphere Financial Report', { align: 'center' })
  doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Generated on ' + fmtPKT(new Date()), { align: 'center' })
  doc.moveDown(1.5)

  // Event Details Box
  doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(ev.title)
  doc.fontSize(10).font('Helvetica').text(`Society: ${ev.society.name}`)
  doc.text(`Venue: ${ev.venue}`)
  doc.text(`Schedule (PKT): ${fmtPKT(ev.startAt)} to ${fmtPKT(ev.endAt)}`)
  doc.moveDown(1)

  // Budget Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Budget Summary')
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(550, doc.y).stroke()
  doc.moveDown(0.5)

  doc.fontSize(10).font('Helvetica')
  doc.text(`Approved Budget:  PKR ${approvedBudget.toLocaleString()}`)
  doc.text(`Total Recorded Expenses:  PKR ${spent.toLocaleString()}`)
  
  if (remaining < 0) {
    doc.fillColor('#dc2626').font('Helvetica-Bold')
    doc.text(`Remaining Balance:  PKR ${remaining.toLocaleString()} [OVER BUDGET]`)
  } else {
    doc.fillColor('#16a34a').font('Helvetica-Bold')
    doc.text(`Remaining Balance:  PKR ${remaining.toLocaleString()}`)
  }
  doc.moveDown(1.5)

  // Expenses Table
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Recorded Expenses')
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(550, doc.y).stroke()
  doc.moveDown(0.5)

  if (ev.expenses.length === 0) {
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b').text('No expenses recorded for this event.')
  } else {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155')
    doc.text('Date', 40, doc.y, { width: 90, continued: true })
    doc.text('Title / Item', 130, doc.y, { width: 220, continued: true })
    doc.text('Note', 350, doc.y, { width: 100, continued: true })
    doc.text('Amount (PKR)', 450, doc.y, { width: 100, align: 'right' })
    doc.moveDown(0.5)

    doc.font('Helvetica').fillColor('#0f172a')
    for (const exp of ev.expenses) {
      const y = doc.y
      if (y > 740) {
        doc.addPage()
      }
      doc.text(fmtPKT(exp.spentOn), 40, doc.y, { width: 90, continued: true })
      doc.text(exp.title, 130, doc.y, { width: 220, continued: true })
      doc.text(exp.note || '—', 350, doc.y, { width: 100, continued: true })
      doc.text(`PKR ${exp.amount.toLocaleString()}`, 450, doc.y, { width: 100, align: 'right' })
      doc.moveDown(0.3)
    }
  }

  doc.end()

  await new Promise<void>((resolve) => doc.on('end', () => resolve()))

  const pdfBuffer = Buffer.concat(chunks)

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="unisphere-report-${ev.id}.pdf"`,
    },
  })
}
