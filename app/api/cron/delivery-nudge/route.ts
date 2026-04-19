// GET /api/cron/delivery-nudge
//
// Runs every 30 minutes (Vercel cron). Finds orders that:
//   1. Are in 'delivered' status (seller submitted, buyer hasn't confirmed)
//   2. Were marked delivered > 30 minutes ago
//   3. Haven't already received a nudge push today
//
// Sends the buyer a push + in-app notification reminding them to confirm
// receipt and release payment to the seller.
//
// Auth: Vercel cron requests include the CRON_SECRET header (we reuse
// INTERNAL_API_SECRET to avoid adding a separate env var).

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/push/sendPushNotification'
import { insertNotification } from '@/lib/notifications/insert'

const NUDGE_AFTER_MINUTES = 30
const MAX_NUDGES_PER_RUN   = 50   // safety cap

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel cron (or internal tooling)
  const secret = req.headers.get('x-internal-secret')
    || req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - NUDGE_AFTER_MINUTES * 60 * 1000).toISOString()

  // Find orders delivered but not yet confirmed and not yet nudged
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, buyer_id, item_title, updated_at')
    .eq('status', 'delivered')
    .lt('updated_at', cutoff)           // delivered > 30 min ago
    .is('buyer_nudged_at', null)        // not yet nudged (column added below)
    .limit(MAX_NUDGES_PER_RUN)

  if (error) {
    console.error('[delivery-nudge] query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ orderId: string; status: string }> = []

  for (const order of orders ?? []) {
    try {
      // Push notification
      await sendPushNotification({
        userId:  order.buyer_id,
        title:   '⏰ Don\'t forget to confirm your delivery!',
        message: `"${order.item_title}" is waiting for your confirmation. Confirm receipt to release payment to the seller.`,
        url:     `/orders/${order.id}`,
      })

      // In-app notification
      await insertNotification({
        userId: order.buyer_id,
        type:   'order',
        title:  'Confirm your delivery',
        body:   `Please confirm receipt of "${order.item_title}" to release payment to the seller.`,
        link:   `/orders/${order.id}`,
      })

      // Mark as nudged so we don't spam
      await admin
        .from('orders')
        .update({ buyer_nudged_at: new Date().toISOString() })
        .eq('id', order.id)

      results.push({ orderId: order.id, status: 'nudged' })
    } catch (err) {
      console.error(`[delivery-nudge] failed for order ${order.id}:`, err)
      results.push({ orderId: order.id, status: 'error' })
    }
  }

  console.log(`[delivery-nudge] processed ${results.length} orders`)
  return NextResponse.json({ nudged: results.length, results })
}
