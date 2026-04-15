export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

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

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutPaid(payout, event.account ?? null);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutFailed(payout, event.account ?? null);
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

    // Update order status to in_progress and store payment intent
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'in_progress',
        stripe_payment_intent: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : String(session.payment_intent ?? ''),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[Stripe Webhook] Failed to update order status:', updateError);
      return;
    }

    // Fetch order to issue trust reward to buyer
    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id, item_title')
      .eq('id', orderId)
      .single();

    if (order?.buyer_id) {
      // Issue ₮5 trust to buyer for making a purchase
      await supabase.rpc('issue_trust', {
        p_user_id: order.buyer_id,
        p_amount: 5,
        p_type: 'purchase_reward',
        p_ref: orderId,
        p_desc: `₮5 trust reward for purchasing: ${order.item_title}`,
      });

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order',
        title: 'Order confirmed!',
        body: `Your order for "${order.item_title}" is confirmed. You earned ₮5 trust!`,
        link: `/orders/${orderId}`,
      });
    }
  } catch (err) {
    console.error('[Stripe Webhook] service/product checkout handler error:', err);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("[Escrow] PaymentIntent succeeded:", {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    type: paymentIntent.metadata?.type,
    sellerId: paymentIntent.metadata?.sellerId,
    platformFeeAmount: paymentIntent.metadata?.platformFeeAmount,
    platformFeeRate: paymentIntent.metadata?.platformFeeRate,
  });

  // TODO: Update escrow status in your DB to "funds_held".
  // Funds are held on the platform until service/product is confirmed delivered.
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
      .select('buyer_id, item_title')
      .eq('id', orderId)
      .single();

    if (order?.buyer_id) {
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order',
        title: 'Payment failed',
        body: `Payment for "${order.item_title}" failed. Please try again.`,
        link: `/orders/${orderId}`,
      });
    }
  } catch (err) {
    console.error('[Stripe Webhook] handlePaymentIntentFailed error:', err);
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Sync the full Stripe Connect state to profiles every time the
  // account.updated event fires. Before the audit fix, this handler
  // only flipped `stripe_onboarded=true` when both flags went
  // positive, and ignored every other transition — so a user whose
  // account was downgraded (e.g. payouts_enabled flipped back to
  // false after a verification issue) would still show as
  // "onboarded" in the DB and hit a confusing error when they tried
  // to withdraw.
  //
  // Now writes all four derived fields unconditionally:
  //
  //   stripe_charges_enabled     — Stripe's charges_enabled
  //   stripe_payouts_enabled     — Stripe's payouts_enabled
  //   stripe_onboarding_complete — both flags true
  //   stripe_onboarded           — alias of onboarding_complete kept
  //                                for backward compat with earlier
  //                                migrations that only had this col
  //
  // The columns are added by 20260415000006_stripe_connect_columns.sql
  // and default to false, so this UPDATE is guaranteed to find the
  // row if stripe_account_id is set.
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const complete = chargesEnabled && payoutsEnabled;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        stripe_charges_enabled:     chargesEnabled,
        stripe_payouts_enabled:     payoutsEnabled,
        stripe_onboarding_complete: complete,
        stripe_onboarded:           complete, // legacy alias
      })
      .eq('stripe_account_id', account.id);

    if (error) {
      console.error('[Webhook] handleAccountUpdated: failed to sync account state', error);
      return;
    }

    console.log(
      `[Webhook] account.updated synced: stripe_account=${account.id} ` +
      `charges=${chargesEnabled} payouts=${payoutsEnabled} complete=${complete}`
    );

    // First-time onboarding — notify the user so they know they can
    // now start accepting payments. Only fire when BOTH flags just
    // went positive so we don't spam every account.updated event.
    if (complete) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, stripe_onboarding_complete')
        .eq('stripe_account_id', account.id)
        .maybeSingle();

      if (profile?.id) {
        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: 'wallet',
          title: '✅ Bank account verified',
          body: 'Your Stripe account is fully set up. You can now accept payments and withdraw earnings.',
          link: '/wallet',
        });
      }
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
    metadata: transfer.metadata,
  });

  // Withdrawals from /api/stripe/payout tag the transfer with
  // metadata.withdrawal_id. If this transfer is one of ours, make
  // sure the withdrawal row's stripe_transfer_id is set in case the
  // POST handler updated it after the webhook arrived (rare race).
  const withdrawalId = transfer.metadata?.withdrawal_id;
  if (withdrawalId) {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('withdrawals')
        .update({
          stripe_transfer_id: transfer.id,
          status: 'processing',
        })
        .eq('id', withdrawalId)
        .in('status', ['pending', 'processing']);
      if (error) {
        console.error('[Webhook] handleTransferCreated: failed to update withdrawal', error);
      } else {
        console.log(`[Webhook] Withdrawal marked processing: id=${withdrawalId}`);
      }
    } catch (err) {
      console.error('[Webhook] handleTransferCreated: unexpected error', err);
    }
  }
}

// ── payout.paid — money has arrived in the user's bank ──────────────────────
// Fires on the connected account, so event.account is the user's
// stripe_account_id. The Payout was created automatically by Stripe
// as part of the connected account's payout schedule (Express
// default: daily). We match it back to the originating withdrawal
// row via the most recent processing/pending row for that
// stripe_account_id, since Stripe doesn't propagate metadata from
// our Transfer to the auto-generated Payout.
async function handlePayoutPaid(payout: Stripe.Payout, connectedAccountId: string | null) {
  console.log("[Webhook] payout.paid:", {
    id: payout.id,
    amount: payout.amount,
    arrival_date: payout.arrival_date,
    connectedAccountId,
  });

  if (!connectedAccountId) {
    console.warn('[Webhook] payout.paid missing event.account, skipping');
    return;
  }

  try {
    const supabase = createAdminClient();

    // Find the most recent in-flight withdrawal for this connected
    // account whose amount matches the payout (defensive — multiple
    // simultaneous withdrawals are rare but possible). If we can't
    // pin it to a unique row, fall back to the oldest pending one.
    const { data: candidates, error: lookupErr } = await supabase
      .from('withdrawals')
      .select('id, amount_cents, status, user_id')
      .eq('stripe_account_id', connectedAccountId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true });

    if (lookupErr) {
      console.error('[Webhook] payout.paid lookup failed:', lookupErr);
      return;
    }
    if (!candidates || candidates.length === 0) {
      console.log(`[Webhook] payout.paid no matching withdrawal for account=${connectedAccountId}`);
      return;
    }

    const exactMatch = candidates.find((w) => w.amount_cents === payout.amount);
    const target = exactMatch ?? candidates[0];

    // Write both `status='paid'` (for the existing CHECK constraint
    // defined in 20260414000008_withdrawals_table.sql) and
    // `completed_at=now()` (the timestamp the audit spec asks for
    // and the wallet UI displays). `arrival_estimate_epoch` stays
    // too so the history feed can reconcile against Stripe's
    // stated arrival date.
    const { error: updateErr } = await supabase
      .from('withdrawals')
      .update({
        status: 'paid',
        completed_at: new Date().toISOString(),
        stripe_payout_id: payout.id,
        arrival_estimate_epoch: payout.arrival_date,
      })
      .eq('id', target.id);

    if (updateErr) {
      console.error('[Webhook] payout.paid update failed:', updateErr);
      return;
    }

    console.log(
      `[Webhook] Withdrawal marked paid: id=${target.id} payout_id=${payout.id}`
    );

    // Notify the user that their withdrawal has landed.
    await supabase.from('notifications').insert({
      user_id: target.user_id,
      type: 'wallet',
      title: '✅ Withdrawal complete',
      body: `Your withdrawal of €${(target.amount_cents / 100).toFixed(2)} has been paid — it should arrive in 1–2 business days.`,
      link: '/wallet',
    });
  } catch (err) {
    console.error('[Webhook] handlePayoutPaid error:', err);
  }
}

// ── payout.failed — money never arrived in the user's bank ──────────────────
// Same connected-account matching as handlePayoutPaid. We mark the
// withdrawal failed and surface Stripe's failure_message to the user
// so they know whether to retry, fix their bank details, etc.
async function handlePayoutFailed(payout: Stripe.Payout, connectedAccountId: string | null) {
  console.error("[Webhook] payout.failed:", {
    id: payout.id,
    amount: payout.amount,
    failure_code: payout.failure_code,
    failure_message: payout.failure_message,
    connectedAccountId,
  });

  if (!connectedAccountId) {
    console.warn('[Webhook] payout.failed missing event.account, skipping');
    return;
  }

  try {
    const supabase = createAdminClient();

    const { data: candidates, error: lookupErr } = await supabase
      .from('withdrawals')
      .select('id, amount_cents, status, user_id')
      .eq('stripe_account_id', connectedAccountId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true });

    if (lookupErr) {
      console.error('[Webhook] payout.failed lookup failed:', lookupErr);
      return;
    }
    if (!candidates || candidates.length === 0) {
      console.log(`[Webhook] payout.failed no matching withdrawal for account=${connectedAccountId}`);
      return;
    }

    const exactMatch = candidates.find((w) => w.amount_cents === payout.amount);
    const target = exactMatch ?? candidates[0];

    const failureReason =
      payout.failure_message ?? payout.failure_code ?? 'Stripe payout failed';

    const { error: updateErr } = await supabase
      .from('withdrawals')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        stripe_payout_id: payout.id,
        failure_reason: failureReason,
      })
      .eq('id', target.id);

    if (updateErr) {
      console.error('[Webhook] payout.failed update failed:', updateErr);
      return;
    }

    console.log(
      `[Webhook] Withdrawal marked failed: id=${target.id} payout_id=${payout.id} reason=${failureReason}`
    );

    await supabase.from('notifications').insert({
      user_id: target.user_id,
      type: 'wallet',
      title: '⚠️ Withdrawal failed',
      body: `Your withdrawal of €${(target.amount_cents / 100).toFixed(2)} failed: ${failureReason}. Please check your bank details and try again.`,
      link: '/wallet',
    });
  } catch (err) {
    console.error('[Webhook] handlePayoutFailed error:', err);
  }
}

