export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FITPLAN_COSTS } from '@/lib/fitplan/constants'
import { refundTrust, spendTrust } from '@/lib/fitplan/server'
import { answerFitPlanCoach } from '@/lib/fitplan/ai'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { message?: string } | null
  const question = body?.message?.trim()
  if (!question) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (question.length > 1600) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: profile }, { data: plan }, { data: recentMessages }] = await Promise.all([
    admin.from('fitplan_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('fitplan_plans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('fitplan_coach_messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
  ])
  if (!profile?.agreed_terms) return NextResponse.json({ error: 'Complete FitPlan onboarding first' }, { status: 400 })

  try {
    await spendTrust(user.id, FITPLAN_COSTS.coachMessage, 'fitplan_coach_message', 'FitPlan coach message')
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    return NextResponse.json({ error: msg.includes('insufficient_funds') ? 'Insufficient Trust Coins' : msg, code: msg.includes('insufficient_funds') ? 'insufficient_funds' : 'spend_failed', required: FITPLAN_COSTS.coachMessage }, { status: msg.includes('insufficient_funds') ? 402 : 500 })
  }

  try {
    await admin.from('fitplan_coach_messages').insert({ user_id: user.id, plan_id: plan?.id ?? null, role: 'user', content: question, cost_trust: FITPLAN_COSTS.coachMessage })
    const answer = await answerFitPlanCoach({ profile: profile as any, plan: plan?.plan_json ?? null, question, recentMessages: (recentMessages ?? []).reverse() })
    const safetyFlags = { doctor_clearance: profile.doctor_clearance, has_injuries: Boolean(profile.injuries) }
    const { data, error } = await admin.from('fitplan_coach_messages').insert({ user_id: user.id, plan_id: plan?.id ?? null, role: 'assistant', content: answer, safety_flags: safetyFlags }).select('*').single()
    if (error) throw error
    return NextResponse.json({ message: data })
  } catch (err) {
    await refundTrust(user.id, FITPLAN_COSTS.coachMessage, 'fitplan_coach_refund', 'Refund: FitPlan coach message failed')
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
