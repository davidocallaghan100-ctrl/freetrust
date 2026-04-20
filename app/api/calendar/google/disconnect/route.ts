export const dynamic = 'force-dynamic'
// ============================================================================
// POST /api/calendar/google/disconnect
// Revokes the Google OAuth token and removes the token row + any Google-sourced
// calendar events from the local DB.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { google }                    from 'googleapis'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch existing token so we can revoke it with Google
    const { data: tokenRow } = await admin
      .from('google_calendar_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    if (tokenRow?.access_token) {
      try {
        const oauth2 = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
        )
        await oauth2.revokeToken(tokenRow.access_token)
      } catch (revokeErr) {
        // Non-fatal — token may already be expired; we still delete locally
        console.warn('[Google disconnect] revoke failed (non-fatal):', revokeErr)
      }
    }

    // Delete the token row
    await admin
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id)

    // Delete all Google-sourced calendar events (they came from the pull sync)
    // We keep source_type != 'manual' events since those are FreeTrust-native
    await admin
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id)
      .not('google_event_id', 'is', null)
      .eq('source_type', 'manual')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/calendar/google/disconnect]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
