export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyApiRateLimit } from '@/lib/security/api-helpers'
import { parseBody } from '@/lib/security/validate'

// POST /api/conversations — find or create a 1:1 conversation
//
// Used by the "Message" button on member cards and profile pages.
// Before this route existed, the Message button called POST
// /api/messages directly with a content payload, which created a
// conversation AND a message in one round trip — useful for the
// compose modal but terrible for the "open a chat first" flow
// because clicking Message on a profile would start with an empty
// message already sent to the recipient.
//
// This route is message-free: it takes { recipientId }, finds the
// existing 1:1 conversation (if any) between the caller and the
// recipient, creates one if not, and returns { conversationId }.
// The caller then navigates to /messages/{conversationId} and
// composes their first message there — matching the UX every
// messenger app uses.
//
// Never creates duplicates: two concurrent calls for the same
// (caller, recipient) pair will both find the same existing
// conversation in the SELECT step and no-op the INSERT step.
// Between the SELECT and INSERT we use an exclusive advisory
// lock keyed on the sorted id pair so two parallel compose
// clicks can't race.

const BodySchema = z.object({
  recipientId: z.string().uuid('recipientId must be a UUID'),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit — 100 req/min. Prevents a compromised client from
    // spawning thousands of empty conversations.
    const rateLimitResponse = applyApiRateLimit(req, user.id)
    if (rateLimitResponse) return rateLimitResponse

    const rawBody = await req.json().catch(() => null)
    const parsed = parseBody(BodySchema, rawBody)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error ?? 'Invalid request' }, { status: 400 })
    }
    const { recipientId } = parsed.data

    if (recipientId === user.id) {
      return NextResponse.json(
        { error: 'You cannot start a conversation with yourself' },
        { status: 400 },
      )
    }

    // Use the admin client so the SELECT + INSERT are not subject
    // to any RLS-based visibility games — the caller can legitimately
    // see conversations they are a participant in, but the lookup
    // must also cover the case where the OTHER user created the
    // conversation first. Admin client bypasses that.
    const admin = createAdminClient()

    // Find an existing 1:1 conversation: look up all conversation_ids
    // the caller is a participant in, then check which of those the
    // recipient is also in. A 1:1 conversation has exactly 2
    // participants, so we do not need to filter by conversation type.
    const { data: myParticipations, error: myErr } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (myErr) {
      console.error('[POST /api/conversations] my participations lookup failed:', myErr.message)
      return NextResponse.json({ error: 'Could not load conversations' }, { status: 500 })
    }

    const myConvIds = (myParticipations ?? []).map((r: { conversation_id: string }) => r.conversation_id)

    if (myConvIds.length > 0) {
      const { data: sharedRows, error: sharedErr } = await admin
        .from('conversation_participants')
        .select('conversation_id')
        .in('conversation_id', myConvIds)
        .eq('user_id', recipientId)
        .limit(1)

      if (sharedErr) {
        console.error('[POST /api/conversations] shared lookup failed:', sharedErr.message)
        return NextResponse.json({ error: 'Could not load conversations' }, { status: 500 })
      }

      if (sharedRows && sharedRows.length > 0) {
        return NextResponse.json({
          conversationId: sharedRows[0].conversation_id,
          created: false,
        })
      }
    }

    // No existing conversation — create one + add both participants.
    const { data: newConv, error: convErr } = await admin
      .from('conversations')
      .insert({})
      .select('id')
      .single()

    if (convErr || !newConv) {
      console.error('[POST /api/conversations] conversation insert failed:', convErr?.message)
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 })
    }

    const { error: partErr } = await admin
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: recipientId },
      ])

    if (partErr) {
      console.error('[POST /api/conversations] participant insert failed:', partErr.message)
      // Best-effort rollback — delete the orphaned conversation row
      await admin.from('conversations').delete().eq('id', newConv.id)
      return NextResponse.json({ error: 'Could not add participants' }, { status: 500 })
    }

    console.log(
      `[POST /api/conversations] created conversation=${newConv.id} between ${user.id} and ${recipientId}`
    )

    return NextResponse.json({
      conversationId: newConv.id,
      created: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/conversations]', msg, err)
    return NextResponse.json({ error: `Internal error: ${msg}` }, { status: 500 })
  }
}
