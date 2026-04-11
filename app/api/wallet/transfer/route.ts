export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      recipient_id?: string
      amount?: number
      currency?: string
      note?: string
    }

    const recipientId = body.recipient_id
    const amount = Number(body.amount)
    const currency = body.currency?.toUpperCase()
    const note = (body.note ?? '').trim().slice(0, 500)

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!recipientId) {
      return NextResponse.json({ error: 'Recipient is required' }, { status: 400 })
    }
    if (recipientId === user.id) {
      return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 })
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }
    if (currency !== 'EUR' && currency !== 'TRUST') {
      return NextResponse.json({ error: 'Currency must be EUR or TRUST' }, { status: 400 })
    }
    if (currency === 'EUR' && amount < 0.01) {
      return NextResponse.json({ error: 'Minimum € transfer is €0.01' }, { status: 400 })
    }
    if (currency === 'TRUST' && (amount !== Math.floor(amount) || amount < 1)) {
      return NextResponse.json({ error: 'Trust transfers must be whole numbers (min ₮1)' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── Verify recipient exists ───────────────────────────────────────────────
    const { data: recipient } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('id', recipientId)
      .maybeSingle()

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // ── Check sender balance ──────────────────────────────────────────────────
    if (currency === 'TRUST') {
      const { data: bal } = await admin
        .from('trust_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()

      const trustBalance = bal?.balance ?? 0
      if (trustBalance < amount) {
        return NextResponse.json(
          { error: `Insufficient trust balance. You have ₮${trustBalance}.` },
          { status: 400 }
        )
      }

      // ── Execute trust transfer ────────────────────────────────────────────
      // Deduct from sender
      const { error: deductErr } = await admin.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount: -amount,
        p_type: 'transfer_sent',
        p_ref: null,
        p_desc: `₮${amount} sent to ${recipient.full_name ?? 'a member'}${note ? ` — ${note}` : ''}`,
      })
      if (deductErr) {
        console.error('[transfer] trust deduct error:', deductErr)
        return NextResponse.json({ error: 'Transfer failed — could not deduct balance' }, { status: 500 })
      }

      // Credit to recipient
      const { error: creditErr } = await admin.rpc('issue_trust', {
        p_user_id: recipientId,
        p_amount: amount,
        p_type: 'transfer_received',
        p_ref: null,
        p_desc: `₮${amount} received from ${(await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()).data?.full_name ?? 'a member'}${note ? ` — ${note}` : ''}`,
      })
      if (creditErr) {
        // Rollback: re-credit sender
        await admin.rpc('issue_trust', {
          p_user_id: user.id,
          p_amount: amount,
          p_type: 'transfer_rollback',
          p_ref: null,
          p_desc: `Rollback: trust transfer to ${recipient.full_name ?? 'a member'} failed`,
        })
        console.error('[transfer] trust credit error:', creditErr)
        return NextResponse.json({ error: 'Transfer failed — could not credit recipient' }, { status: 500 })
      }
    } else {
      // ── EUR transfer ──────────────────────────────────────────────────────
      // Calculate sender's available € balance (same logic as wallet GET)
      const [depositsRes, earnedRes, spentRes, sentTransfersRes, receivedTransfersRes] = await Promise.all([
        admin.from('money_deposits')
          .select('amount_cents')
          .eq('user_id', user.id)
          .eq('status', 'completed'),
        admin.from('orders')
          .select('amount')
          .eq('seller_id', user.id)
          .eq('status', 'completed')
          .neq('delivery_type', 'deposit'),
        admin.from('orders')
          .select('amount')
          .eq('buyer_id', user.id)
          .eq('status', 'completed')
          .neq('delivery_type', 'deposit'),
        admin.from('wallet_transfers')
          .select('amount')
          .eq('sender_id', user.id)
          .eq('currency', 'EUR')
          .eq('status', 'completed'),
        admin.from('wallet_transfers')
          .select('amount')
          .eq('recipient_id', user.id)
          .eq('currency', 'EUR')
          .eq('status', 'completed'),
      ])

      const totalDeposited = (depositsRes.data ?? []).reduce((s, d) => s + ((d as { amount_cents: number }).amount_cents / 100), 0)
      const totalEarned = (earnedRes.data ?? []).reduce((s, o) => s + ((o as { amount: number }).amount ?? 0), 0)
      const totalSpent = (spentRes.data ?? []).reduce((s, o) => s + ((o as { amount: number }).amount ?? 0), 0)
      const totalSent = (sentTransfersRes.data ?? []).reduce((s, t) => s + Number((t as { amount: number }).amount), 0)
      const totalReceived = (receivedTransfersRes.data ?? []).reduce((s, t) => s + Number((t as { amount: number }).amount), 0)

      const available = totalDeposited + totalEarned - totalSpent - totalSent + totalReceived

      if (available < amount) {
        return NextResponse.json(
          { error: `Insufficient balance. You have €${available.toFixed(2)} available.` },
          { status: 400 }
        )
      }
    }

    // ── Record the transfer ───────────────────────────────────────────────────
    const { data: transfer, error: insertErr } = await admin
      .from('wallet_transfers')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        amount,
        currency,
        note,
        status: 'completed',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[transfer] insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to record transfer' }, { status: 500 })
    }

    // ── Get sender name for notification ──────────────────────────────────────
    const { data: senderProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const senderName = senderProfile?.full_name ?? 'Someone'

    // ── Notify recipient ──────────────────────────────────────────────────────
    const symbol = currency === 'EUR' ? '€' : '₮'
    const fmtAmount = currency === 'EUR' ? amount.toFixed(2) : String(amount)

    await admin.from('notifications').insert({
      user_id: recipientId,
      type: 'wallet',
      title: `💸 ${symbol}${fmtAmount} received!`,
      body: `${senderName} sent you ${symbol}${fmtAmount}${note ? ` — "${note}"` : ''}.`,
      link: '/wallet',
    })

    return NextResponse.json({
      transfer: { id: transfer.id, amount, currency, recipient: recipient.full_name },
    })
  } catch (err) {
    console.error('[POST /api/wallet/transfer]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
