export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendFirstListingNudgeEmail, sendProfilePhotoNudgeEmail } from '@/lib/resend'
import { insertNotification } from '@/lib/notifications/insert'

// GET /api/cron/onboarding-sequence
// Runs every hour (see vercel.json).
//
// Sends two drip emails to new users:
//   - Email 2 (24h after signup): nudge to add first listing
//   - Email 3 (48h after signup, no avatar): nudge to upload a profile photo
//
// Uses `onboarding_sequence_log` to ensure each email is sent at most once.
// Respects CRON_SECRET for production auth.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // ── Email 2: first listing nudge — users who signed up 23–25 hours ago ──────
  const nudge24hFrom = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString()
  const nudge24hTo   = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString()

  const { data: listing24h, error: err24h } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .not('email', 'is', null)
    .gte('created_at', nudge24hFrom)
    .lte('created_at', nudge24hTo)

  let sent24 = 0
  let skipped24 = 0

  if (err24h) {
    console.error('[cron/onboarding-sequence] 24h profiles query error:', err24h)
  } else {
    for (const profile of listing24h ?? []) {
      try {
        // Check if already sent
        const { data: alreadySent } = await admin
          .from('onboarding_sequence_log')
          .select('id')
          .eq('user_id', profile.id)
          .eq('email_type', 'first_listing_nudge')
          .maybeSingle()

        if (alreadySent) { skipped24++; continue }

        const to   = profile.email as string
        const name = (profile.full_name as string | null) ?? 'there'

        await sendFirstListingNudgeEmail(to, name)

        // Log the send
        await admin.from('onboarding_sequence_log').insert({
          user_id:    profile.id,
          email_type: 'first_listing_nudge',
        })

        // In-app notification
        await insertNotification({
          userId: profile.id,
          type:   'onboarding_nudge',
          title:  'Add your first listing',
          body:   'Start selling on FreeTrust — your first listing earns ₮25 Trust.',
          link:   '/create',
        })

        sent24++
      } catch (err) {
        console.error('[cron/onboarding-sequence] 24h send error:', profile.id, err)
        skipped24++
      }
    }
  }

  // ── Email 3: profile photo nudge — users who signed up 47–49 hours ago, no avatar ──
  const nudge48hFrom = new Date(now.getTime() - 49 * 60 * 60 * 1000).toISOString()
  const nudge48hTo   = new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString()

  const { data: photo48h, error: err48h } = await admin
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .not('email', 'is', null)
    .gte('created_at', nudge48hFrom)
    .lte('created_at', nudge48hTo)

  let sent48 = 0
  let skipped48 = 0

  if (err48h) {
    console.error('[cron/onboarding-sequence] 48h profiles query error:', err48h)
  } else {
    for (const profile of photo48h ?? []) {
      try {
        // Skip users who already have a profile photo
        const hasPhoto = profile.avatar_url && (profile.avatar_url as string).trim() !== ''
        if (hasPhoto) { skipped48++; continue }

        // Check if already sent
        const { data: alreadySent } = await admin
          .from('onboarding_sequence_log')
          .select('id')
          .eq('user_id', profile.id)
          .eq('email_type', 'profile_photo_nudge')
          .maybeSingle()

        if (alreadySent) { skipped48++; continue }

        const to   = profile.email as string
        const name = (profile.full_name as string | null) ?? 'there'

        await sendProfilePhotoNudgeEmail(to, name)

        // Log the send
        await admin.from('onboarding_sequence_log').insert({
          user_id:    profile.id,
          email_type: 'profile_photo_nudge',
        })

        // In-app notification
        await insertNotification({
          userId: profile.id,
          type:   'onboarding_nudge',
          title:  'Add a profile photo',
          body:   'Members with a face photo get 3x more engagement. Tap to update yours.',
          link:   '/settings/profile',
        })

        sent48++
      } catch (err) {
        console.error('[cron/onboarding-sequence] 48h send error:', profile.id, err)
        skipped48++
      }
    }
  }

  console.log(
    `[cron/onboarding-sequence] 24h: sent=${sent24} skipped=${skipped24} | 48h: sent=${sent48} skipped=${skipped48}`
  )

  return NextResponse.json({
    listing_nudge: { sent: sent24, skipped: skipped24 },
    photo_nudge:   { sent: sent48, skipped: skipped48 },
  })
}
