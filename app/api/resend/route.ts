export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendWelcomeEmail,
  sendNewMessageEmail,
  sendOrderPlacedEmail,
  sendOrderDeliveredEmail,
  sendReviewReceivedEmail,
  sendTrustMilestoneEmail,
  sendNewFollowerEmail,
  sendEventReminderEmail,
  sendWeeklyDigestEmail,
} from '@/lib/resend'

// POST /api/resend — internal email trigger endpoint
// Body: { type: string, payload: object }
export async function POST(request: NextRequest) {
  try {
    // Validate internal secret
    const secret = request.headers.get('x-internal-secret')
    if (secret !== process.env.INTERNAL_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const { type, payload } = body

    let result

    switch (type) {
      case 'welcome': {
        const { to, name } = payload
        result = await sendWelcomeEmail(to, name)
        break
      }
      case 'new_message': {
        const { to, name, senderName, preview } = payload
        result = await sendNewMessageEmail(to, name, senderName, preview)
        break
      }
      case 'order_placed': {
        const { to, name, orderTitle, amount, orderId } = payload
        result = await sendOrderPlacedEmail(to, name, orderTitle, amount, orderId)
        break
      }
      case 'order_delivered': {
        const { to, name, orderTitle, orderId } = payload
        result = await sendOrderDeliveredEmail(to, name, orderTitle, orderId)
        break
      }
      case 'review_received': {
        const { to, name, reviewerName, rating, preview } = payload
        result = await sendReviewReceivedEmail(to, name, reviewerName, rating, preview)
        break
      }
      case 'trust_milestone': {
        const { to, name, balance, tierName } = payload
        result = await sendTrustMilestoneEmail(to, name, balance, tierName)
        break
      }
      case 'new_follower': {
        const { to, name, followerName, followerId } = payload
        result = await sendNewFollowerEmail(to, name, followerName, followerId)
        break
      }
      case 'event_reminder': {
        const { to, name, eventTitle, eventDate, eventId } = payload
        result = await sendEventReminderEmail(to, name, eventTitle, eventDate, eventId)
        break
      }
      case 'weekly_digest': {
        const { to, name, stats } = payload
        result = await sendWeeklyDigestEmail(to, name, stats)
        break
      }
      default:
        return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[POST /api/resend]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
