export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/conversations — find-or-create a 1:1 conversation
//
// The "Message" button on a profile page calls this with the target
// user's id. Behaviour:
//
//   1. Require an authenticated session (401 otherwise)
//   2. Validate recipientId is present, a uuid, and not the caller
//      themselves
//   3. Check whether a conversation already exists with BOTH users
//      as participants. Never create a duplicate: opening a chat
//      with the same person twice must return the same conversationId.
//   4. If no existing conversation: create a new conversations row,
//      insert both conversation_participants rows, return the new id
//   5. Respond with { conversationId: uuid }
//
// The admin (service-role) client is used for the writes so we
// bypass RLS cleanly — the new RLS policies from
// supabase/migrations/20260415000009_messaging_rls.sql are correct
// but using the service role means the API route never depends on
// the caller's session having the right policies loaded.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  console.log('[conversations] POST called')
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      console.warn('[conversations] ERROR: unauthorized, no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[conversations] authenticated as:', user.id)

    const body = await req.json().catch(() => null) as {
      recipientId?: unknown
      // Optional order/listing context — only included when the
      // caller is explicitly tying the conversation to a purchase
      // flow. Direct profile-to-profile messages leave these
      // undefined and the conversation row is created with those
      // columns NULL (see 20260416000004_conversations_nullable_cols.sql
      // which drops the legacy NOT NULL constraints).
      buyerId?:    unknown
      sellerId?:   unknown
      listingId?:  unknown
    } | null
    console.log('[conversations] body:', body)
    const recipientIdRaw = body?.recipientId
    if (typeof recipientIdRaw !== 'string' || !UUID_RE.test(recipientIdRaw)) {
      console.warn('[conversations] ERROR: bad recipientId:', recipientIdRaw)
      return NextResponse.json(
        { error: 'recipientId must be a valid uuid' },
        { status: 400 },
      )
    }
    const recipientId = recipientIdRaw

    // Optional purchase-context ids. Validated as uuids when
    // present; skipped entirely otherwise.
    const buyerId    = typeof body?.buyerId    === 'string' && UUID_RE.test(body.buyerId)    ? body.buyerId    : null
    const sellerId   = typeof body?.sellerId   === 'string' && UUID_RE.test(body.sellerId)   ? body.sellerId   : null
    const listingId  = typeof body?.listingId  === 'string' && UUID_RE.test(body.listingId)  ? body.listingId  : null

    if (recipientId === user.id) {
      console.warn('[conversations] ERROR: self-message attempt')
      return NextResponse.json(
        { error: 'Cannot start a conversation with yourself' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Dedup lookup — fetch every conversation the caller is in,
    // then check which of those also contain the recipient. Two
    // round-trips instead of a self-join because the RLS-friendly
    // way to express this across .in() filters is unambiguous
    // and fast (indexed on user_id).
    const { data: myRows, error: myRowsErr } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (myRowsErr) {
      console.error('[conversations] ERROR: myRows fetch failed:', myRowsErr)
      return NextResponse.json({ error: myRowsErr.message }, { status: 500 })
    }
    console.log('[conversations] myRows count:', myRows?.length ?? 0)

    const myConvIds = (myRows ?? []).map(r => r.conversation_id as string)
    if (myConvIds.length > 0) {
      const { data: shared, error: sharedErr } = await admin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', recipientId)
        .in('conversation_id', myConvIds)
        .limit(1)

      if (sharedErr) {
        console.error('[conversations] ERROR: shared fetch failed:', sharedErr)
        return NextResponse.json({ error: sharedErr.message }, { status: 500 })
      }

      if (shared && shared.length > 0) {
        const conversationId = shared[0].conversation_id as string
        console.log('[conversations] returning EXISTING conversationId:', conversationId)
        return NextResponse.json({
          conversationId,
          created: false,
        })
      }
    }

    // Create a new conversation. We insert via the admin client so
    // the conversations_insert policy is not required for the API
    // route to work — the new RLS still applies to browser-side
    // SELECTs afterwards, so the caller still only sees their own
    // conversations from the client.
    const nowIso = new Date().toISOString()

    // Only include purchase-context columns when the caller has
    // explicitly supplied them. Direct profile-to-profile DMs omit
    // buyer_id / seller_id / listing_id entirely — with the
    // NOT NULL constraints removed by
    // 20260416000004_conversations_nullable_cols.sql, the columns
    // stay NULL and the row is valid. Including an undefined key
    // would serialize as `"buyer_id": null` which is fine post-
    // migration but we keep the insert payload clean for clarity.
    const insertData: Record<string, unknown> = {
      created_at:      nowIso,
      updated_at:      nowIso,
      last_message_at: nowIso,
      ...(buyerId   ? { buyer_id:   buyerId   } : {}),
      ...(sellerId  ? { seller_id:  sellerId  } : {}),
      ...(listingId ? { listing_id: listingId } : {}),
    }

    const { data: newConv, error: convErr } = await admin
      .from('conversations')
      .insert(insertData)
      .select('id')
      .single()

    if (convErr || !newConv) {
      console.error('[conversations] ERROR: create failed:', convErr)
      return NextResponse.json(
        { error: convErr?.message || 'Could not create conversation' },
        { status: 500 },
      )
    }
    console.log('[conversations] created new conversation row:', newConv.id)

    // Add both participants atomically. If this fails we try to
    // roll back the conversation row so we don't leave an orphan
    // (no participants → would be invisible to both users forever).
    const { error: partErr } = await admin
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: user.id,     last_read_at: nowIso },
        { conversation_id: newConv.id, user_id: recipientId, last_read_at: null   },
      ])

    if (partErr) {
      console.error('[conversations] ERROR: participants insert failed, rolling back:', partErr)
      await admin.from('conversations').delete().eq('id', newConv.id)
      return NextResponse.json({ error: partErr.message }, { status: 500 })
    }
    console.log('[conversations] participants inserted for both users')

    console.log('[conversations] returning NEW conversationId:', newConv.id)
    return NextResponse.json({
      conversationId: newConv.id as string,
      created:        true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[conversations] ERROR: unexpected:', msg, err)
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 },
    )
  }
}
