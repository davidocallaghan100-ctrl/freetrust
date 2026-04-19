export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { insertNotification } from '@/lib/notifications/insert'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'
import { logActivity } from '@/lib/activity/logActivity'

// Stripe client — optional at module load so the route can still
// return clean errors (not crash) on environments without a key.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

// Fee rates — keep in sync with lib/trust/rewards and the checkout
// routes. Spec: 8% service, 5% product.
const FEE_RATE_SERVICE = 0.08
const FEE_RATE_PRODUCT = 0.05

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only allow buyer or seller to view
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch buyer and seller profiles
    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', order.buyer_id).single(),
      supabase.from('profiles').select('full_name, avatar_url').eq('id', order.seller_id).single(),
    ])

    return NextResponse.json({
      order: {
        ...order,
        buyer_name:   buyerProfile?.full_name  || 'Unknown',
        seller_name:  sellerProfile?.full_name || 'Unknown',
        buyer_avatar: buyerProfile?.avatar_url,
        seller_avatar: sellerProfile?.avatar_url,
      }
    })
  } catch (err) {
    console.error('[Order GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────
// PATCH /api/orders/[id]
//
// Actions:
//   mark_delivered (seller)    — flip to 'delivered', notify buyer
//   release_payment (buyer)    — TRUE ESCROW RELEASE:
//                                  1. stripe.paymentIntents.capture()
//                                  2. stripe.transfers.create() to seller
//                                  3. Update order status + transfer_id
//                                  4. Issue ₮COMPLETE_ORDER trust reward
//                                  5. Notify + email both parties
//                                  6. Handle referral reward
//   cancel_order (buyer)       — stripe.paymentIntents.cancel() (no charge)
//   raise_dispute (buyer)      — mark disputed, PaymentIntent stays held
//                                for admin review
// ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client for reads so we can fetch the seller's stripe
    // account id (profiles RLS may hide it from buyer queries).
    const admin = createAdminClient()

    const { data: order, error: fetchError } = await admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({})) as {
      action?:         string
      delivery_notes?: string
      dispute_reason?: string
    }
    const { action, delivery_notes, dispute_reason } = body

    // ── Seller: mark_delivered ─────────────────────────────────────────
    if (user.id === order.seller_id && action === 'mark_delivered') {
      // Allow delivering from 'paid' OR 'in_progress' so both the
      // legacy (pre-escrow) and new flows work.
      if (order.status !== 'paid' && order.status !== 'in_progress') {
        return NextResponse.json({ error: 'Can only mark paid/in-progress orders as delivered' }, { status: 400 })
      }

      const { error: updateError } = await admin
        .from('orders')
        .update({
          status:         'delivered',
          delivery_notes: delivery_notes || null,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
      }

      // Append to status_history timeline (non-blocking)
      void admin.rpc('append_order_status_history', {
        p_order_id: id,
        p_status:   'delivered',
        p_actor_id: user.id,
      })

      // Log to activity feed (non-blocking)
      void logActivity({
        orderId:    id,
        actorId:    user.id,
        actorRole:  'seller',
        eventType:  'delivery_completed',
        title:      'Seller marked as delivered',
        body:       delivery_notes || undefined,
      })

      await insertNotification({
        userId: order.buyer_id,
        type:   'order',
        title:  'Order delivered!',
        body:   `"${order.item_title}" has been marked as delivered. Please review and release payment.`,
        link:   `/orders/${id}`,
      })

      return NextResponse.json({ success: true, status: 'delivered' })
    }

    // ── Buyer: release_payment (TRUE ESCROW RELEASE) ───────────────────
    if (user.id === order.buyer_id && action === 'release_payment') {
      // Must be in 'delivered' (seller submitted the work) OR 'paid'
      // (buyer wants to release early — some product flows do this).
      if (order.status !== 'delivered' && order.status !== 'paid') {
        return NextResponse.json({ error: 'Can only release payment for paid or delivered orders' }, { status: 400 })
      }
      if (order.status === 'completed') {
        return NextResponse.json({ error: 'Order is already completed' }, { status: 400 })
      }
      if (!stripe) {
        return NextResponse.json({ error: 'Payments not configured on the server' }, { status: 503 })
      }

      // Resolve the PaymentIntent id — canonical column first, legacy
      // column as fallback so orders created before 20260416000003
      // still work.
      const piId: string | null =
        (order.stripe_payment_intent_id as string | null)
        || (order.stripe_payment_intent as string | null)
        || null

      if (!piId) {
        return NextResponse.json(
          { error: 'Order has no associated PaymentIntent — cannot capture funds' },
          { status: 400 },
        )
      }

      // Seller's Stripe Connect account — required destination for
      // the transfer. Fail loudly if missing so the buyer isn't
      // charged without a way to pay the seller.
      const { data: sellerProfile } = await admin
        .from('profiles')
        .select('stripe_account_id, stripe_onboarded, stripe_onboarding_complete, full_name')
        .eq('id', order.seller_id)
        .maybeSingle()

      const sellerStripeAccountId = (sellerProfile?.stripe_account_id as string | null) ?? null
      if (!sellerStripeAccountId) {
        return NextResponse.json(
          {
            error: 'Seller has no connected Stripe account — contact support',
            code:  'seller_no_stripe',
          },
          { status: 502 },
        )
      }

      // ── 1. Capture the PaymentIntent ─────────────────────────────────
      // Charges the buyer's card for the full amount. application_fee_amount
      // was set on creation so Stripe automatically retains the platform
      // fee on the FreeTrust balance.
      let captured: Stripe.PaymentIntent
      try {
        captured = await stripe.paymentIntents.capture(piId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[orders/${id}] paymentIntents.capture(${piId}) failed:`, msg)
        return NextResponse.json(
          { error: `Could not capture payment: ${msg}`, code: 'capture_failed' },
          { status: 502 },
        )
      }

      if (captured.status !== 'succeeded') {
        console.error(`[orders/${id}] capture returned non-succeeded status:`, captured.status)
        return NextResponse.json(
          { error: `Payment capture returned status=${captured.status}`, code: 'capture_not_succeeded' },
          { status: 502 },
        )
      }

      // ── 2. Create the Transfer to the seller ─────────────────────────
      // The fee was already retained by application_fee_amount on
      // capture. We still need to send the net-of-fee payout from the
      // platform balance to the seller's connected account.
      const totalCents = Number(captured.amount ?? order.amount_pence ?? 0)
      // Prefer the per-order item_type to decide the fee rate; default
      // to service-rate (higher) so we never under-charge the platform.
      const itemType   = String(order.item_type ?? '').toLowerCase()
      const feeRate    = itemType === 'product' ? FEE_RATE_PRODUCT : FEE_RATE_SERVICE
      const feeCents   = Math.round(totalCents * feeRate)
      const payoutCents = Math.max(totalCents - feeCents, 0)

      let transfer: Stripe.Transfer | null = null
      try {
        transfer = await stripe.transfers.create({
          amount:         payoutCents,
          currency:       (captured.currency || 'eur'),
          destination:    sellerStripeAccountId,
          transfer_group: order.id,
          metadata: {
            orderId:     order.id,
            buyerId:     order.buyer_id,
            sellerId:    order.seller_id,
            itemType,
            feeCents:    String(feeCents),
            payoutCents: String(payoutCents),
          },
        })
      } catch (err) {
        // Capture succeeded but transfer failed — log loudly. The
        // funds are on the platform account and can be transferred
        // manually via the Stripe Dashboard. We DON'T mark the order
        // completed in this case so the buyer sees the state clearly.
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[orders/${id}] stripe.transfers.create failed after capture:`, msg)
        return NextResponse.json(
          {
            error: `Payment captured but seller transfer failed: ${msg}. ` +
                   'The funds are safe on the platform account — contact support to manually transfer.',
            code:           'transfer_failed_after_capture',
            paymentIntent:  piId,
            captureStatus:  captured.status,
          },
          { status: 502 },
        )
      }

      // ── 3. Update the order row ──────────────────────────────────────
      const nowIso = new Date().toISOString()
      const { error: updateError } = await admin
        .from('orders')
        .update({
          status:             'completed',
          escrow_released_at: nowIso,
          stripe_transfer_id: transfer.id,
          updated_at:         nowIso,
        })
        .eq('id', id)

      if (updateError) {
        console.error(`[orders/${id}] order update after transfer failed:`, updateError)
        // Money has moved — don't fail the response, just log so we
        // can reconcile manually.
      }

      // Append to status_history timeline (non-blocking)
      void admin.rpc('append_order_status_history', {
        p_order_id: id,
        p_status:   'completed',
        p_actor_id: user.id,
      })

      // Log to activity feed (non-blocking)
      void logActivity({
        orderId:   id,
        actorId:   user.id,
        actorRole: 'buyer',
        eventType: 'buyer_confirmed',
        title:     'Buyer confirmed receipt',
        body:      'Payment released from escrow to seller.',
      })

      // ── 4. Trust reward to seller (₮COMPLETE_ORDER = 100) ────────────
      try {
        const { error: trustErr } = await admin.rpc('issue_trust', {
          p_user_id: order.seller_id,
          p_amount:  TRUST_REWARDS.COMPLETE_ORDER,
          p_type:    TRUST_LEDGER_TYPES.COMPLETE_ORDER,
          p_ref:     id,
          p_desc:    `₮${TRUST_REWARDS.COMPLETE_ORDER} reward for completing sale: ${order.item_title}`,
        })
        if (trustErr) console.error('[orders/release_payment] trust award failed:', trustErr)
      } catch (err) {
        console.error('[orders/release_payment] trust award threw:', err)
      }

      // ── 5. Notifications + emails for both parties ──────────────────
      void (async () => {
        try {
          const [sellerNotif, buyerNotif] = await Promise.all([
            insertNotification({
              userId: order.seller_id,
              type:   'order',
              title:  `Payment released: ₮${payoutCents / 100}`,
              body:   `"${order.item_title}" — ${(payoutCents / 100).toFixed(2)} ${captured.currency?.toUpperCase() ?? 'EUR'} sent to your Stripe account. You earned ₮${TRUST_REWARDS.COMPLETE_ORDER} trust.`,
              link:   `/orders/${id}`,
            }),
            insertNotification({
              userId: order.buyer_id,
              type:   'order',
              title:  'Order completed',
              body:   `You released payment for "${order.item_title}". Thanks for using FreeTrust.`,
              link:   `/orders/${id}`,
            }),
          ])
          void sellerNotif
          void buyerNotif
          await Promise.all([
            sendEmail({
              type:    'order_completed',
              userId:  order.seller_id,
              payload: { orderTitle: order.item_title as string, orderId: id },
            }).catch(e => console.error('[orders] seller email failed:', e)),
            sendEmail({
              type:    'order_completed',
              userId:  order.buyer_id,
              payload: { orderTitle: order.item_title as string, orderId: id },
            }).catch(e => console.error('[orders] buyer email failed:', e)),
          ])
        } catch (err) {
          console.error('[orders/release_payment] notify fan-out threw:', err)
        }
      })()

      // ── 6. Referral reward (existing logic, preserved) ──────────────
      try {
        const { data: pendingReferral } = await admin
          .from('referrals')
          .select('id, referrer_id, reward_amount, reward_credited')
          .eq('referred_id', order.buyer_id)
          .eq('status', 'pending')
          .maybeSingle()

        if (pendingReferral && !pendingReferral.reward_credited) {
          const { data: updated, error: updateErr } = await admin
            .from('referrals')
            .update({
              status:          'completed',
              reward_credited: true,
              completed_at:    nowIso,
            })
            .eq('id', pendingReferral.id)
            .eq('reward_credited', false)
            .select('id')

          if (!updateErr && updated && updated.length > 0) {
            await admin.rpc('issue_trust', {
              p_user_id: pendingReferral.referrer_id,
              p_amount:  pendingReferral.reward_amount ?? 50,
              p_type:    'referral_earned',
              p_ref:     id,
              p_desc:    `₮${pendingReferral.reward_amount ?? 50} earned — your referred member completed their first transaction!`,
            })
            await insertNotification({
              userId: pendingReferral.referrer_id,
              type:   'referral',
              title:  `🎉 Referral reward: ₮${pendingReferral.reward_amount ?? 50}!`,
              body:   'Your referred member just completed their first transaction. Thanks for growing FreeTrust!',
              link:   '/settings?tab=referral',
            })
            sendEmail({
              type:    'referral_reward',
              userId:  pendingReferral.referrer_id,
              payload: { amount: pendingReferral.reward_amount ?? 50 },
            }).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[orders/release_payment] referral reward error:', err)
      }

      return NextResponse.json({
        success:           true,
        status:            'completed',
        stripe_transfer_id: transfer.id,
        captured_amount:   totalCents,
        platform_fee:      feeCents,
        seller_payout:     payoutCents,
      })
    }

    // ── Buyer: cancel_order (cancel the uncaptured PaymentIntent) ─────
    if (user.id === order.buyer_id && action === 'cancel_order') {
      // Only allowed while funds are still on hold — once captured,
      // the buyer must use the refund flow instead (not implemented
      // here; raise_dispute is the escalation path).
      if (order.status !== 'paid') {
        return NextResponse.json(
          { error: `Cannot cancel from status=${order.status}. Only 'paid' (held) orders can be cancelled.` },
          { status: 400 },
        )
      }
      if (!stripe) {
        return NextResponse.json({ error: 'Payments not configured on the server' }, { status: 503 })
      }

      const piId: string | null =
        (order.stripe_payment_intent_id as string | null)
        || (order.stripe_payment_intent as string | null)
        || null

      if (piId) {
        try {
          await stripe.paymentIntents.cancel(piId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[orders/${id}] paymentIntents.cancel(${piId}) failed:`, msg)
          // If the PaymentIntent is already cancelled or in a terminal
          // state, Stripe returns an error — we still want to flip
          // the order locally to cancelled so the UI reflects it.
          // Only block on unrecoverable errors.
          if (!msg.toLowerCase().includes('already')) {
            return NextResponse.json(
              { error: `Could not cancel payment: ${msg}`, code: 'cancel_failed' },
              { status: 502 },
            )
          }
        }
      }

      const nowIso = new Date().toISOString()
      const { error: updateError } = await admin
        .from('orders')
        .update({
          status:       'cancelled',
          cancelled_at: nowIso,
          updated_at:   nowIso,
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
      }

      // Append to status_history timeline (non-blocking)
      void admin.rpc('append_order_status_history', {
        p_order_id: id,
        p_status:   'cancelled',
        p_actor_id: user.id,
      })

      // Log to activity feed (non-blocking)
      void logActivity({
        orderId:   id,
        actorId:   user.id,
        actorRole: 'buyer',
        eventType: 'status_changed',
        title:     'Order cancelled',
        body:      'Payment was not taken.',
      })

      // Notify both parties. If the buyer earned ₮5 purchase_reward
      // on checkout.session.completed, we'd normally reverse it here —
      // but the Webhook only awards that AFTER the hold, and most
      // cancellations happen before any trust was awarded, so we
      // leave the ledger untouched to keep the accounting simple.
      // Admin can manually reverse via /admin if needed.
      await Promise.all([
        insertNotification({
          userId: order.seller_id,
          type:   'order',
          title:  'Order cancelled',
          body:   `The order for "${order.item_title}" was cancelled by the buyer before work began. No payment was taken.`,
          link:   `/orders/${id}`,
        }),
        insertNotification({
          userId: order.buyer_id,
          type:   'order',
          title:  'Order cancelled',
          body:   `You cancelled your order for "${order.item_title}". No charge was applied to your card.`,
          link:   `/orders/${id}`,
        }),
      ])

      return NextResponse.json({ success: true, status: 'cancelled' })
    }

    // ── Buyer: raise_dispute ───────────────────────────────────────────
    if (user.id === order.buyer_id && action === 'raise_dispute') {
      if (order.status !== 'delivered' && order.status !== 'in_progress' && order.status !== 'paid') {
        return NextResponse.json({ error: 'Can only dispute active orders' }, { status: 400 })
      }
      if (!dispute_reason) {
        return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 })
      }

      const { error: updateError } = await admin
        .from('orders')
        .update({
          status:         'disputed',
          dispute_reason,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to raise dispute' }, { status: 500 })
      }

      // Append to status_history timeline (non-blocking)
      void admin.rpc('append_order_status_history', {
        p_order_id: id,
        p_status:   'disputed',
        p_actor_id: user.id,
      })

      // Log to activity feed (non-blocking)
      void logActivity({
        orderId:   id,
        actorId:   user.id,
        actorRole: 'buyer',
        eventType: 'dispute_raised',
        title:     'Dispute raised',
        body:      dispute_reason,
      })

      // The PaymentIntent is left in its current state (requires_capture)
      // so the platform admin can decide whether to capture + refund
      // via Stripe Dashboard or cancel. Order sits in 'disputed' until
      // reviewed.
      await insertNotification({
        userId: order.seller_id,
        type:   'order',
        title:  'Dispute raised',
        body:   `A dispute has been raised for order "${order.item_title}". Our team will review.`,
        link:   `/orders/${id}`,
      })

      return NextResponse.json({ success: true, status: 'disputed' })
    }

    return NextResponse.json({ error: 'Invalid action or insufficient permissions' }, { status: 400 })
  } catch (err) {
    console.error('[Order PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
