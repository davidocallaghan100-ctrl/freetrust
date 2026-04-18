/**
 * Unified email dispatcher with preference checks.
 *
 * Usage:
 *   import { sendEmail } from '@/lib/email/send'
 *
 *   await sendEmail({
 *     type: 'transfer_received',
 *     userId,                              // target — we look up email + prefs
 *     payload: { senderName, amount, currency, note },
 *   })
 *
 * The dispatcher:
 *  1. Looks up the target user's profile (email + name) via admin client
 *  2. Checks notification_preferences for this user + type.
 *     Missing row = opt-in (default true). email_enabled=false short-circuits.
 *  3. Fires the matching template function from lib/resend.ts
 *  4. Swallows delivery errors (logs them) so a broken email never crashes
 *     the calling code path
 *
 * Never throws. Returns { sent: boolean, reason?: string }.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendWelcomeEmail,
  sendNewMessageEmail,
  sendOrderPlacedEmail,
  sendOrderDeliveredEmail,
  sendOrderDispatchedEmail,
  sendOrderCompletedEmail,
  sendOrderDisputedEmail,
  sendReviewReceivedEmail,
  sendTrustMilestoneEmail,
  sendNewFollowerEmail,
  sendEventReminderEmail,
  sendWeeklyDigestEmail,
  sendWalletTopupEmail,
  sendTransferReceivedEmail,
  sendReferralJoinedEmail,
  sendReferralRewardEmail,
  sendNewCommentEmail,
  sendNewReactionEmail,
  sendJobApplicationEmail,
  sendTrustBadgeEmail,
  sendFirstListingNudgeEmail,
  sendProfilePhotoNudgeEmail,
} from '@/lib/resend'

export type EmailType =
  | 'welcome'
  | 'new_follower'
  | 'new_message'
  | 'order_placed'
  | 'order_dispatched'
  | 'order_delivered'
  | 'order_completed'
  | 'order_disputed'
  | 'new_comment'
  | 'new_reaction'
  | 'wallet_topup'
  | 'transfer_received'
  | 'referral_joined'
  | 'referral_reward'
  | 'new_job_application'
  | 'event_reminder'
  | 'trust_badge'
  | 'trust_milestone'
  | 'review_received'
  | 'weekly_digest'
  | 'first_listing_nudge'
  | 'profile_photo_nudge'

// Human-readable labels used by the settings UI
export const EMAIL_TYPE_LABELS: Record<EmailType, { label: string; description: string; category: string }> = {
  welcome:              { label: 'Welcome',                    description: 'One-off welcome email when you join',            category: 'account' },
  new_follower:         { label: 'New follower',               description: 'Someone started following you',                   category: 'social' },
  new_message:          { label: 'New message',                description: 'You have a new direct message',                   category: 'social' },
  new_comment:          { label: 'New comment',                description: 'Someone commented on your post or article',       category: 'social' },
  new_reaction:         { label: 'New reaction',               description: 'Someone reacted to your post',                    category: 'social' },
  order_placed:         { label: 'New order',                  description: 'You placed an order or received one as seller',   category: 'commerce' },
  order_dispatched:     { label: 'Order dispatched',           description: 'Your order has been dispatched by the seller',    category: 'commerce' },
  order_delivered:      { label: 'Order delivered',            description: 'Your order has been marked as delivered',         category: 'commerce' },
  order_completed:      { label: 'Order completed',            description: 'Payment released on a completed order',           category: 'commerce' },
  order_disputed:       { label: 'Order disputed',             description: 'A dispute was raised on your order',              category: 'commerce' },
  review_received:      { label: 'New review',                 description: 'Someone left you a review',                       category: 'commerce' },
  wallet_topup:         { label: 'Wallet top-up',              description: 'Your wallet was topped up via Stripe',            category: 'wallet' },
  transfer_received:    { label: 'Transfer received',          description: 'Someone sent you € or ₮ via the wallet',          category: 'wallet' },
  referral_joined:      { label: 'Referral joined',            description: 'Someone signed up with your referral link',       category: 'wallet' },
  referral_reward:      { label: 'Referral reward',            description: 'You earned ₮50 from a successful referral',       category: 'wallet' },
  new_job_application:  { label: 'New job application',        description: 'Someone applied to your job listing',             category: 'commerce' },
  event_reminder:       { label: 'Event reminder',             description: '24-hour reminder before events you RSVP\'d to',   category: 'social' },
  trust_badge:          { label: 'New badge earned',           description: 'You unlocked a new Trust badge',                  category: 'account' },
  trust_milestone:      { label: 'Trust milestone',            description: 'You reached a new Trust tier',                    category: 'account' },
  weekly_digest:        { label: 'Weekly digest',              description: 'Monday-morning summary of activity and trends',   category: 'digest' },
  first_listing_nudge:  { label: 'First listing nudge',        description: '24-hour nudge to add your first listing',         category: 'onboarding' },
  profile_photo_nudge:  { label: 'Profile photo nudge',        description: '48-hour nudge to upload a profile photo',         category: 'onboarding' },
}

// Types that ignore preferences (critical — users always get these)
const ALWAYS_SEND = new Set<EmailType>([
  'welcome',           // onboarding
  'order_placed',      // transactional — required for receipt
  'order_disputed',    // dispute notice — legal/transactional
  'wallet_topup',      // transactional — payment confirmation
] as EmailType[])

export type SendEmailParams =
  | { type: 'welcome';             userId: string; payload?: { amount?: number } }
  | { type: 'new_follower';        userId: string; payload: { followerName: string; followerId: string } }
  | { type: 'new_message';         userId: string; payload: { senderName: string; preview: string } }
  | { type: 'new_comment';         userId: string; payload: { commenterName: string; preview: string; postId: string } }
  | { type: 'new_reaction';        userId: string; payload: { reactorName: string; reactionType: string; postId: string } }
  | { type: 'order_placed';        userId: string; payload: { orderTitle: string; amount: number; orderId: string } }
  | { type: 'order_dispatched';    userId: string; payload: { orderTitle: string; orderId: string } }
  | { type: 'order_delivered';     userId: string; payload: { orderTitle: string; orderId: string } }
  | { type: 'order_completed';     userId: string; payload: { orderTitle: string; orderId: string } }
  | { type: 'order_disputed';      userId: string; payload: { orderTitle: string; orderId: string; reason: string } }
  | { type: 'review_received';     userId: string; payload: { reviewerName: string; rating: number; preview: string } }
  | { type: 'wallet_topup';        userId: string; payload: { amount: number } }
  | { type: 'transfer_received';   userId: string; payload: { senderName: string; amount: number; currency: 'EUR' | 'TRUST'; note: string | null } }
  | { type: 'referral_joined';     userId: string }
  | { type: 'referral_reward';     userId: string; payload: { amount: number } }
  | { type: 'new_job_application'; userId: string; payload: { applicantName: string; jobTitle: string; jobId: string } }
  | { type: 'event_reminder';      userId: string; payload: { eventTitle: string; eventDate: string; eventId: string } }
  | { type: 'trust_badge';         userId: string; payload: { badgeName: string; badgeDescription: string } }
  | { type: 'trust_milestone';     userId: string; payload: { balance: number; tierName: string } }
  | { type: 'weekly_digest';       userId: string; payload: { stats: { newMessages: number; newFollowers: number; profileViews: number; trustBalance: number } } }
  | { type: 'first_listing_nudge'; userId: string }
  | { type: 'profile_photo_nudge'; userId: string }

export type SendEmailResult = { sent: boolean; reason?: string }

/**
 * Check whether a user has opted in to a given email type.
 * Missing rows default to true (opt-in). Critical types in ALWAYS_SEND
 * ignore preferences entirely.
 */
export async function isEmailEnabled(userId: string, type: EmailType): Promise<boolean> {
  if (ALWAYS_SEND.has(type)) return true
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('notification_preferences')
      .select('email_enabled')
      .eq('user_id', userId)
      .eq('type', type)
      .maybeSingle()
    // Missing row → opt-in
    if (!data) return true
    return data.email_enabled === true
  } catch {
    // On error, default to opt-in rather than silently dropping transactional mail
    return true
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { type, userId } = params

  try {
    // 1. Look up target email + name
    const admin = createAdminClient()
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileErr || !profile?.email) {
      console.warn('[email] skipped — no email for user', userId, profileErr?.message)
      return { sent: false, reason: 'no_email' }
    }

    const to = profile.email as string
    const name = (profile.full_name as string | null) ?? 'there'

    // 2. Check preferences
    const enabled = await isEmailEnabled(userId, type)
    if (!enabled) {
      return { sent: false, reason: 'opted_out' }
    }

    // 3. Dispatch
    switch (params.type) {
      case 'welcome':
        await sendWelcomeEmail(to, name, params.payload?.amount)
        break
      case 'new_follower':
        await sendNewFollowerEmail(to, name, params.payload.followerName, params.payload.followerId)
        break
      case 'new_message':
        await sendNewMessageEmail(to, name, params.payload.senderName, params.payload.preview)
        break
      case 'new_comment':
        await sendNewCommentEmail(to, name, params.payload.commenterName, params.payload.preview, params.payload.postId)
        break
      case 'new_reaction':
        await sendNewReactionEmail(to, name, params.payload.reactorName, params.payload.reactionType, params.payload.postId)
        break
      case 'order_placed':
        await sendOrderPlacedEmail(to, name, params.payload.orderTitle, params.payload.amount, params.payload.orderId)
        break
      case 'order_dispatched':
        await sendOrderDispatchedEmail(to, name, params.payload.orderTitle, params.payload.orderId)
        break
      case 'order_delivered':
        await sendOrderDeliveredEmail(to, name, params.payload.orderTitle, params.payload.orderId)
        break
      case 'order_completed':
        await sendOrderCompletedEmail(to, name, params.payload.orderTitle, params.payload.orderId)
        break
      case 'order_disputed':
        await sendOrderDisputedEmail(to, name, params.payload.orderTitle, params.payload.orderId, params.payload.reason)
        break
      case 'review_received':
        await sendReviewReceivedEmail(to, name, params.payload.reviewerName, params.payload.rating, params.payload.preview)
        break
      case 'wallet_topup':
        await sendWalletTopupEmail(to, name, params.payload.amount)
        break
      case 'transfer_received':
        await sendTransferReceivedEmail(to, name, params.payload.senderName, params.payload.amount, params.payload.currency, params.payload.note)
        break
      case 'referral_joined':
        await sendReferralJoinedEmail(to, name)
        break
      case 'referral_reward':
        await sendReferralRewardEmail(to, name, params.payload.amount)
        break
      case 'new_job_application':
        await sendJobApplicationEmail(to, name, params.payload.applicantName, params.payload.jobTitle, params.payload.jobId)
        break
      case 'event_reminder':
        await sendEventReminderEmail(to, name, params.payload.eventTitle, params.payload.eventDate, params.payload.eventId)
        break
      case 'trust_badge':
        await sendTrustBadgeEmail(to, name, params.payload.badgeName, params.payload.badgeDescription)
        break
      case 'trust_milestone':
        await sendTrustMilestoneEmail(to, name, params.payload.balance, params.payload.tierName)
        break
      case 'weekly_digest':
        await sendWeeklyDigestEmail(to, name, params.payload.stats)
        break
      case 'first_listing_nudge':
        await sendFirstListingNudgeEmail(to, name)
        break
      case 'profile_photo_nudge':
        await sendProfilePhotoNudgeEmail(to, name)
        break
    }

    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] send failed:', type, message)
    return { sent: false, reason: `error: ${message}` }
  }
}
