export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spendTrustCoins } from '@/lib/build/spend'
import { callClaude, type ClaudeMessage } from '@/lib/build/claude'
import { MAIN_SYSTEM_PROMPT } from '@/lib/build/prompts'
import { extractDesignSpec, stripDesignSpecFence, GENERATE_COST } from '@/lib/build/spec'

// POST /api/build/generate
// body: { conversationId?: string, message: string }
// Charges GENERATE_COST (7 TC) via spend_trust BEFORE calling Claude.
// Creates the conversation if conversationId is omitted. Stores the
// user turn + assistant turn (with parsed design_spec, if any) and
// upserts the three core sections (brief/design/build_sequence) so the
// "Documents & Downloads" PDF and tab UI can read them without
// re-parsing the chat transcript.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { conversationId?: string; message?: string } | null
    const message = body?.message?.trim()
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

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
    const { data: priorMessages } = await admin
      .from('build_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40)

    const claudeMessages: ClaudeMessage[] = [
      ...((priorMessages ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))),
      { role: 'user', content: message },
    ]

    // Record the user's turn immediately (even if the AI call later fails,
    // we don't want to lose the coins-charged prompt from the transcript).
    await admin.from('build_messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: message,
    })

    let rawReply: string
    try {
      rawReply = await callClaude(MAIN_SYSTEM_PROMPT, claudeMessages, 4096)
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
    const conversationalReply = stripDesignSpecFence(rawReply) ||
      (designSpec ? 'Design updated — see the viewer above.' : "Design could not be rendered — try rephrasing.")

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

    // Keep conversation title fresh on first generate + bump updated_at.
    await admin.from('build_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({
      conversationId,
      messageId: savedMessage?.id ?? null,
      reply: conversationalReply,
      designSpec,
      renderError: !designSpec,
      newBalance: spend.newBalance,
      cost: GENERATE_COST,
    })
  } catch (err) {
    console.error('[POST /api/build/generate] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
