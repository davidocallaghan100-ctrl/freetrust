export const dynamic = 'force-dynamic'
// ============================================================================
// POST /api/calendar/google/connect
// Generates the Google OAuth2 URL scoped to the minimum Calendar access needed
// for FreeTrust's two-way event sync and returns it.
// The client redirects the user to this URL.  After consent, Google redirects
// back to GOOGLE_REDIRECT_URI (/api/calendar/google/callback).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { google }                    from 'googleapis'

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauth2 = buildOAuth2Client()

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt:      'consent',   // force consent screen so we always get refresh_token
      include_granted_scopes: true,
      scope: [
        // Minimal scope for reading and writing events on the user's calendars.
        // Do not request https://www.googleapis.com/auth/calendar here: it grants
        // broader calendar-management access and makes Google verification harder.
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state: user.id,           // pass user id through OAuth flow
    })

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[POST /api/calendar/google/connect]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
