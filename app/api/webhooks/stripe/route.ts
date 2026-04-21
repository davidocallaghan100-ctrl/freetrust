export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { insertNotification } from "@/lib/notifications/insert";
import { logActivity } from "@/lib/activity/logActivity";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[Stripe Webhook] Checkout completed:", {
    sessionId: session.id,
    type: session.metadata?.type,
    amountTotal: session.amount_total,
  });

  const type = session.metadata?.type;

  // ── Founder Investment payment confirmed ──────────────────────────────────
  if (type === 'founder_investment') {
    await handleFounderInvestment(session);
    return;
  }

  // ── Community membership payment confirmed ────────────────────────────────
  if (type === 'community_membership') {
    const community_id = session.metadata?.community_id;
    const user_id = session.metadata?.user_id;

    if (!community_id || !user_id) {
      console.error('[Webhook] community_membership missing metadata', session.metadata);
      return;
    }

    try {
      const supabase = createAdminClient();

      // 1. Upsert community_members row (idempotent — safe on retry)
      const { error: memberError } = await supabase
        .from('community_members')
        .upsert(
          { community_id, user_id, role: 'member', tier: 'paid' },
          { onConflict: 'community_id,user_id', ignoreDuplicates: false }
        );

      if (memberError) {
        console.error('[Webhook] Failed to insert community member:', memberError);
      } else {
        console.log(`[Webhook] Community member inserted: user=${user_id} community=${community_id}`);
      }

      // 2. Get community owner for fee recording
      const { data: community, error: commErr } = await supabase
        .from('communities')
        .select('owner_id, name')
        .eq('id', community_id)
        .single();

      if (commErr || !community) {
        console.error('[Webhook] Could not find community for fee:', community_id);
        return;
      }

      // 3. Record 5% platform fee in trust_ledger (against owner)
      //    amount_total is in pence; fee = 5%
      const amountTotal = session.amount_total ?? 0;
      const platformFee = Math.floor(amountTotal * 0.05);

      if (platformFee > 0) {
        const { error: feeError } = await supabase.rpc('issue_trust', {
          p_user_id: community.owner_id,
          p_amount: -platformFee,
          p_type: 'platform_fee',
          p_ref: community_id,
          p_desc: `FreeTrust 5% platform fee — ${community.name} paid membership`,
        });

        if (feeError) {
          console.warn('[Webhook] Trust ledger fee record failed:', feeError);
        } else {
          console.log(`[Webhook] Platform fee recorded: ${platformFee}p against owner=${community.owner_id}`);
        }
      }
    } catch (err) {
      console.error('[Webhook] community_membership handler error:', err);
    }
    return;
  }

  // ── Wallet top-up ─────────────────────────────────────────────────────────
  if (type === 'wallet_topup') {
    const userId = session.metadata?.user_id
    const depositId = session.metadata?.deposit_id
    const amountCents = parseInt(session.metadata?.amount_cents ?? '0', 10)

    if (!userId || !depositId || !amountCents) {
      console.error('[Webhook] wallet_topup missing metadata', session.metadata)
      return
    }

    try {
      const supabase = createAdminClient()

      // Mark deposit as completed
      await supabase
        .from('money_deposits')
        .update({
          status: 'completed',
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent : String(session.payment_intent ?? ''),
          updated_at: new Date().toISOString(),
        })
        .eq('id', depositId)

      // money_deposits table is the source of truth for top-ups — no orders row needed

      // Send notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'wallet',
        title: '💰 Funds added!',
        body: `€${(amountCents / 100).toFixed(2)} has been added to your FreeTrust wallet.`,
        link: '/wallet',
      })

      // Send transactional confirmation email (ignores preferences — payment receipt)
      sendEmail({
        type: 'wallet_topup',
        userId,
        payload: { amount: amountCents / 100 },
      }).catch(() => {})

      console.log(`[Webhook] Wallet top-up complete: user=${userId} amount=€${amountCents / 100}`)
    } catch (err) {
      console.error('[Webhook] wallet_topup handler error:', err)
    }
    return
  }

  // ── Standard escrow checkout (services / products) ────────────────────────
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.log('[Stripe Webhook] No order_id in session metadata, skipping DB update');
    return;
  }

  try {
    const supabase = createAdminClient();

    // Update order status to `paid` (funds held in escrow on the
    // platform account via capture_method: 'manual') and store the
    // PaymentIntent id on both the legacy `stripe_payment_intent`
    // column and the canonical `stripe_payment_intent_id` so
    // release_payment can read either.
    //
    // Status semantics:
    //   pending / pending_escrow — checkout session created, buyer
    //     hasn't paid yet
    //   paid — buyer confirmed, PaymentIntent is in requires_capture;
    //     funds held on the platform until release or cancellation
    //   in_progress — seller started work (optional intermediate)
    //   delivered — seller marked the work delivered
    //   completed — buyer released payment; funds captured + transferred
    //   cancelled — order cancelled, PaymentIntent cancelled, no charge
    const piId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : String(session.payment_intent ?? '')
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        stripe_payment_intent:    piId,
        stripe_payment_intent_id: piId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[Stripe Webhook] Failed to update order status:', updateError);
      return;
    }

    // Fetch order to issue trust reward to buyer + get listing_id for delivery deadline
    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id, title, listing_id')
      .eq('id', orderId)
      .single();

    // Set expected_delivery_at from listing.delivery_days (non-blocking)
    if (order?.listing_id) {
      supabase
        .from('listings')
        .select('delivery_days')
        .eq('id', order.listing_id)
        .single()
        .then(({ data: listing }) => {
          if (listing?.delivery_days) {
            const expectedDate = new Date()
            expectedDate.setDate(expectedDate.getDate() + listing.delivery_days)
            supabase
              .from('orders')
              .update({ expected_delivery_at: expectedDate.toISOString() })
              .eq('id', orderId)
              .then(() => {})
          }
        })
    }

    // Log payment confirmed to activity feed (non-blocking)
    void logActivity({
      orderId:   orderId,
      actorRole: 'system',
      eventType: 'payment_confirmed',
      title:     'Payment confirmed',
      body:      'Funds held in escrow until delivery is confirmed.',
    })

    if (order?.buyer_id) {
      // Issue ₮5 trust to buyer for making a purchase
      await supabase.rpc('issue_trust', {
        p_user_id: order.buyer_id,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: orderId,
        p_desc: `₮5 trust reward for purchasing: ${(order as any).title}`,
      });

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order',
        title: 'Order confirmed!',
        body: `Your order for "${(order as any).title}" is confirmed. You earned ₮5 trust!`,
        link: `/orders/${orderId}`,
      });
    }
  } catch (err) {
    console.error('[Stripe Webhook] service/product checkout handler error:', err);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata ?? {}
  const piId = paymentIntent.id
  const amountCents = paymentIntent.amount
  const type = meta.type
  const userId = meta.user_id

  console.log("[PaymentIntent] succeeded:", { id: piId, amount: amountCents, type, userId })

  if (!type || !userId) {
    console.log("[PaymentIntent] no type/userId in metadata — skipping (not a FreeTrust pay flow)")
    return
  }

  const supabase = createAdminClient()

  // ── Wallet top-up (Apple/Google Pay path) ────────────────────────────────
  if (type === 'wallet_topup') {
    try {
      // Create a completed deposit record (bypasses the Checkout Session deposit row)
      const { data: deposit, error: depErr } = await supabase
        .from('money_deposits')
        .insert({
          user_id: userId,
          amount_cents: amountCents,
          currency: (paymentIntent.currency ?? 'eur').toLowerCase(),
          status: 'completed',
          stripe_payment_intent: piId,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (depErr) {
        console.error('[PaymentIntent] wallet_topup deposit insert error:', depErr)
      } else {
        console.log(`[PaymentIntent] wallet_topup deposit created: ${deposit?.id}`)
      }

      // Notify user
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'wallet',
        title: '💰 Funds added!',
        body: `€${(amountCents / 100).toFixed(2)} has been added to your FreeTrust wallet.`,
        link: '/wallet',
      })

      // Send email receipt (non-blocking)
      sendEmail({
        type: 'wallet_topup',
        userId,
        payload: { amount: amountCents / 100 },
      }).catch(() => {})

      console.log(`[PaymentIntent] wallet_topup complete: user=${userId} amount=€${(amountCents / 100).toFixed(2)}`)
    } catch (err) {
      console.error('[PaymentIntent] wallet_topup handler error:', err)
    }
    return
  }

  // ── Event ticket purchase (Apple/Google Pay path) ─────────────────────────
  if (type === 'event_ticket') {
    const eventId = meta.event_id
    if (!eventId) {
      console.error('[PaymentIntent] event_ticket missing event_id')
      return
    }

    try {
      // Fetch event details
      const { data: event } = await supabase
        .from('events')
        .select('title, creator_id, price, capacity, attendee_count')
        .eq('id', eventId)
        .single()

      if (!event) {
        console.error('[PaymentIntent] event_ticket: event not found', eventId)
        return
      }

      // Create order for ticket
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: userId,
          seller_id: event.creator_id ?? userId,
          listing_id: null,
          title: event.title,
          amount: amountCents,
          status: 'paid',
          stripe_payment_intent: piId,
          stripe_payment_intent_id: piId,
          type: 'event_ticket',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (orderErr) {
        console.error('[PaymentIntent] event_ticket order insert error:', orderErr)
      }

      // Increment attendee_count
      await supabase
        .from('events')
        .update({ attendee_count: (event.attendee_count ?? 0) + 1 })
        .eq('id', eventId)

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'order',
        title: '🎟️ Ticket confirmed!',
        body: `Your ticket for "${event.title}" has been confirmed.`,
        link: order?.id ? `/orders/${order.id}` : '/orders',
      })

      // Issue ₮5 trust reward to buyer
      await supabase.rpc('issue_trust', {
        p_user_id: userId,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: order?.id ?? piId,
        p_desc: `₮5 trust reward for purchasing ticket: ${event.title}`,
      })

      console.log(`[PaymentIntent] event_ticket complete: user=${userId} event=${eventId} order=${order?.id}`)
    } catch (err) {
      console.error('[PaymentIntent] event_ticket handler error:', err)
    }
    return
  }

  // ── Product purchase (Apple/Google Pay path) ──────────────────────────────
  if (type === 'product_purchase') {
    const listingId = meta.listing_id
    if (!listingId) {
      console.error('[PaymentIntent] product_purchase missing listing_id')
      return
    }

    try {
      // Fetch listing details
      const { data: listing } = await supabase
        .from('listings')
        .select('title, seller_id, delivery_days')
        .eq('id', listingId)
        .single()

      if (!listing) {
        console.error('[PaymentIntent] product_purchase: listing not found', listingId)
        return
      }

      const expectedDeliveryAt = listing.delivery_days
        ? new Date(Date.now() + listing.delivery_days * 86400000).toISOString()
        : null

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: userId,
          seller_id: listing.seller_id,
           listing_id: listingId,
          title: listing.title,
          amount: amountCents,
          status: 'paid',
          stripe_payment_intent: piId,
          stripe_payment_intent_id: piId,
          type: 'product',
          expected_delivery_at: expectedDeliveryAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (orderErr) {
        console.error('[PaymentIntent] product_purchase order insert error:', orderErr)
        return
      }

      // Log activity
      void logActivity({
        orderId: order!.id,
        actorRole: 'system',
        eventType: 'payment_confirmed',
        title: 'Payment confirmed',
        body: 'Funds held in escrow until delivery is confirmed.',
      })

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'order',
        title: 'Order confirmed!',
        body: `Your order for "${listing.title}" is confirmed. You earned ₮5 trust!`,
        link: `/orders/${order!.id}`,
      })

      // Issue ₮5 trust reward
      await supabase.rpc('issue_trust', {
        p_user_id: userId,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: order!.id,
        p_desc: `₮5 trust reward for purchasing: ${listing.title}`,
      })

      console.log(`[PaymentIntent] product_purchase complete: user=${userId} listing=${listingId} order=${order!.id}`)
    } catch (err) {
      console.error('[PaymentIntent] product_purchase handler error:', err)
    }
    return
  }

  // ── Service purchase (Apple/Google Pay path) ──────────────────────────────
  if (type === 'service_purchase') {
    const serviceId = meta.service_id
    if (!serviceId) {
      console.error('[PaymentIntent] service_purchase missing service_id')
      return
    }

    try {
      const { data: listing } = await supabase
        .from('listings')
        .select('title, seller_id, delivery_days')
        .eq('id', serviceId)
        .single()

      if (!listing) {
        console.error('[PaymentIntent] service_purchase: listing not found', serviceId)
        return
      }

      const expectedDeliveryAt = listing.delivery_days
        ? new Date(Date.now() + listing.delivery_days * 86400000).toISOString()
        : null

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: userId,
          seller_id: listing.seller_id,
           listing_id: serviceId,
          title: listing.title,
          amount: amountCents,
          status: 'paid',
          stripe_payment_intent: piId,
          stripe_payment_intent_id: piId,
          type: 'service',
          expected_delivery_at: expectedDeliveryAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (orderErr) {
        console.error('[PaymentIntent] service_purchase order insert error:', orderErr)
        return
      }

      void logActivity({
        orderId: order!.id,
        actorRole: 'system',
        eventType: 'payment_confirmed',
        title: 'Payment confirmed',
        body: 'Funds held in escrow until delivery is confirmed.',
      })

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'order',
        title: 'Service order confirmed!',
        body: `Your order for "${listing.title}" is confirmed. You earned ₮5 trust!`,
        link: `/orders/${order!.id}`,
      })

      await supabase.rpc('issue_trust', {
        p_user_id: userId,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: order!.id,
        p_desc: `₮5 trust reward for purchasing service: ${listing.title}`,
      })

      console.log(`[PaymentIntent] service_purchase complete: user=${userId} service=${serviceId} order=${order!.id}`)
    } catch (err) {
      console.error('[PaymentIntent] service_purchase handler error:', err)
    }
    return
  }

  // ── Cart checkout (Apple/Google Pay path) ─────────────────────────────────
  if (type === 'cart_checkout') {
    // Cart items were client-side only; create a single consolidated cart order
    const itemCount = parseInt(meta.item_count ?? '1', 10)

    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: userId,
          seller_id: userId, // platform handles multi-seller cart
          listing_id: null,
          title: `Cart order (${itemCount} item${itemCount !== 1 ? 's' : ''})`,
          amount: amountCents,
          status: 'paid',
          stripe_payment_intent: piId,
          stripe_payment_intent_id: piId,
          type: 'cart',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (orderErr) {
        console.error('[PaymentIntent] cart_checkout order insert error:', orderErr)
        return
      }

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'order',
        title: 'Cart order confirmed!',
        body: `Your cart order (${itemCount} item${itemCount !== 1 ? 's' : ''}) is confirmed. You earned ₮5 trust!`,
        link: `/orders/${order!.id}`,
      })

      await supabase.rpc('issue_trust', {
        p_user_id: userId,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: order!.id,
        p_desc: `₮5 trust reward for cart purchase`,
      })

      console.log(`[PaymentIntent] cart_checkout complete: user=${userId} items=${itemCount} order=${order!.id}`)
    } catch (err) {
      console.error('[PaymentIntent] cart_checkout handler error:', err)
    }
    return
  }

  console.log(`[PaymentIntent] unhandled type="${type}" — no action taken`)
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("[Escrow] PaymentIntent failed:", {
    id: paymentIntent.id,
    orderId: paymentIntent.metadata?.order_id,
    lastPaymentError: paymentIntent.last_payment_error?.message,
  });

  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) return;

  try {
    const supabase = createAdminClient();
    await supabase
      .from('orders')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id, title')
      .eq('id', orderId)
      .single();

    if (order?.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order',
        title: 'Payment failed',
        body: `Payment for "${(order as any).title}" failed. Please try again.`,
        link: `/orders/${orderId}`,
      });
    }
  } catch (err) {
    console.error('[Stripe Webhook] handlePaymentIntentFailed error:', err);
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Auto-mark seller as onboarded when Stripe confirms charges + payouts enabled
  if (!account.charges_enabled || !account.payouts_enabled) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('profiles')
      .update({ stripe_onboarded: true })
      .eq('stripe_account_id', account.id)
      .eq('stripe_onboarded', false); // only update if not already marked

    if (error) {
      console.error('[Webhook] handleAccountUpdated: failed to mark onboarded', error);
    } else {
      console.log(`[Webhook] Seller onboarded: stripe_account=${account.id}`);
    }
  } catch (err) {
    console.error('[Webhook] handleAccountUpdated error:', err);
  }
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  console.log("[Escrow] Transfer to seller created:", {
    id: transfer.id,
    amount: transfer.amount,
    destination: transfer.destination,
  });

  // Transfers are created by our release_payment endpoint (POST /api/orders/[id]/release).
  // The transfer metadata includes the order_id so we can update the order to 'completed'
  // and notify both buyer and seller.
  const orderId = (transfer.metadata as Record<string, string> | null)?.order_id
  if (!orderId) {
    console.log("[Escrow] Transfer has no order_id in metadata — nothing to update")
    return
  }

  try {
    const supabase = createAdminClient()

    // Fetch order for notification context
    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id, seller_id, title, status')
      .eq('id', orderId)
      .single()

    if (!order) {
      console.error('[Escrow] Transfer: order not found', orderId)
      return
    }

    // Mark order as completed (funds released to seller)
    await supabase
      .from('orders')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    // Notify seller that funds have been transferred
    if (order.seller_id) {
      await supabase.from('notifications').insert({
        user_id: order.seller_id,
        type: 'order',
        title: '💸 Payment received!',
        body: `Payment for "${(order as any).title}" has been transferred to your Stripe account.`,
        link: `/orders/${orderId}`,
      })
    }

    // Notify buyer that the order is complete
    if (order.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order',
        title: '✅ Order complete',
        body: `Your order for "${(order as any).title}" is now complete. Funds released to seller.`,
        link: `/orders/${orderId}`,
      })
    }

    console.log(`[Escrow] Transfer complete: order=${orderId} amount=€${(transfer.amount / 100).toFixed(2)}`)
  } catch (err) {
    console.error('[Escrow] handleTransferCreated error:', err)
  }
}

async function handleFounderInvestment(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') {
    console.log('[Founder] Skipped — not paid:', session.id);
    return;
  }

  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const tierKey = meta.tier_key;
  const investmentAmount = meta.investment_amount_eur;
  const serviceFeeBps = meta.service_fee_bps;
  const productFeeBps = meta.product_fee_bps;
  const aiCreditsBonus = meta.ai_credits_bonus;
  const trustBonus = meta.trust_bonus;
  const monthlyRefill = meta.monthly_refill;

  if (
    !userId ||
    !tierKey ||
    !investmentAmount ||
    !serviceFeeBps ||
    !productFeeBps ||
    !aiCreditsBonus ||
    !trustBonus ||
    !monthlyRefill
  ) {
    console.error('[Founder] Missing required metadata:', session.id, meta);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('grant_founder_investment', {
    p_user_id: userId,
    p_tier: tierKey,
    p_investment_amount_eur: parseInt(investmentAmount, 10),
    p_service_fee_bps: parseInt(serviceFeeBps, 10),
    p_product_fee_bps: parseInt(productFeeBps, 10),
    p_ai_credits_bonus: parseInt(aiCreditsBonus, 10),
    p_trust_bonus: parseInt(trustBonus, 10),
    p_monthly_refill: parseInt(monthlyRefill, 10),
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (error) {
    console.error('[Founder] grant_founder_investment RPC error:', error);
    throw new Error(`Founder grant failed: ${error.message}`);
  }

  console.log('[Founder] Granted:', session.id, data);

  // Fire-and-forget — webhook must respond quickly to Stripe
  void insertNotification({
    userId,
    type: 'founder_investment',
    title: `🏅 ${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} Early Investor tier activated!`,
    body: 'Your lifetime lower fees, AI Credits, and TrustCoin bonus are live.',
    link: '/wallet',
  }).catch(e => console.error('[Founder] notification failed:', e));
}

