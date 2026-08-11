export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spendTrustCoins } from '@/lib/build/spend'
import { callClaude, type ClaudeMessage, type ClaudeContentBlock } from '@/lib/build/claude'
import { MAIN_SYSTEM_PROMPT } from '@/lib/build/prompts'
import { extractDesignSpec, stripDesignSpecFence, GENERATE_COST } from '@/lib/build/spec'
import { normalizeBuildImageUrls, MAX_BUILD_IMAGES_PER_MESSAGE } from '@/lib/build/attachments'
import { downloadBuildImagesAsBase64 } from '@/lib/build/attachments.server'

// POST /api/build/generate
// body: { conversationId?: string, message: string, imageUrls?: string[] }
// Charges GENERATE_COST (7 TC) via spend_trust BEFORE calling Claude.
// Creates the conversation if conversationId is omitted. Stores the
// user turn + assistant turn (with parsed design_spec, if any) and
// upserts the three core sections (brief/design/build_sequence) so the
// "Documents & Downloads" PDF and tab UI can read them without
// re-parsing the chat transcript.
//
// imageUrls are Storage PATHS (not public URLs — the bucket is private)
// in build-attachments, already uploaded client-side before this call.
// Uploading images itself is free; they only ever ride along with a
// Generate call, so no separate charge path exists for them.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { conversationId?: string; message?: string; imageUrls?: string[] } | null
    const message = body?.message?.trim()
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }
    const imageUrls = normalizeBuildImageUrls(body?.imageUrls).slice(0, MAX_BUILD_IMAGES_PER_MESSAGE)

    const admin = createAdminClient()

    // ── Resolve / create the conversation ──────────────────────────────
    let conversationId = body?.conversationId
    if (conversationId) {
      const { data: conv } = await admin
        .from('build_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
    } else {
      const { data: newConv, error: createErr } = await admin
        .from('build_conversations')
        .insert({ user_id: user.id, title: message.slice(0, 80) })
        .select('id')
        .single()
      if (createErr || !newConv) {
        console.error('[POST /api/build/generate] create conversation failed', createErr)
        return NextResponse.json({ error: 'Could not start conversation' }, { status: 500 })
      }
      conversationId = newConv.id
    }

    // ── Charge Trust Coins BEFORE calling the AI ───────────────────────
    const spend = await spendTrustCoins(user.id, GENERATE_COST, 'spend_build_generate', 'Build: generate design')
    if (!spend.ok) {
      if (spend.code === 'insufficient_funds') {
        return NextResponse.json(
          { error: 'Insufficient trust balance', code: 'insufficient_funds', balance: spend.balance, required: spend.required },
          { status: 402 }
        )
      }
      return NextResponse.json({ error: spend.message }, { status: 500 })
    }

    // ── Load prior turns for context ───────────────────────────────────
    // design_spec is selected (not just role/content) so we can tell
    // whether this conversation has ever produced a real design yet —
    // that distinction drives the no-charge/refund logic below.
    const { data: priorMessages } = await admin
      .from('build_messages')
      .select('role, content, design_spec')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40)

    const hasPriorDesign = (priorMessages ?? []).some(
      m => m.role === 'assistant' && m.design_spec != null
    )

    // ── Resolve reference images (if any) into Anthropic image blocks ───
    // Ownership-checked inside downloadBuildImagesAsBase64 — paths not
    // owned by this user are silently dropped rather than downloaded.
    const imageBlocks = imageUrls.length > 0
      ? await downloadBuildImagesAsBase64(admin, user.id, imageUrls)
      : []

    const currentTurnContent: string | ClaudeContentBlock[] = imageBlocks.length > 0
      ? [
          ...imageBlocks.map(b => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: b.media_type, data: b.data } })),
          { type: 'text' as const, text: message },
        ]
      : message

    const claudeMessages: ClaudeMessage[] = [
      ...((priorMessages ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))),
      { role: 'user', content: currentTurnContent },
    ]

    // Record the user's turn immediately (even if the AI call later fails,
    // we don't want to lose the coins-charged prompt from the transcript).
    // image_urls stores the Storage PATHS (not base64) so the chat thread
    // can re-render thumbnails later via signed URLs without re-uploading.
    await admin.from('build_messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: message,
      image_urls: imageUrls,
    })

    let rawReply: string
    try {
      rawReply = await callClaude(MAIN_SYSTEM_PROMPT, claudeMessages, 8192)
    } catch (err) {
      console.error('[POST /api/build/generate] Claude call failed', err)
      const fallback = "Sorry — I couldn't generate a design just now. Your Trust Coins were already spent for this attempt; please try rephrasing your request and I'll try again."
      await admin.from('build_messages').insert({
        conversation_id: conversationId, user_id: user.id, role: 'assistant', content: fallback,
      })
      return NextResponse.json({
        conversationId, reply: fallback, designSpec: null, renderError: true, newBalance: spend.newBalance,
      })
    }

    const designSpec = extractDesignSpec(rawReply)
    // Did Claude even attempt a ```json fence? If not, this is a genuine
    // conversational turn (e.g. a greeting or a clarifying follow-up) —
    // not a technical failure — regardless of whether a design already
    // exists in this conversation. Only a present-but-unparseable fence
    // counts as a real render error worth warning the user about.
    const hasFence = /```/.test(rawReply)
    const isGenuineFailure = !designSpec && hasFence
    // Never charge for the very first design-less turn(s) of a brand-new
    // conversation — if nothing has ever been designed yet and this turn
    // didn't produce one either (conversational or malformed), refund the
    // Generate charge. Once a design exists, later no-spec turns (follow-up
    // questions, clarifications) are refinement turns on an existing paid
    // design and are charged normally — see lib/build/prompts.ts + bug
    // writeup in .memory/capabilities/freetrust-build-studio.md.
    const shouldRefund = !designSpec && !hasPriorDesign

    let refunded = false
    let newBalance = spend.newBalance
    if (shouldRefund) {
      const { error: refundErr } = await admin.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount: GENERATE_COST,
        p_type: 'refund_build_generate',
        p_ref: null,
        p_desc: 'Build: no design produced yet — refund',
      })
      if (refundErr) {
        console.error('[POST /api/build/generate] refund failed', refundErr)
      } else {
        refunded = true
        const { data: bal } = await admin
          .from('trust_balances')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle()
        if (bal && typeof bal.balance === 'number') newBalance = bal.balance
      }
    }

    // The user-visible "warning" state (both the chat-bubble ⚠️ line and
    // the 3D viewer's overlay banner) is reserved for genuine parse
    // failures — a fence Claude attempted but that didn't parse. A
    // fenceless conversational reply (greeting, clarifying question) is
    // just... a reply, and should read like one.
    const conversationalReply = designSpec
      ? (stripDesignSpecFence(rawReply) || 'Design updated — see the viewer above.')
      : isGenuineFailure
        ? (stripDesignSpecFence(rawReply) || "Design could not be rendered — try rephrasing.")
        : rawReply.trim()

    const { data: savedMessage, error: saveErr } = await admin
      .from('build_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: conversationalReply,
        design_spec: designSpec,
      })
      .select('id, created_at')
      .single()

    if (saveErr) {
      console.error('[POST /api/build/generate] save assistant message failed', saveErr)
    }

    // Upsert the three core sections from the conversational reply so the
    // tab UI / PDF export has structured content without re-parsing chat.
    // Only do this when a design was actually produced this turn — a
    // conversational reply (greeting, clarifying question) has no
    // meaningful "Brief & Vision"/"Design"/"Build Sequence" content and
    // upserting it would overwrite good section content from an earlier
    // turn with junk.
    if (designSpec) {
      const sectionExtract = (label: string) => {
        const re = new RegExp(`\\*\\*${label}\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[A-Z]|$)`, 'i')
        const m = conversationalReply.match(re)
        return m ? m[1].trim() : conversationalReply
      }

      const coreSections = [
        { section_key: 'brief', content: sectionExtract('Brief & Vision') },
        { section_key: 'design', content: sectionExtract('Design') },
        { section_key: 'build_sequence', content: sectionExtract('Build Sequence') },
      ]

      for (const s of coreSections) {
        await admin.from('build_sections').upsert({
          conversation_id: conversationId,
          user_id: user.id,
          section_key: s.section_key,
          content: s.content,
          cost_spent: 0,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,section_key' })
      }
    }

    // Keep conversation title fresh on first generate + bump updated_at.
    await admin.from('build_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({
      conversationId,
      messageId: savedMessage?.id ?? null,
      reply: conversationalReply,
      designSpec,
      renderError: isGenuineFailure,
      refunded,
      newBalance,
      cost: GENERATE_COST,
    })
  } catch (err) {
    console.error('[POST /api/build/generate] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
