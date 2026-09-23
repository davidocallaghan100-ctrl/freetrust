import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_DAYS = new Set([7, 30, 90])

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const requestedDays = Number(request.nextUrl.searchParams.get('days') ?? 30)
    const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 30
    const since = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString()

    const [profileResult, eventsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, username, trust_balance')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('analytics_events')
        .select('id,user_id,actor_id,event_type,entity_type,entity_id,metadata,created_at')
        .eq('user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000),
    ])

    if (eventsResult.error) {
      console.error('[GET /api/analytics] events query failed:', eventsResult.error.message)
      return NextResponse.json({ error: 'Analytics is temporarily unavailable' }, { status: 503 })
    }
    if (profileResult.error) {
      console.warn('[GET /api/analytics] profile summary unavailable:', profileResult.error.message)
    }

    return NextResponse.json(
      { profile: profileResult.data ?? null, events: eventsResult.data ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[GET /api/analytics] unhandled:', error)
    return NextResponse.json({ error: 'Analytics is temporarily unavailable' }, { status: 503 })
  }
}
