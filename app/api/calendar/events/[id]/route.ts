export const dynamic = 'force-dynamic'
// ============================================================================
// PATCH  /api/calendar/events/[id]  — update a calendar event
// DELETE /api/calendar/events/[id]  — delete a calendar event
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import type { UpdateEventPayload }   from '@/types/calendar'

// ── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership via RLS-aware client
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id, user_id, source_type')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = await req.json() as Partial<UpdateEventPayload>
    const admin = createAdminClient()

    const { data: event, error } = await admin
      .from('calendar_events')
      .update({
        ...(body.title        !== undefined && { title:       body.title }),
        ...(body.description  !== undefined && { description: body.description }),
        ...(body.start_at     !== undefined && { start_at:    body.start_at }),
        ...(body.end_at       !== undefined && { end_at:      body.end_at }),
        ...(body.all_day      !== undefined && { all_day:     body.all_day }),
        ...(body.location     !== undefined && { location:    body.location }),
        ...(body.color        !== undefined && { color:       body.color }),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/calendar/events/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event })
  } catch (err) {
    console.error('[PATCH /api/calendar/events/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[DELETE /api/calendar/events/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/calendar/events/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
