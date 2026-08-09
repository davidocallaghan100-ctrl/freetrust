export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spendTrustCoins } from '@/lib/build/spend'
import { callClaude } from '@/lib/build/claude'
import { sectionSystemPrompt } from '@/lib/build/prompts'
import { ON_DEMAND_SECTION_KEYS, ON_DEMAND_SECTION_COST, sectionMeta } from '@/lib/build/spec'

// POST /api/build/sections
// body: { conversationId: string, sectionKey: string }
// Generates (or regenerates) one of the 9 on-demand sections for a
// conversation. Charges ON_DEMAND_SECTION_COST (3 TC) via spend_trust
// BEFORE calling Claude, every time — regenerating re-charges.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { conversationId?: string; sectionKey?: string } | null
    const conversationId = body?.conversationId
    const sectionKey = body?.sectionKey

    if (!conversationId || !sectionKey) {
      return NextResponse.json({ error: 'conversationId and sectionKey are required' }, { status: 400 })
    }
    if (!(ON_DEMAND_SECTION_KEYS as readonly string[]).includes(sectionKey)) {
      return NextResponse.json({ error: `Unknown or non-on-demand section: ${sectionKey}` }, { status: 400 })
    }
    const meta = sectionMeta(sectionKey)!

    const admin = createAdminClient()

    const { data: conversation } = await admin
      .from('build_conversations')
      .select('id, title')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Charge BEFORE calling the AI.
    const spend = await spendTrustCoins(
      user.id, ON_DEMAND_SECTION_COST, `spend_build_section_${sectionKey}`, `Build: ${meta.label} section`
    )
    if (!spend.ok) {
      if (spend.code === 'insufficient_funds') {
        return NextResponse.json(
          { error: 'Insufficient trust balance', code: 'insufficient_funds', balance: spend.balance, required: spend.required },
          { status: 402 }
        )
      }
      return NextResponse.json({ error: spend.message }, { status: 500 })
    }

    // Build context: latest design spec + recent chat + brief/design core sections.
    const [{ data: recentMessages }, { data: coreSections }] = await Promise.all([
      admin.from('build_messages')
        .select('role, content, design_spec, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6),
      admin.from('build_sections')
        .select('section_key, content')
        .eq('conversation_id', conversationId)
        .in('section_key', ['brief', 'design', 'build_sequence']),
    ])

    const latestSpec = recentMessages?.find(m => m.design_spec)?.design_spec ?? null
    const briefText = coreSections?.find(s => s.section_key === 'brief')?.content ?? ''
    const designText = coreSections?.find(s => s.section_key === 'design')?.content ?? ''

    const contextBlock = [
      briefText ? `Brief:\n${briefText}` : null,
      designText ? `Design summary:\n${designText}` : null,
      latestSpec ? `Design spec JSON:\n${JSON.stringify(latestSpec)}` : null,
    ].filter(Boolean).join('\n\n')

    let content: string
    try {
      content = await callClaude(
        sectionSystemPrompt(meta.label, meta.description),
        [{ role: 'user', content: contextBlock || 'No prior design context available — give general conceptual guidance for a small self-build project.' }],
        1400
      )
    } catch (err) {
      console.error('[POST /api/build/sections] Claude call failed', err)
      return NextResponse.json({
        error: 'This section could not be generated right now — your Trust Coins were spent for this attempt. Try again in a moment.',
        newBalance: spend.newBalance,
      }, { status: 502 })
    }

    const { data: saved, error: upsertErr } = await admin
      .from('build_sections')
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        section_key: sectionKey,
        content,
        cost_spent: ON_DEMAND_SECTION_COST,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,section_key' })
      .select('section_key, content, cost_spent, generated_at')
      .single()

    if (upsertErr) {
      console.error('[POST /api/build/sections] upsert failed', upsertErr)
    }

    await admin.from('build_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    return NextResponse.json({
      section: saved ?? { section_key: sectionKey, content, cost_spent: ON_DEMAND_SECTION_COST },
      newBalance: spend.newBalance,
      cost: ON_DEMAND_SECTION_COST,
    })
  } catch (err) {
    console.error('[POST /api/build/sections] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
