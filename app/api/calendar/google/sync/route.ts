export const dynamic = 'force-dynamic'
// ============================================================================
// POST /api/calendar/google/sync
// Two-way sync between FreeTrust calendar_events and Google Calendar.
//
// Pull: fetches Google events updated since last sync and upserts them into
//       calendar_events (source_type='manual', google_event_id set).
// Push: finds local events modified since last sync that have no
//       google_event_id yet and creates them in Google Calendar.
//
// Loop guard: compares updated_at to last synced_at to avoid re-processing
//             events that were created by a previous sync pass.
// ============================================================================
import { NextRequest, NextResponse }   from 'next/server'
import { createClient }                from '@/lib/supabase/server'
import { createAdminClient }           from '@/lib/supabase/admin'
import { google }                      from 'googleapis'
import type { GoogleCalendarTokenRow } from '@/types/calendar'

function buildOAuth2Client(token: GoogleCalendarTokenRow) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  oauth2.setCredentials({
    access_token:  token.access_token,
    refresh_token: token.refresh_token ?? undefined,
    expiry_date:   token.expires_at ? new Date(token.expires_at).getTime() : undefined,
  })
  return oauth2
}

class TokenExpiredError extends Error {
  constructor() { super('Google token expired and could not be refreshed. Please reconnect Google Calendar.') }
}

async function refreshTokenIfNeeded(
  oauth2: ReturnType<typeof buildOAuth2Client>,
  token:  GoogleCalendarTokenRow,
  admin:  ReturnType<typeof createAdminClient>,
) {
  const now = Date.now()
  const expiry = token.expires_at ? new Date(token.expires_at).getTime() : 0

  if (expiry - now < 5 * 60 * 1000) {
    // Token expired or expires in < 5 min — refresh
    try {
      const { credentials } = await oauth2.refreshAccessToken()
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null

      await admin
        .from('google_calendar_tokens')
        .update({
          access_token: credentials.access_token!,
          expires_at:   newExpiry,
        })
        .eq('user_id', token.user_id)

      oauth2.setCredentials(credentials)
    } catch (refreshErr) {
      console.error('[Google sync] Token refresh failed:', refreshErr)
      // Delete the stale token so user is prompted to reconnect
      await admin
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', token.user_id)
      throw new TokenExpiredError()
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch the stored token
    const { data: tokenRow, error: tokenErr } = await admin
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (tokenErr || !tokenRow) {
      return NextResponse.json(
        { error: 'Please connect Google Calendar first', reconnect: true },
        { status: 400 }
      )
    }

    const token   = tokenRow as GoogleCalendarTokenRow
    const oauth2  = buildOAuth2Client(token)
    try {
      await refreshTokenIfNeeded(oauth2, token, admin)
    } catch (refreshErr) {
      if (refreshErr instanceof TokenExpiredError) {
        return NextResponse.json(
          { error: 'Google Calendar disconnected — please reconnect to sync.', reconnect: true },
          { status: 401 }
        )
      }
      throw refreshErr
    }

    const calendar   = google.calendar({ version: 'v3', auth: oauth2 })
    const syncedAt   = token.synced_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const nowIso     = new Date().toISOString()

    let pulled = 0
    let pushed = 0

    // ── PULL: Google → FreeTrust ──────────────────────────────────────────
    if (token.sync_google_to_ft) {
      const { data: gList } = await calendar.events.list({
        calendarId:   'primary',
        updatedMin:   syncedAt,
        singleEvents: true,
        maxResults:   250,
        orderBy:      'updated',
      })

      for (const gEvent of gList?.items ?? []) {
        if (!gEvent.id || gEvent.status === 'cancelled') {
          // Remove deleted Google events from our store
          if (gEvent.id) {
            await admin
              .from('calendar_events')
              .delete()
              .eq('google_event_id', gEvent.id)
              .eq('user_id', user.id)
          }
          continue
        }

        const startRaw = gEvent.start?.dateTime ?? gEvent.start?.date
        if (!startRaw) continue

        const startAt  = new Date(startRaw).toISOString()
        const endRaw   = gEvent.end?.dateTime ?? gEvent.end?.date
        const endAt    = endRaw ? new Date(endRaw).toISOString() : null
        const allDay   = !gEvent.start?.dateTime

        const upsertPayload = {
          user_id:         user.id,
          title:           gEvent.summary ?? '(No title)',
          description:     gEvent.description ?? null,
          start_at:        startAt,
          end_at:          endAt,
          all_day:         allDay,
          location:        gEvent.location ?? null,
          source_type:     'manual' as const,
          google_event_id: gEvent.id,
          color:           '#64748b',
          updated_at:      nowIso,
        }

        // Upsert by google_event_id + user_id
        const { data: existing } = await admin
          .from('calendar_events')
          .select('id, updated_at')
          .eq('google_event_id', gEvent.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existing) {
          // Loop guard: only update if Google's version is newer
          const localUpdated = new Date(existing.updated_at).getTime()
          const googleUpdated = gEvent.updated ? new Date(gEvent.updated).getTime() : 0
          if (googleUpdated > localUpdated) {
            await admin
              .from('calendar_events')
              .update(upsertPayload)
              .eq('id', existing.id)
            pulled++
          }
        } else {
          await admin.from('calendar_events').insert(upsertPayload)
          pulled++
        }
      }
    }

    // ── PUSH: FreeTrust → Google ──────────────────────────────────────────
    if (token.sync_ft_to_google) {
      const { data: localEvents } = await admin
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .is('google_event_id', null)
        .gte('updated_at', syncedAt)
        .neq('source_type', 'manual')   // only push FreeTrust-native items

      for (const ev of localEvents ?? []) {
        try {
          const gEvent = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary:     ev.title,
              description: ev.description ?? undefined,
              location:    ev.location ?? undefined,
              start: ev.all_day
                ? { date: ev.start_at.slice(0, 10) }
                : { dateTime: ev.start_at },
              end: ev.all_day
                ? { date: (ev.end_at ?? ev.start_at).slice(0, 10) }
                : { dateTime: ev.end_at ?? ev.start_at },
              source: {
                title: 'FreeTrust',
                url:   `https://freetrust.co/calendar`,
              },
            },
          })

          if (gEvent.data.id) {
            await admin
              .from('calendar_events')
              .update({ google_event_id: gEvent.data.id })
              .eq('id', ev.id)
            pushed++
          }
        } catch (pushErr) {
          console.error('[Google sync push] failed for event', ev.id, pushErr)
        }
      }
    }

    // Update synced_at timestamp
    await admin
      .from('google_calendar_tokens')
      .update({ synced_at: nowIso })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, pulled, pushed, synced_at: nowIso })
  } catch (err) {
    console.error('[POST /api/calendar/google/sync]', err)
    // Return a friendlier error message
    const message = err instanceof Error ? err.message : 'Sync failed'
    // Check for common Google API errors
    if (message.includes('invalid_grant') || message.includes('Token has been expired')) {
      return NextResponse.json(
        { error: 'Google Calendar access expired. Please reconnect.', reconnect: true },
        { status: 401 }
      )
    }
    if (message.includes('insufficient') || message.includes('forbidden') || message.includes('403')) {
      return NextResponse.json(
        { error: 'Google Calendar permission denied. Please reconnect.', reconnect: true },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: 'Calendar sync failed. Please try again.', reconnect: false }, { status: 500 })
  }
}
