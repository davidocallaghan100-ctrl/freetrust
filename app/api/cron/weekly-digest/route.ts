export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'

// GET /api/cron/weekly-digest
// Invoked by Vercel Cron every Monday at 08:00 UTC (see vercel.json).
// Aggregates the last 7 days of activity for each active user and sends
// a weekly digest email. Respects notification_preferences.
//
// Auth: Vercel Cron invocations include an Authorization: Bearer <CRON_SECRET>
// header. Requests without the right secret are rejected (except in dev).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all profiles with an email (up to 1000 for now — pagination TODO)
    const { data: profiles, error: profErr } = await admin
      .from('profiles')
      .select('id')
      .not('email', 'is', null)
      .limit(1000)

    if (profErr) {
      console.error('[cron/weekly-digest] profiles query:', profErr)
      return NextResponse.json({ error: profErr.message }, { status: 500 })
    }

    const userIds = (profiles ?? []).map((p: { id: string }) => p.id)

    let sent = 0
    let skipped = 0

    // Process users in small batches to keep memory bounded
    const BATCH = 25
    for (let i = 0; i < userIds.length; i += BATCH) {
      const batch = userIds.slice(i, i + BATCH)

      await Promise.all(batch.map(async (userId) => {
        try {
          // Gather weekly stats in parallel
          const [followersRes, messagesRes, balanceRes] = await Promise.all([
            admin.from('user_follows')
              .select('id', { count: 'exact', head: true })
              .eq('following_id', userId)
              .gte('created_at', since),
            admin.from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('recipient_id', userId)
              .gte('created_at', since),
            admin.from('trust_balances')
              .select('balance')
              .eq('user_id', userId)
              .maybeSingle(),
          ])

          const newFollowers = followersRes.count ?? 0
          const newMessages  = messagesRes.count ?? 0
          const trustBalance = balanceRes.data?.balance ?? 0

          // Skip users who had zero activity AND zero trust
          if (newFollowers === 0 && newMessages === 0 && trustBalance === 0) {
            skipped++
            return
          }

          const result = await sendEmail({
            type: 'weekly_digest',
            userId,
            payload: {
              stats: {
                newMessages,
                newFollowers,
                profileViews: 0, // view tracking not implemented
                trustBalance,
              },
            },
          })
          if (result.sent) sent++
          else skipped++
        } catch (err) {
          console.error('[cron/weekly-digest] user error:', userId, err)
          skipped++
        }
      }))
    }

    console.log(`[cron/weekly-digest] total=${userIds.length} sent=${sent} skipped=${skipped}`)
    return NextResponse.json({ total: userIds.length, sent, skipped })
  } catch (err) {
    console.error('[cron/weekly-digest] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
