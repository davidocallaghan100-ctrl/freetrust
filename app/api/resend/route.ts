export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, type SendEmailParams } from '@/lib/email/send'

// POST /api/resend — internal email trigger endpoint
// Body: { type: EmailType, userId: string, payload?: object }
//
// Protected by INTERNAL_SECRET header in production. Delegates to the
// unified sendEmail() utility which handles:
//   - Looking up the target user's email + name
//   - Checking notification_preferences for this type
//   - Rendering the correct branded template
//   - Swallowing delivery errors (returns { sent, reason })
//
// Supported types (full list in lib/email/send.ts EMAIL_TYPE_LABELS):
//   welcome, new_follower, new_message, new_comment, new_reaction,
//   order_placed, order_dispatched, order_delivered, order_completed,
//   order_disputed, review_received, wallet_topup, transfer_received,
//   referral_joined, referral_reward, new_job_application, event_reminder,
//   trust_badge, trust_milestone, weekly_digest
export async function POST(request: NextRequest) {
  try {
    // Validate internal secret
    const secret = request.headers.get('x-internal-secret')
    if (secret !== process.env.INTERNAL_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as Partial<SendEmailParams> & {
      type?: string
      userId?: string
    }

    if (!body.type || !body.userId) {
      return NextResponse.json({ error: 'type and userId are required' }, { status: 400 })
    }

    const result = await sendEmail(body as SendEmailParams)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[POST /api/resend]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
