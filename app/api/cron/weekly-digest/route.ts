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

    let sent = 0
    let skipped = 0
    let totalProcessed = 0
    let lastId: string | null = null
    const PAGE_SIZE = 100
    const BATCH = 25

    // Cursor-paginated fetch — processes ALL users regardless of count
    while (true) {
      let query = admin
        .from('profiles')
        .select('id')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .limit(PAGE_SIZE)

      if (lastId) query = query.gt('id', lastId)

      const { data: profiles, error: profErr } = await query

      if (profErr) {
        console.error('[cron/weekly-digest] profiles query:', profErr)
        return NextResponse.json({ error: profErr.message }, { status: 500 })
      }

      if (!profiles || profiles.length === 0) break

      lastId = profiles[profiles.length - 1].id
      totalProcessed += profiles.length

      const userIds = profiles.map((p: { id: string }) => p.id)

      // Process page in small batches to keep memory bounded
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

      // If we got fewer than a full page, we've reached the end
      if (profiles.length < PAGE_SIZE) break
    }

    console.log(`[cron/weekly-digest] total=${totalProcessed} sent=${sent} skipped=${skipped}`)
    return NextResponse.json({ total: totalProcessed, sent, skipped })
  } catch (err) {
    console.error('[cron/weekly-digest] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
