import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { calculateSubEventProgress } from '@/lib/mega-events'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'PRESIDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const megaEvent = await db.megaEvent.findUnique({
      where: { id: params.id },
      include: {
        society: true,
        subEvents: {
          include: {
            supervisor: { select: { name: true, email: true } },
            tasks: { select: { id: true, title: true, status: true, priority: true, assigneeId: true } },
            expenses: { select: { id: true, title: true, amount: true } },
          },
        },
      },
    })

    if (!megaEvent || megaEvent.presidentId !== user.id) {
      return NextResponse.json(
        { error: 'Mega Event not found or access denied' },
        { status: 404 }
      )
    }

    // 1. Calculate authoritative totals and percentages in backend code
    const totalAllocated = megaEvent.subEvents.reduce(
      (sum, s) => sum + s.allocation,
      0
    )
    const availableAllocation = megaEvent.overallBudget - totalAllocated
    const totalSpent = megaEvent.subEvents.reduce(
      (sum, s) => sum + s.expenses.reduce((es, e) => es + e.amount, 0),
      0
    )

    const subEventsAnalysis = megaEvent.subEvents.map((s) => {
      const spent = s.expenses.reduce((sum, e) => sum + e.amount, 0)
      const remaining = s.allocation - spent
      const progress = calculateSubEventProgress(s.tasks)
      const unassignedTasks = s.tasks.filter((t) => !t.assigneeId).length
      const highPriorityTasks = s.tasks.filter(
        (t) => t.priority === 'HIGH' && t.status !== 'COMPLETED'
      ).length
      const spendingPct = s.allocation > 0 ? Math.round((spent / s.allocation) * 100) : 0

      return {
        title: s.title,
        venue: s.venue,
        supervisor: s.supervisor.name,
        allocation: s.allocation,
        spent,
        remaining,
        spendingPct,
        totalTasks: s.tasks.length,
        completedTasks: s.tasks.filter((t) => t.status === 'COMPLETED').length,
        taskProgressPct: progress,
        unassignedTasks,
        highPriorityTasks,
      }
    })

    const payloadFacts = {
      eventTitle: megaEvent.title,
      society: megaEvent.society.name,
      overallBudgetPKR: megaEvent.overallBudget,
      totalAllocatedPKR: totalAllocated,
      availableAllocationPKR: availableAllocation,
      totalSpentPKR: totalSpent,
      subEventsCount: megaEvent.subEvents.length,
      subEvents: subEventsAnalysis,
    }

    // Check if an AI API key is set
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `You are an executive operations consultant reviewing a university Mega Event.
Here are the verified authoritative statistics calculated from actual database records:
${JSON.stringify(payloadFacts, null, 2)}

Provide a concise, professional analysis in JSON format with three fields:
1. "observations": Array of 2-3 concise factual observations on budget utilization and task velocity.
2. "potentialIssues": Array of 1-3 identified bottlenecks (e.g. unassigned tasks, high spending ratio vs low progress, unallocated budget).
3. "recommendations": Array of 2-3 practical recommendations for the Society President.

Respond ONLY with valid JSON matching { "observations": string[], "potentialIssues": string[], "recommendations": string[] }.`,
                    },
                  ],
                },
              ],
            }),
          }
        )

        if (response.ok) {
          const data = await response.json()
          const text =
            data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          return NextResponse.json({
            success: true,
            analysis: parsed,
            source: 'Gemini AI',
          })
        }
      } catch (aiErr) {
        console.error('Gemini API call failed, falling back to analytical rules:', aiErr)
      }
    }

    // Fallback analytical generator (deterministic & reliable based on actual DB rows)
    const observations: string[] = [
      `Overall budget is PKR ${megaEvent.overallBudget.toLocaleString()} with PKR ${totalAllocated.toLocaleString()} allocated across ${megaEvent.subEvents.length} sub-events.`,
      `Total recorded spending currently stands at PKR ${totalSpent.toLocaleString()} with ${subEventsAnalysis.reduce((acc, s) => acc + s.completedTasks, 0)} out of ${subEventsAnalysis.reduce((acc, s) => acc + s.totalTasks, 0)} preparation tasks marked completed.`,
    ]

    const potentialIssues: string[] = []
    const recommendations: string[] = []

    for (const sub of subEventsAnalysis) {
      if (sub.spendingPct >= 80) {
        potentialIssues.push(
          `Sub-event "${sub.title}" has consumed ${sub.spendingPct}% of its allocation (PKR ${sub.spent.toLocaleString()} / PKR ${sub.allocation.toLocaleString()}).`
        )
      }
      if (sub.totalTasks === 0) {
        potentialIssues.push(
          `Sub-event "${sub.title}" has 0 preparation tasks defined.`
        )
        recommendations.push(
          `Add initial preparation tasks for supervisor ${sub.supervisor} under "${sub.title}".`
        )
      }
      if (sub.unassignedTasks > 0) {
        recommendations.push(
          `Assign students to the ${sub.unassignedTasks} unassigned task(s) in "${sub.title}".`
        )
      }
    }

    if (availableAllocation > 0) {
      observations.push(
        `PKR ${availableAllocation.toLocaleString()} remains unallocated in the general Mega Event budget pool.`
      )
    }

    if (potentialIssues.length === 0) {
      potentialIssues.push('No critical spending or scheduling blockers identified at this stage.')
    }
    if (recommendations.length === 0) {
      recommendations.push(
        'Maintain daily sync with student supervisors to keep task progress in line with milestone dates.'
      )
    }

    return NextResponse.json({
      success: true,
      analysis: {
        observations,
        potentialIssues,
        recommendations,
      },
      source: 'UniSphere Analytics Engine',
    })
  } catch (error) {
    console.error('AI Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to generate operational report.' },
      { status: 500 }
    )
  }
}
