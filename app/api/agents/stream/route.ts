export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgent } from '@/lib/agents'

type AgentAttachment = {
  name?: unknown
  type?: unknown
  size?: unknown
  kind?: unknown
  content?: unknown
  dataUrl?: unknown
}

const MAX_ATTACHMENTS = 5
const MAX_TEXT_ATTACHMENT_CHARS = 20_000
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const CHAT_FORMATTING_RULE = `

FreeTrust chat formatting rule: for any user-facing prose, do not use Markdown formatting. Do not include asterisk characters or hyphen/dash bullet markers. Write in clean plain text paragraphs with numbered labels only when structure is needed.`

function normaliseAttachments(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_ATTACHMENTS).map((item): AgentAttachment => item && typeof item === 'object' ? item as AgentAttachment : {})
}

function attachmentLabel(att: AgentAttachment, index: number) {
  const name = typeof att.name === 'string' && att.name.trim() ? att.name.trim().slice(0, 120) : `attachment-${index + 1}`
  const type = typeof att.type === 'string' ? att.type : 'unknown'
  const size = typeof att.size === 'number' && Number.isFinite(att.size) ? `, ${Math.round(att.size / 1024)} KB` : ''
  return `${name} (${type}${size})`
}

function parseImageDataUrl(att: AgentAttachment) {
  const type = typeof att.type === 'string' ? att.type : ''
  const dataUrl = typeof att.dataUrl === 'string' ? att.dataUrl : ''
  if (!SUPPORTED_IMAGE_TYPES.has(type)) return null
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null
  return { media_type: match[1], data: match[2] }
}

function buildUserContent(userInput: string, attachments: AgentAttachment[]): string | unknown[] {
  if (attachments.length === 0) return userInput

  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `${userInput || 'Use the attached files and photos as context for this FreeTrust agent run.'}\n\nAttached context:`,
    },
  ]

  attachments.forEach((att, index) => {
    const kind = typeof att.kind === 'string' ? att.kind : ''
    const label = attachmentLabel(att, index)
    if (kind === 'text' && typeof att.content === 'string' && att.content.trim()) {
      content.push({
        type: 'text',
        text: `\n\n--- Attached file: ${label} ---\n${att.content.slice(0, MAX_TEXT_ATTACHMENT_CHARS)}`,
      })
      return
    }

    if (kind === 'image') {
      const image = parseImageDataUrl(att)
      if (image) {
        content.push({ type: 'text', text: `\n\n--- Attached photo: ${label} ---` })
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.media_type,
            data: image.data,
          },
        })
        return
      }
      content.push({ type: 'text', text: `\n\n--- Attached photo skipped: ${label} (unsupported image type for AI vision) ---` })
    }
  })

  return content
}

// POST /api/agents/stream
//
// Same auth + credit flow as /api/agents/run, but streams the model
// response as Server-Sent Events (SSE) rather than a single JSON blob.
//
// Use this for agents with `streaming: true` in their config (e.g.
// Bulk Listing Generator) where a large output could exceed Vercel's
// 60-second timeout on a regular response.
//
// SSE event format:
//   data: {"type":"delta","text":"..."}   — incremental text chunk
//   data: {"type":"done","creditsCharged":15,"newBalance":235}
//   data: {"type":"error","error":"..."}
//
// Credits are debited before streaming starts. If the stream fails
// mid-way the user loses those credits (same as the non-streaming
// route). A full model error before the first token triggers a refund.

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
    _anthropic = new Anthropic({ apiKey: key })
  }
  return _anthropic
}

function sse(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return new Response(sse({ type: 'error', error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // ── 2. Validate ──────────────────────────────────────────────────
  const body = await req.json().catch(() => null) as {
    agent?: unknown
    input?: unknown
    attachments?: unknown
  } | null

  const agentName = typeof body?.agent === 'string' ? body.agent : ''
  const userInput = typeof body?.input === 'string' ? body.input.trim() : ''
  const attachments = normaliseAttachments(body?.attachments)

  const config = getAgent(agentName)
  if (!config) {
    return new Response(sse({ type: 'error', error: `Unknown agent: ${agentName}` }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  if (!config.streaming) {
    return new Response(sse({ type: 'error', error: 'This agent does not support streaming. Use /api/agents/run.' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  if ((!userInput || userInput.length < 3) && attachments.length === 0) {
    return new Response(sse({ type: 'error', error: 'Input must be at least 3 characters, or attach a supported file/photo.' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  if (userInput.length > 10_000) {
    return new Response(sse({ type: 'error', error: 'Input too long (max 10,000 characters)' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // ── 3. Credits ───────────────────────────────────────────────────
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
      return new Response(
        sse({ type: 'error', error: `Not enough ₮ — this agent costs ₮${config.creditCost}`, code: 'insufficient_funds' }),
        { status: 402, headers: { 'Content-Type': 'text/event-stream' } },
      )
    }
    return new Response(
      sse({ type: 'error', error: spendErr.message || 'Could not debit credits' }),
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  const refundCredits = async (reason: string) => {
    const { error: refundErr } = await admin.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount:  config.creditCost,
      p_type:    `agent_refund_${config.name}`,
      p_desc:    `Refund: ${config.displayName} agent failed (${reason})`,
    })
    if (refundErr) console.error('[agents/stream] refund failed:', refundErr)
  }

  // ── 4. Stream ────────────────────────────────────────────────────
  let anthropic: Anthropic
  try {
    anthropic = getAnthropicClient()
  } catch {
    await refundCredits('AI not configured')
    return new Response(
      sse({ type: 'error', error: 'AI agents are not configured on this server' }),
      { status: 503, headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const push = (obj: Record<string, unknown>) => {
        controller.enqueue(enc.encode(sse(obj)))
      }

      try {
        const request: any = {
          model:      config.model,
          max_tokens: config.maxTokens,
          system:     `${config.systemPrompt}${CHAT_FORMATTING_RULE}`,
          messages: [{ role: 'user', content: buildUserContent(userInput, attachments) as any }],
        }

        if (config.webSearch) {
          request.tools = [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 5,
            },
          ]
        }

        const anthropicStream = await anthropic.messages.stream(request)

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            push({ type: 'delta', text: event.delta.text })
          }
        }

        push({
          type:           'done',
          creditsCharged: config.creditCost,
          newBalance:     typeof newBalance === 'number' ? newBalance : null,
          agentName:      config.name,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[agents/stream] stream error:', msg)
        await refundCredits('stream error')
        push({ type: 'error', error: 'Agent stream failed — your credits have been refunded.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
