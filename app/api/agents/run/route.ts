export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgent } from '@/lib/agents'
import type { AgentRunResult } from '@/lib/agents'

// Lazy singleton — only created when the env var is present at
// runtime. The route returns 503 if it's missing so the caller
// sees a clear "not configured" error rather than a crash.
let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
    _anthropic = new Anthropic({ apiKey: key })
  }
  return _anthropic
}

// POST /api/agents/run
//
// Body: { agent: AgentName, input: string }
//
// Flow:
//   1. Auth — reject unauthenticated callers
//   2. Validate — agent name exists in the registry
//   3. Credits — check the user's trust balance covers the
//      agent's credit cost, then debit via the spend_trust RPC
//   4. Run — call the Anthropic Messages API with the agent's
//      system prompt and the caller's input as a user message
//   5. Parse — the agent's system prompt instructs the model to
//      respond with JSON only, so we attempt a JSON.parse on the
//      assistant's text content. If it fails, return the raw text
//      as a string under `data`.
//   6. Return — { success, data, creditsCharged, agentName }
//
// Credits are debited BEFORE the model call so a user can't
// burn API budget without paying. If the model call fails after
// debit, credits are automatically refunded via issue_trust RPC.
export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ─────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Validate ─────────────────────────────────────────────────
    const body = await req.json().catch(() => null) as {
      agent?: unknown
      input?: unknown
    } | null

    const agentName = typeof body?.agent === 'string' ? body.agent : ''
    const userInput = typeof body?.input === 'string' ? body.input.trim() : ''

    const config = getAgent(agentName)
    if (!config) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentName}` },
        { status: 400 },
      )
    }
    if (!userInput || userInput.length < 3) {
      return NextResponse.json(
        { error: 'Input must be at least 3 characters' },
        { status: 400 },
      )
    }
    if (userInput.length > 10_000) {
      return NextResponse.json(
        { error: 'Input too long (max 10,000 characters)' },
        { status: 400 },
      )
    }

    // ── 3. Credits ──────────────────────────────────────────────────
    // Debit via the spend_trust() SECURITY DEFINER RPC (defined in
    // 20260414000006_wallet_rls.sql). Uses the admin client because
    // spend_trust is GRANT'd to authenticated but the admin client
    // is the belt-and-braces path that works regardless of RLS state.
    const admin = createAdminClient()
    const { data: newBalance, error: spendErr } = await admin.rpc('spend_trust', {
      p_user_id: user.id,
      p_amount:  config.creditCost,
      p_type:    `agent_${config.name}`,
      p_desc:    `${config.displayName} agent (₮${config.creditCost})`,
    })

    if (spendErr) {
      const msg = spendErr.message ?? ''
      if (msg.includes('insufficient_funds')) {
        return NextResponse.json(
          {
            error: `Not enough ₮ — this agent costs ₮${config.creditCost}`,
            code:  'insufficient_funds',
            required: config.creditCost,
          },
          { status: 402 },
        )
      }
      console.error('[agents/run] spend_trust failed:', spendErr)
      return NextResponse.json(
        { error: spendErr.message || 'Could not debit credits' },
        { status: 500 },
      )
    }

    // Helper: refund credits if the model call fails — not the user's fault
    const refundCredits = async (reason: string) => {
      const { error: refundErr } = await admin.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount:  config.creditCost,
        p_type:    `agent_refund_${config.name}`,
        p_desc:    `Refund: ${config.displayName} agent failed (${reason})`,
      })
      if (refundErr) console.error('[agents/run] refund failed:', refundErr)
    }

    // ── 4. Run the model ────────────────────────────────────────────
    let anthropic: Anthropic
    try {
      anthropic = getAnthropicClient()
    } catch {
      // Refund credits — model not configured, not the user's fault
      await refundCredits('AI not configured')
      return NextResponse.json(
        { error: 'AI agents are not configured on this server (missing ANTHROPIC_API_KEY)' },
        { status: 503 },
      )
    }

    let response: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      response = await anthropic.messages.create({
        model:      config.model,
        max_tokens: config.maxTokens,
        system:     config.systemPrompt,
        messages: [
          { role: 'user', content: userInput },
        ],
      })
    } catch (modelErr) {
      // Refund credits — model call failed, not the user's fault
      console.error('[agents/run] Claude API error:', modelErr)
      await refundCredits('model error')
      return NextResponse.json(
        { error: 'Agent run failed — your credits have been refunded.' },
        { status: 500 },
      )
    }

    // ── 5. Parse response ───────────────────────────────────────────
    // The system prompt instructs the model to respond with JSON
    // only. Extract the text content and attempt to parse it.
    const textBlock = response.content.find(b => b.type === 'text')
    const rawText   = textBlock && 'text' in textBlock ? textBlock.text : ''

    let parsedData: unknown = rawText
    try {
      parsedData = JSON.parse(rawText)
    } catch {
      // Model returned non-JSON (rare, but possible on refusals or
      // edge cases). Return the raw text so the caller can still
      // show it to the user.
    }

    // ── 6. Return ───────────────────────────────────────────────────
    const result: AgentRunResult = {
      success:        true,
      data:           parsedData,
      creditsCharged: config.creditCost,
      agentName:      config.name,
    }

    return NextResponse.json({
      ...result,
      newBalance: typeof newBalance === 'number' ? newBalance : null,
      model:      config.model,
      tokens: {
        input:  response.usage?.input_tokens  ?? null,
        output: response.usage?.output_tokens ?? null,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/agents/run] unexpected:', msg, err)
    return NextResponse.json(
      { error: `Agent run failed: ${msg}` },
      { status: 500 },
    )
  }
}
