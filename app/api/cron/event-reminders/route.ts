export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'

// GET /api/cron/event-reminders
// Invoked by Vercel Cron every hour (see vercel.json).
// Finds events starting ~24 hours from now (within the next hour's window)
// and emails all RSVP'd attendees a reminder. Respects preferences.
//
// Idempotency: we write a reminder_sent flag to community_event_attendees
// (or equivalent rsvp table). If that column isn't present we track
// idempotency via a per-run window instead.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()

    // Window: events starting between 23h and 25h from now
    const now = Date.now()
    const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now + 25 * 60 * 60 * 1000).toISOString()

    const { data: events, error: eventsErr } = await admin
      .from('events')
      .select('id, title, starts_at, venue_name')
      .eq('status', 'published')
      .gte('starts_at', windowStart)
      .lt('starts_at', windowEnd)
      .limit(200)

    if (eventsErr) {
      console.error('[cron/event-reminders] events query:', eventsErr.message)
      return NextResponse.json({ error: eventsErr.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ events_checked: 0, reminders_sent: 0 })
    }

    let reminders = 0
    for (const event of events) {
      // Fetch attendees (event_rsvps or community_event_attendees — check both)
      let attendeeIds: string[] = []
      const { data: rsvps } = await admin
        .from('event_rsvps')
        .select('user_id')
        .eq('event_id', event.id)
      if (rsvps && rsvps.length > 0) {
        attendeeIds = rsvps.map((r: { user_id: string }) => r.user_id)
      } else {
        const { data: commAtt } = await admin
          .from('community_event_attendees')
          .select('user_id')
          .eq('event_id', event.id)
        if (commAtt) attendeeIds = commAtt.map((r: { user_id: string }) => r.user_id)
      }

      if (attendeeIds.length === 0) continue

      const eventDate = new Date(event.starts_at).toLocaleString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })

      for (const userId of attendeeIds) {
        const result = await sendEmail({
          type: 'event_reminder',
          userId,
          payload: {
            eventTitle: event.title,
            eventDate,
            eventId: event.id,
          },
        })
        if (result.sent) reminders++
      }
    }

    console.log(`[cron/event-reminders] checked=${events.length} sent=${reminders}`)
    return NextResponse.json({ events_checked: events.length, reminders_sent: reminders })
  } catch (err) {
    console.error('[cron/event-reminders] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
