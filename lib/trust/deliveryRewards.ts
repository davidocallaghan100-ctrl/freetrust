// ────────────────────────────────────────────────────────────────────────────
// Delivery-weighted TrustCoin rewards
// ────────────────────────────────────────────────────────────────────────────
//
// These rewards make TrustCoins reflect delivery quality, not just activity
// volume. On-time delivery earns significantly more than late delivery,
// incentivising sellers to set realistic deadlines and meet them.
//
// All calls are non-blocking (void-safe) — a failure here must never block
// an order flow or payment action.

import { awardTrust } from '@/lib/trust/award'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRUST_LEDGER_TYPES, DELIVERY_TRUST_REWARDS } from '@/lib/trust/rewards'

export type DeliveryRewardEvent =
  | 'delivered_on_time'   // +150₮ — seller delivered on or before expected_delivery_at
  | 'delivered_late'      // +50₮  — seller delivered but after expected_delivery_at
  | 'buyer_confirmed'     // +25₮  — buyer confirmed receipt (releases escrow)
  | 'five_star_review'    // +25₮  — reviewer bonus for a 5-star review
  | 'dispute_lost'        // -50₮  — seller penalised when dispute resolved against them
  | 'tracking_used'       // +10₮  — seller started live delivery tracking

const EVENT_CONFIG: Record<
  DeliveryRewardEvent,
  { amount: number; type: string; label: string }
> = {
  delivered_on_time: {
    amount: DELIVERY_TRUST_REWARDS.DELIVERED_ON_TIME,
    type:   TRUST_LEDGER_TYPES.DELIVERED_ON_TIME,
    label:  '⚡ On-time delivery bonus',
  },
  delivered_late: {
    amount: DELIVERY_TRUST_REWARDS.DELIVERED_LATE,
    type:   TRUST_LEDGER_TYPES.DELIVERED_LATE,
    label:  '📦 Delivery completed',
  },
  buyer_confirmed: {
    amount: DELIVERY_TRUST_REWARDS.BUYER_CONFIRMED,
    type:   TRUST_LEDGER_TYPES.BUYER_CONFIRMED,
    label:  '✅ Confirmed receipt',
  },
  five_star_review: {
    amount: DELIVERY_TRUST_REWARDS.FIVE_STAR_BONUS,
    type:   TRUST_LEDGER_TYPES.FIVE_STAR_BONUS,
    label:  '⭐ 5-star review bonus',
  },
  dispute_lost: {
    amount: DELIVERY_TRUST_REWARDS.DISPUTE_LOST,   // negative
    type:   TRUST_LEDGER_TYPES.DISPUTE_LOST,
    label:  '⚠️ Dispute resolved against you',
  },
  tracking_used: {
    amount: DELIVERY_TRUST_REWARDS.TRACKING_USED,
    type:   TRUST_LEDGER_TYPES.TRACKING_USED,
    label:  '📍 Live tracking used',
  },
}

/**
 * Award (or deduct) TrustCoins for a delivery-quality event.
 * Non-blocking — never throws, never blocks the calling route.
 *
 * @param userId   The user receiving the award or deduction
 * @param event    The delivery event type
 * @param orderId  Optional order reference for the ledger entry
 */
export async function awardDeliveryTrust(
  userId:  string,
  event:   DeliveryRewardEvent,
  orderId?: string,
): Promise<void> {
  if (!userId) return

  const config = EVENT_CONFIG[event]
  if (!config) return

  const { amount, type, label } = config

  // Deductions (dispute_lost) — use service role direct RPC since
  // awardTrust() validates amount > 0 (rightfully so for awards).
  if (amount < 0) {
    try {
      const admin = createAdminClient()
      const absAmount = Math.abs(amount)
      await admin.rpc('issue_trust', {
        p_user_id: userId,
        p_amount:  -absAmount,   // negative integer deduction
        p_type:    type,
        p_ref:     orderId ?? null,
        p_desc:    `${label}${orderId ? ` — order ${orderId.slice(0, 8)}` : ''}`,
      })
      console.log(`[awardDeliveryTrust] -₮${absAmount} → ${userId} (${type})`)
    } catch (err) {
      console.error('[awardDeliveryTrust] deduction failed:', err)
    }
    return
  }

  // Awards — route through awardTrust() for consistent logging +
  // in-app notification ("₮150 earned — On-time delivery bonus").
  void awardTrust({
    userId,
    amount,
    type,
    ref:  orderId ?? null,
    desc: `${label}${orderId ? ` — order ${orderId.slice(0, 8)}` : ''}`,
  })
}
