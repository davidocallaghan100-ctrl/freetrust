export const dynamic = 'force-dynamic'
// ============================================================================
// GET /api/calendar/google/callback
// Handles the Google OAuth2 redirect after the user approves calendar access.
// Exchanges the code for tokens and stores them in google_calendar_tokens.
// Redirects the user back to /calendar on success.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { google }                    from 'googleapis'

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code    = searchParams.get('code')
    const state   = searchParams.get('state')   // user_id passed through
    const errParam = searchParams.get('error')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://freetrust.co'

    if (errParam) {
      return NextResponse.redirect(`${baseUrl}/calendar?google_error=${encodeURIComponent(errParam)}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/calendar?google_error=missing_code`)
    }

    const oauth2 = buildOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(`${baseUrl}/calendar?google_error=no_access_token`)
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null

    const admin = createAdminClient()
    const { error } = await admin
      .from('google_calendar_tokens')
      .upsert({
        user_id:       state,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at:    expiresAt,
        scope:         tokens.scope ?? null,
        synced_at:     null,
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('[Google OAuth callback] token upsert error:', error)
      return NextResponse.redirect(`${baseUrl}/calendar?google_error=db_error`)
    }

    return NextResponse.redirect(`${baseUrl}/calendar?google_connected=1`)
  } catch (err) {
    console.error('[GET /api/calendar/google/callback]', err)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://freetrust.co'
    return NextResponse.redirect(`${baseUrl}/calendar?google_error=server_error`)
  }
}
