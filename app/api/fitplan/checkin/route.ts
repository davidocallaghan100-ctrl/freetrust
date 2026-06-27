export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentWeekStart, FITPLAN_COSTS } from '@/lib/fitplan/constants'
import { generateCheckinFeedback } from '@/lib/fitplan/ai'
import { issueTrust } from '@/lib/fitplan/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { wins?: string; blockers?: string; adherence?: number; share_to_feed?: boolean } | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const wins = (body.wins ?? '').trim().slice(0, 1200)
  const blockers = (body.blockers ?? '').trim().slice(0, 1200)
  const adherence = typeof body.adherence === 'number' && Number.isFinite(body.adherence) ? Math.min(100, Math.max(0, body.adherence)) : null
  if (!wins && !blockers && adherence === null) return NextResponse.json({ error: 'Add at least one check-in detail' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: profile }, { data: plan }] = await Promise.all([
    admin.from('fitplan_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('fitplan_plans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!profile?.agreed_terms) return NextResponse.json({ error: 'Complete FitPlan onboarding first' }, { status: 400 })

  const weekStart = currentWeekStart()
  const feedback = await generateCheckinFeedback({ profile: profile as any, plan: plan?.plan_json ?? null, wins, blockers, adherence })
  let feedPostId: string | null = null
  if (body.share_to_feed === true) {
    const content = `FitPlan weekly check-in 🏋️\n\n${wins ? `Win: ${wins}\n` : ''}${blockers ? `Working on: ${blockers}\n` : ''}${adherence !== null ? `Adherence: ${adherence}%\n` : ''}`.trim()
    const { data: post, error: feedError } = await admin.from('feed_posts').insert({ user_id: user.id, type: 'fitplan', title: 'FitPlan weekly check-in', content, trust_reward: 0 }).select('id').single()
    if (feedError) console.warn('[FitPlan checkin] feed share skipped:', feedError.message)
    feedPostId = post?.id ?? null
  }

  const { data, error } = await admin.from('fitplan_checkins').upsert({
    user_id: user.id,
    plan_id: plan?.id ?? null,
    week_start: weekStart,
    wins,
    blockers,
    adherence,
    ai_feedback: feedback,
    reward_trust: FITPLAN_COSTS.checkinReward,
    share_to_feed: body.share_to_feed === true,
    feed_post_id: feedPostId,
  }, { onConflict: 'user_id,week_start' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await issueTrust(user.id, FITPLAN_COSTS.checkinReward, 'fitplan_checkin_reward', data.id, 'FitPlan weekly check-in reward')
  } catch (err) {
    console.warn('[FitPlan checkin] reward skipped:', err)
  }

  return NextResponse.json({ checkin: data })
}
