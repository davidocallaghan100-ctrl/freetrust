export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'
import { sendEmail } from '@/lib/email/send'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, maxLength) : ''
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * A custom order is a seller-initiated proposal. Purpose is the normal
 * onboarding signal; an existing listing is a useful fallback for legacy
 * profiles that pre-date the purpose field.
 */
async function hasSellerAccess(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('purpose')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('[POST /api/orders/custom] seller profile lookup failed:', profileError.message)
  }

  const purposes = Array.isArray(profile?.purpose)
    ? profile.purpose.filter((value): value is string => typeof value === 'string').map(value => value.toLowerCase())
    : []
  if (purposes.includes('selling') || purposes.includes('both')) return true

  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select('id')
    .eq('seller_id', userId)
    .limit(1)
    .maybeSingle()

  if (listingError) {
    // A missing/legacy listings table should not turn a valid purpose-based
    // seller into a 500. It simply means the fallback is unavailable.
    console.error('[POST /api/orders/custom] seller listing lookup failed:', listingError.message)
  }

  return !!listing
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as {
      conversation_id?: unknown
      recipient_id?: unknown
      title?: unknown
      description?: unknown
      amount?: unknown
      delivery_details?: unknown
      delivery_days?: unknown
    } | null

    const conversationId = body?.conversation_id
    const recipientId = body?.recipient_id
    const title = cleanText(body?.title, 120)
    const description = cleanText(body?.description, 2000)
    const deliveryDetails = cleanText(body?.delivery_details, 1000)
    const amount = Math.round(Number(body?.amount) * 100) / 100
    const deliveryDaysRaw = Number(body?.delivery_days ?? 7)
    const deliveryDays = Number.isInteger(deliveryDaysRaw) ? deliveryDaysRaw : 7

    if (!isUuid(conversationId) || !isUuid(recipientId)) {
      return NextResponse.json({ error: 'A valid conversation and recipient are required' }, { status: 400 })
    }
    if (recipientId === user.id) {
      return NextResponse.json({ error: 'Cannot create a custom order for yourself' }, { status: 400 })
    }
    if (title.length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (description.length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: 'Amount must be greater than zero and no more than €1,000,000' }, { status: 400 })
    }
    if (deliveryDays < 1 || deliveryDays > 365) {
      return NextResponse.json({ error: 'Delivery timeframe must be between 1 and 365 days' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!(await hasSellerAccess(admin, user.id))) {
      return NextResponse.json({ error: 'Custom orders are available to sellers only' }, { status: 403 })
    }

    const [{ data: recipient, error: recipientError }, { data: participants, error: participantsError }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name')
        .eq('id', recipientId)
        .maybeSingle(),
      admin
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .in('user_id', [user.id, recipientId]),
    ])

    if (recipientError) {
      console.error('[POST /api/orders/custom] recipient lookup failed:', recipientError.message)
      return NextResponse.json({ error: 'Could not verify the recipient' }, { status: 500 })
    }
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }
    if (participantsError) {
      console.error('[POST /api/orders/custom] conversation lookup failed:', participantsError.message)
      return NextResponse.json({ error: 'Could not verify this conversation' }, { status: 500 })
    }

    const participantIds = new Set((participants ?? []).map(row => row.user_id as string))
    if (!participantIds.has(user.id) || !participantIds.has(recipientId)) {
      return NextResponse.json({ error: 'Both members must be in the selected conversation' }, { status: 403 })
    }

    const notes = [
      description,
      deliveryDetails ? `Delivery details: ${deliveryDetails}` : null,
      `Delivery timeframe: ${deliveryDays} day${deliveryDays === 1 ? '' : 's'}`,
    ].filter(Boolean).join('\n\n')

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: user.id === recipientId ? user.id : recipientId,
        seller_id: user.id,
        listing_id: null,
        title,
        amount,
        currency: 'EUR',
        type: 'custom',
        notes,
        // Orders use the escrow lifecycle status; `pending` is rejected by
        // the live orders check constraint. The buyer still sees this as a
        // pending proposal until they proceed through the order flow.
        status: 'pending_escrow',
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error('[POST /api/orders/custom] order insert failed:', orderError)
      return NextResponse.json({ error: orderError?.message ?? 'Failed to create custom order' }, { status: 500 })
    }

    const metadata = {
      type: 'custom_order',
      order_id: order.id,
      title,
      description,
      amount,
      currency: 'EUR',
      seller_id: user.id,
      buyer_id: recipientId,
      delivery_days: deliveryDays,
      status: 'pending',
    }
    const { data: message, error: messageError } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `Custom order proposal: ${title}`,
        metadata,
      })
      .select('*')
      .single()

    let warning: string | null = null
    if (messageError) {
      console.error('[POST /api/orders/custom] order message insert failed:', messageError)
      warning = 'The order was created, but the proposal could not be added to the conversation.'
    }

    const [{ data: sellerProfile }, { data: buyerProfile }] = await Promise.all([
      admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      admin.from('profiles').select('full_name').eq('id', recipientId).maybeSingle(),
    ])
    const sellerName = sellerProfile?.full_name ?? 'A seller'
    const buyerName = buyerProfile?.full_name ?? recipient.full_name ?? 'A member'
    const amountLabel = `€${amount.toFixed(2)}`

    void Promise.all([
      insertNotification({
        userId: recipientId,
        type: 'order',
        title: `Custom order from ${sellerName}`,
        body: `${sellerName} sent you a custom order proposal for ${amountLabel}.`,
        link: `/orders/${order.id}`,
      }),
      insertNotification({
        userId: user.id,
        type: 'order',
        title: `Custom order sent to ${buyerName}`,
        body: `Your custom order proposal for ${amountLabel} is pending.` ,
        link: `/orders/${order.id}`,
      }),
      sendEmail({
        type: 'order_placed',
        userId: recipientId,
        payload: { orderTitle: title, amount, orderId: order.id },
      }),
      sendEmail({
        type: 'order_placed',
        userId: user.id,
        payload: { orderTitle: title, amount, orderId: order.id },
      }),
    ]).catch(error => console.error('[POST /api/orders/custom] side effects failed:', error))

    return NextResponse.json({ order, message: message ?? null, warning }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/orders/custom] unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
