export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'
import { sendEmail } from '@/lib/email/send'
import {
  ALLOWED_MESSAGE_ATTACHMENT_TYPES,
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENT_BYTES,
  normalizeMessageAttachments,
  type MessageAttachment,
} from '@/lib/messageAttachments'

const MAX_MESSAGE_CHARS = 2000
const MESSAGE_RATE_LIMIT_WINDOW_MS = 60_000
const MESSAGE_RATE_LIMIT_MAX = 20
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const messageRateBuckets = new Map<string, number[]>()

const OFF_PLATFORM_PAYMENT_RE = /\b(?:cash\s?app|venmo|paypal|revolut|western\s+union|bank\s+transfer|wire\s+transfer|pay\s+outside|outside\s+free\s*trust|off\s*platform|send\s+me\s+money|crypto|bitcoin|btc|usdt)\b/i

function normalizeMessageContent(input: string): string {
  return input.replace(/\0/g, '').replace(/\r\n/g, '\n').trim()
}

function validateAttachmentPayload(attachments: MessageAttachment[], userId: string, conversationId: string): string | null {
  if (attachments.length > MAX_MESSAGE_ATTACHMENTS) {
    return `You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files per message.`
  }
  for (const attachment of attachments) {
    if (!attachment.url || !attachment.name || !attachment.type) return 'Attachment metadata is incomplete.'
    if (!attachment.url.startsWith(`${userId}/${conversationId}/`)) return 'Attachment path is not valid for this conversation.'
    if (attachment.size > MAX_MESSAGE_ATTACHMENT_BYTES) return `${attachment.name} is too large. The limit is 10 MB per file.`
    if (!ALLOWED_MESSAGE_ATTACHMENT_TYPES.has(attachment.type)) return `${attachment.name} is not a supported file type.`
  }
  return null
}

function checkMessageRateLimit(userId: string, conversationId: string): boolean {
  const key = `${userId}:${conversationId}`
  const now = Date.now()
  const recent = (messageRateBuckets.get(key) ?? []).filter(ts => now - ts < MESSAGE_RATE_LIMIT_WINDOW_MS)
  if (recent.length >= MESSAGE_RATE_LIMIT_MAX) {
    messageRateBuckets.set(key, recent)
    return false
  }
  recent.push(now)
  messageRateBuckets.set(key, recent)
  return true
}

async function getOtherParticipantIds(conversationId: string, userId: string): Promise<string[] | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', userId)

  if (error) {
    console.error('[api/messages/:id] other participants check failed:', error)
    return null
  }

  return (data ?? [])
    .map(row => row.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

// Participation check uses the admin (service-role) client so it
// bypasses RLS cleanly. We've already validated `user.id` from the
// auth session via the user-session client, so looking up whether
// that id has a row in conversation_participants for the given
// conversation is safe to do with the admin client — the caller
// cannot spoof a different user id.
//
// Why this matters: the user-session client is subject to RLS on
// conversation_participants. If the production DB is still on the
// broken self-referential participants_select policy (fixed by
// 20260415000009_messaging_rls.sql but not applied yet in every
// environment), the SELECT raises infinite-recursion, `data` is
// null, and the route returns 403. The /messages/[id] page then
// redirects to /messages, which looks from the user's side like
// "the Message button goes to the inbox instead of the thread".
async function assertParticipant(conversationId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id',         userId)
    .maybeSingle()
  if (error) {
    console.error('[api/messages/:id] participation check failed:', error)
    return false
  }
  return !!data
}

// GET /api/messages/[conversationId] — list messages in conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = params
    if (!UUID_RE.test(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 })
    }

    const isParticipant = await assertParticipant(conversationId, user.id)
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Not a participant in this conversation' },
        { status: 403 },
      )
    }

    // Message fetch also via admin client for the same reason —
    // the message_select RLS policy subqueries conversation_
    // participants, so it also trips the infinite-recursion bug
    // on a DB that hasn't had the fix applied yet.
    const admin = createAdminClient()
    const { data: messages, error: msgErr } = await admin
      .from('messages')
      .select('*, sender:profiles(id, full_name, avatar_url), read_receipts:message_reads(user_id, read_at)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgErr) {
      console.error('[GET /api/messages/:id] messages fetch failed:', msgErr)
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // Mark as read — update last_read_at on the caller's
    // participant row. Also admin-client so RLS can't block it.
    await admin
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id',         user.id)

    return NextResponse.json({ messages: messages || [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/messages/:id]', msg, err)
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages/[conversationId] — send a message in conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = params
    if (!UUID_RE.test(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 })
    }

    const body = await request.json().catch(() => null) as { content?: unknown; attachments?: unknown; replyToId?: unknown; reply_to_id?: unknown } | null
    const rawContent = body?.content
    const attachments = normalizeMessageAttachments(body?.attachments)
    const replyToId = typeof body?.replyToId === 'string'
      ? body.replyToId
      : (typeof body?.reply_to_id === 'string' ? body.reply_to_id : null)
    if (typeof rawContent !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }
    const content = normalizeMessageContent(rawContent)
    const attachmentError = validateAttachmentPayload(attachments, user.id, conversationId)
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 })
    }
    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: 'Message content or an attachment is required' }, { status: 400 })
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message is too long. Please keep messages under ${MAX_MESSAGE_CHARS} characters.` },
        { status: 400 },
      )
    }
    if (replyToId && !UUID_RE.test(replyToId)) {
      return NextResponse.json({ error: 'Invalid reply target' }, { status: 400 })
    }

    const isParticipant = await assertParticipant(conversationId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    const admin = createAdminClient()

    if (replyToId) {
      const { data: replyTarget, error: replyErr } = await admin
        .from('messages')
        .select('id')
        .eq('id', replyToId)
        .eq('conversation_id', conversationId)
        .maybeSingle()
      if (replyErr) {
        console.error('[POST /api/messages/:id] reply target check failed:', replyErr)
        return NextResponse.json({ error: 'Could not verify reply target' }, { status: 500 })
      }
      if (!replyTarget) {
        return NextResponse.json({ error: 'Reply target is not in this conversation' }, { status: 400 })
      }
    }

    const otherParticipantIds = await getOtherParticipantIds(conversationId, user.id)
    if (!otherParticipantIds || otherParticipantIds.length === 0) {
      return NextResponse.json({ error: 'Conversation recipient is unavailable' }, { status: 409 })
    }

    const { data: recipientProfiles, error: recipientErr } = await admin
      .from('profiles')
      .select('id')
      .in('id', otherParticipantIds)

    if (recipientErr) {
      console.error('[POST /api/messages/:id] recipient profile check failed:', recipientErr)
      return NextResponse.json({ error: 'Could not verify conversation recipient' }, { status: 500 })
    }

    if ((recipientProfiles ?? []).length === 0) {
      return NextResponse.json({ error: 'Conversation recipient is unavailable' }, { status: 409 })
    }

    if (!checkMessageRateLimit(user.id, conversationId)) {
      return NextResponse.json(
        { error: 'You are sending messages too quickly. Please wait a moment and try again.' },
        { status: 429 },
      )
    }

    const safetyWarning = OFF_PLATFORM_PAYMENT_RE.test(content)
      ? 'For your protection, keep payments and order details inside FreeTrust.'
      : null

    // Insert message via the admin client for the same reason as
    // the GET path — decouples from the RLS migration having run.
    const { data: message, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       user.id,
        content,
        attachments,
        reply_to_id:     replyToId,
      })
      .select('*, read_receipts:message_reads(user_id, read_at)')
      .single()

    if (msgErr) {
      console.error('[POST /api/messages/:id] insert failed:', msgErr)
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // Update conversation timestamp + sender last_read_at. Both
    // via admin client. Done in parallel since they're independent.
    const nowIso = new Date().toISOString()
    await Promise.all([
      admin
        .from('conversations')
        .update({ updated_at: nowIso, last_message_at: nowIso })
        .eq('id', conversationId),
      admin
        .from('conversation_participants')
        .update({ last_read_at: nowIso })
        .eq('conversation_id', conversationId)
        .eq('user_id',         user.id),
    ])

    // Notify the OTHER participant(s) of the conversation. In-app
    // notification + email fan-out. Non-blocking via catch handlers
    // so a Resend outage or notifications-table hiccup can't fail
    // the send.
    //
    // Scoped to participants other than the sender. For 1:1 convs
    // that's one user; for future group chats this naturally scales.
    void (async () => {
      try {
        const [{ data: others }, { data: senderProfile }] = await Promise.all([
          admin
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversationId)
            .neq('user_id', user.id),
          admin
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle(),
        ])

        const senderName = (senderProfile?.full_name as string | null) ?? 'A member'
        const preview   = content.slice(0, 140)
        const link      = `/messages/${conversationId}`

        await Promise.all(
          (others ?? []).map(async row => {
            const recipientId = row.user_id as string
            await insertNotification({
              userId: recipientId,
              type:   'new_message',
              title:  `New message from ${senderName}`,
              body:   preview,
              link,
            })
            await sendEmail({
              type:    'new_message',
              userId:  recipientId,
              payload: { senderName, preview },
            }).catch(err => console.error('[messages] new_message email threw:', err))
          }),
        )
      } catch (err) {
        console.error('[messages] notify fan-out threw:', err)
      }
    })()

    return NextResponse.json({ message, warning: safetyWarning })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/messages/:id]', msg, err)
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}
