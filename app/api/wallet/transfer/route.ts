export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'

async function createTransferReceiptMessage({
  admin,
  transferId,
  senderId,
  recipientId,
  amount,
  currency,
  note,
  recipientName,
}: {
  admin: ReturnType<typeof createAdminClient>
  transferId: string
  senderId: string
  recipientId: string
  amount: number
  currency: string
  note: string
  recipientName: string | null
}) {
  const { data: senderConversations, error: senderConversationError } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', senderId)

  if (senderConversationError) throw senderConversationError

  const conversationIds = (senderConversations ?? []).map(row => row.conversation_id as string)
  let conversationId: string | null = null

  if (conversationIds.length > 0) {
    const { data: sharedConversation, error: sharedConversationError } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', recipientId)
      .in('conversation_id', conversationIds)
      .limit(1)

    if (sharedConversationError) throw sharedConversationError
    conversationId = sharedConversation?.[0]?.conversation_id as string | null ?? null
  }

  if (!conversationId) {
    const nowIso = new Date().toISOString()
    const { data: newConversation, error: conversationError } = await admin
      .from('conversations')
      .insert({ created_at: nowIso, updated_at: nowIso, last_message_at: nowIso })
      .select('id')
      .single()

    if (conversationError || !newConversation) throw conversationError ?? new Error('Could not create transfer conversation')
    conversationId = newConversation.id as string

    const { error: participantError } = await admin
      .from('conversation_participants')
      .insert([
        { conversation_id: conversationId, user_id: senderId, last_read_at: nowIso },
        { conversation_id: conversationId, user_id: recipientId, last_read_at: null },
      ])

    if (participantError) {
      await admin.from('conversations').delete().eq('id', conversationId)
      throw participantError
    }
  }

  const { data: existingReceipt, error: existingReceiptError } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .contains('metadata', { type: 'wallet_transfer', transfer_id: transferId })
    .limit(1)

  if (existingReceiptError) throw existingReceiptError
  if (existingReceipt && existingReceipt.length > 0) return

  const symbol = currency === 'EUR' ? '€' : '₮'
  const formattedAmount = currency === 'EUR' ? amount.toFixed(2) : String(amount)
  const { error: messageError } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: `Transfer completed: ${symbol}${formattedAmount} sent to ${recipientName ?? 'a member'}`,
      metadata: {
        type: 'wallet_transfer',
        transfer_id: transferId,
        amount,
        currency,
        note: note || null,
        sender_id: senderId,
        recipient_id: recipientId,
        status: 'completed',
      },
    })

  if (messageError) throw messageError
}

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

    // ── Quick table existence check ──────────────────────────────────────────
    // If wallet_transfers doesn't exist yet, the insert will fail with 42P01.
    // We do a lightweight probe here to give a clearer error early.
    const { error: probeErr } = await admin
      .from('wallet_transfers')
      .select('id')
      .limit(0)
    if (probeErr && (probeErr.message?.includes('does not exist') || probeErr.code === '42P01')) {
      console.error('[transfer] wallet_transfers table does not exist. Run the migration.')
      return NextResponse.json(
        { error: 'Transfers are not set up yet. Please run the wallet_transfers migration in Supabase.' },
        { status: 500 }
      )
    }

    // ── Verify recipient exists ───────────────────────────────────────────────
    const { data: recipient, error: recipientErr } = await admin
      .from('profiles')
      .select('id, full_name')
      .eq('id', recipientId)
      .maybeSingle()

    console.log('[transfer] recipient lookup:', recipient?.id ?? 'not found', recipientErr?.message ?? 'ok')

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // ── Get sender name up front ──────────────────────────────────────────────
    const { data: senderProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const senderName = senderProfile?.full_name ?? 'Someone'

    // ── Check sender balance & execute ────────────────────────────────────────
    if (currency === 'TRUST') {
      const { data: bal } = await admin
        .from('trust_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()

      const trustBalance = bal?.balance ?? 0
      console.log('[transfer] TRUST balance check:', trustBalance, 'need:', amount)

      if (trustBalance < amount) {
        return NextResponse.json(
          { error: `Insufficient trust balance. You have ₮${trustBalance}.` },
          { status: 400 }
        )
      }

      // Deduct from sender
      const { error: deductErr } = await admin.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount: -amount,
        p_type: 'transfer_sent',
        p_ref: null,
        p_desc: `₮${amount} sent to ${recipient.full_name ?? 'a member'}${note ? ` — ${note}` : ''}`,
      })
      if (deductErr) {
        console.error('[transfer] trust deduct error:', JSON.stringify(deductErr))
        return NextResponse.json({ error: 'Transfer failed — could not deduct balance' }, { status: 500 })
      }

      // Credit to recipient
      const { error: creditErr } = await admin.rpc('issue_trust', {
        p_user_id: recipientId,
        p_amount: amount,
        p_type: 'transfer_received',
        p_ref: null,
        p_desc: `₮${amount} received from ${senderName}${note ? ` — ${note}` : ''}`,
      })
      if (creditErr) {
        console.error('[transfer] trust credit error:', JSON.stringify(creditErr))
        // Rollback: re-credit sender
        await admin.rpc('issue_trust', {
          p_user_id: user.id,
          p_amount: amount,
          p_type: 'transfer_rollback',
          p_ref: null,
          p_desc: `Rollback: trust transfer to ${recipient.full_name ?? 'a member'} failed`,
        })
        return NextResponse.json({ error: 'Transfer failed — could not credit recipient' }, { status: 500 })
      }
    } else {
      // ── EUR balance check ──────────────────────────────────────────────────
      const [depositsRes, earnedRes, spentRes, sentRes, recvRes] = await Promise.all([
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

      // Log any query errors (e.g. table doesn't exist)
      if (depositsRes.error) console.error('[transfer] deposits query error:', depositsRes.error.message)
      if (earnedRes.error) console.error('[transfer] earned query error:', earnedRes.error.message)
      if (spentRes.error) console.error('[transfer] spent query error:', spentRes.error.message)
      if (sentRes.error) console.error('[transfer] sent transfers query error:', sentRes.error.message)
      if (recvRes.error) console.error('[transfer] recv transfers query error:', recvRes.error.message)

      const totalDeposited = (depositsRes.data ?? []).reduce((s, d) => s + ((d as { amount_cents: number }).amount_cents / 100), 0)
      const totalEarned = (earnedRes.data ?? []).reduce((s, o) => s + ((o as { amount: number }).amount ?? 0), 0)
      const totalSpent = (spentRes.data ?? []).reduce((s, o) => s + ((o as { amount: number }).amount ?? 0), 0)
      const totalSent = (sentRes.data ?? []).reduce((s, t) => s + Number((t as { amount: number }).amount), 0)
      const totalReceived = (recvRes.data ?? []).reduce((s, t) => s + Number((t as { amount: number }).amount), 0)

      const available = totalDeposited + totalEarned - totalSpent - totalSent + totalReceived
      console.log('[transfer] EUR balance:', { totalDeposited, totalEarned, totalSpent, totalSent, totalReceived, available, need: amount })

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
      console.error('[transfer] insert error:', JSON.stringify(insertErr))
      // Table might not exist — return helpful error
      if (insertErr.message?.includes('does not exist') || insertErr.code === '42P01') {
        return NextResponse.json(
          { error: 'Transfers table not set up. Please run the wallet_transfers migration.' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: `Failed to record transfer: ${insertErr.message}` }, { status: 500 })
    }

    console.log('[transfer] recorded:', transfer.id, currency, amount, 'from', user.id, 'to', recipientId)

    // The wallet mutation is already complete. A receipt is best-effort so a
    // messaging outage can never make a successful transfer look failed.
    await createTransferReceiptMessage({
      admin,
      transferId: transfer.id as string,
      senderId: user.id,
      recipientId,
      amount,
      currency,
      note,
      recipientName: recipient.full_name as string | null,
    }).catch(err => console.error('[transfer] receipt message failed:', err))

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

    // Fire-and-forget email (preference-checked, never throws)
    sendEmail({
      type: 'transfer_received',
      userId: recipientId,
      payload: { senderName, amount, currency, note: note || null },
    }).catch(() => { /* safety net */ })

    return NextResponse.json({
      transfer: { id: transfer.id, amount, currency, recipient: recipient.full_name },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/wallet/transfer] unhandled:', message, err)
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 })
  }
}
