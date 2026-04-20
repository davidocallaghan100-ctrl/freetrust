export const dynamic = 'force-dynamic'
// ============================================================================
// GET  /api/calendar/google/settings  — fetch sync preference flags
// PATCH /api/calendar/google/settings — update sync preference flags
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: tokenRow } = await admin
      .from('google_calendar_tokens')
      .select('sync_ft_to_google, sync_google_to_ft, synced_at, scope')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      connected:         !!tokenRow,
      sync_ft_to_google: tokenRow?.sync_ft_to_google ?? true,
      sync_google_to_ft: tokenRow?.sync_google_to_ft ?? true,
      synced_at:         tokenRow?.synced_at ?? null,
    })
  } catch (err) {
    console.error('[GET /api/calendar/google/settings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      sync_ft_to_google?: boolean
      sync_google_to_ft?: boolean
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('google_calendar_tokens')
      .update({
        ...(body.sync_ft_to_google !== undefined && { sync_ft_to_google: body.sync_ft_to_google }),
        ...(body.sync_google_to_ft !== undefined && { sync_google_to_ft: body.sync_google_to_ft }),
      })
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/calendar/google/settings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
