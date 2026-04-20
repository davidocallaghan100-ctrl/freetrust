export const dynamic = 'force-dynamic'
// ============================================================================
// GET  /api/calendar/events?from=<ISO>&to=<ISO>
//   Returns the authenticated user's unified calendar feed between two dates.
// POST /api/calendar/events
//   Creates a manual event or reminder.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import type { CreateEventPayload }   from '@/types/calendar'

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_at', { ascending: true })

    if (from) query = query.gte('start_at', from)
    if (to)   query = query.lte('start_at', to)

    const { data, error } = await query.limit(500)

    if (error) {
      // Table may not exist yet (migration not run)
      if (error.code === '42P01') {
        return NextResponse.json({ events: [] })
      }
      console.error('[GET /api/calendar/events]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data ?? [] })
  } catch (err) {
    console.error('[GET /api/calendar/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as CreateEventPayload

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!body.start_at) {
      return NextResponse.json({ error: 'start_at is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: event, error } = await admin
      .from('calendar_events')
      .insert({
        user_id:     user.id,
        title:       body.title.trim(),
        description: body.description ?? null,
        start_at:    body.start_at,
        end_at:      body.end_at ?? null,
        all_day:     body.all_day ?? false,
        location:    body.location ?? null,
        source_type: body.source_type ?? 'manual',
        color:       body.color ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/calendar/events]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/calendar/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
