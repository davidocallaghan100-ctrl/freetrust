export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgent } from '@/lib/agents'
import type { AgentConfig, AgentRunResult } from '@/lib/agents'

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
const IMAGE_AGENT_COST = 50
const IMAGE_GENERATION_BUCKET = 'feed-media'
const IMAGE_GENERATION_TIMEOUT_MS = 45_000
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

function extractAssistantText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim()
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
}

type ImageSafetyResult = {
  allowed: boolean
  reason: string
  rewrittenPrompt: string
}

function readSafetyResult(text: string, fallbackPrompt: string): ImageSafetyResult {
  const parsed = parseJsonObject(text)
  const allowed = parsed?.allowed === true
  const reason = typeof parsed?.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim().slice(0, 500) : 'Safety review did not clearly approve this request.'
  const rewrittenPrompt = typeof parsed?.rewrittenPrompt === 'string' && parsed.rewrittenPrompt.trim()
    ? parsed.rewrittenPrompt.trim().slice(0, 1600)
    : fallbackPrompt.slice(0, 1600)
  return { allowed, reason, rewrittenPrompt }
}

async function reviewImagePromptSafety(anthropic: Anthropic, prompt: string): Promise<ImageSafetyResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 700,
    temperature: 0,
    system: `You are FreeTrust's strict image-generation safety gate. Return JSON only.

Approve only benign, lawful, non-exploitative, non-sexual, non-violent, non-fraudulent, non-hateful, non-invasive image requests.

Block if the prompt requests, implies, enables, or tries to evade safeguards around: unlawful acts, sexual content or nudity, minors in unsafe contexts, non-consensual or intimate imagery, harassment or threats, hate or extremist symbols/propaganda, realistic gore or graphic violence, weapons instructions, illegal drugs, fraud/scams, fake documents/IDs/payment cards, doxxing/private data, real private-person likenesses, public-figure deepfakes, impersonation, copyrighted characters/logos/trademarks, or any upload/generation that could reasonably be illegal.

If approved, rewrite the prompt into a safe original visual prompt. Remove unsafe details, real-person likenesses, copyrighted/trademarked references, gore, weapons, drugs, and privacy-invasive material. Add "original, lawful, safe-for-work, no logos, no real person likeness" when helpful.

JSON shape: {"allowed": boolean, "reason": string, "rewrittenPrompt": string}`,
    messages: [{ role: 'user', content: `Image request to review:\n\n${prompt}` }],
  })
  return readSafetyResult(extractAssistantText(response), prompt)
}

async function reviewGeneratedImageSafety(anthropic: Anthropic, image: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', base64: string }, originalPrompt: string): Promise<ImageSafetyResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    temperature: 0,
    system: `You are FreeTrust's strict post-generation image safety reviewer. Return JSON only.

Approve only if the image is clearly lawful, safe-for-work, non-exploitative, non-sexual, non-hateful, non-fraudulent, non-invasive, and does not contain realistic gore, abuse, extremist propaganda, illegal-drug promotion, weapons-focused wrongdoing, fake documents, payment cards, private data, or real-person/public-figure impersonation. If uncertain, block.

JSON shape: {"allowed": boolean, "reason": string, "rewrittenPrompt": string}`,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Review this generated image before FreeTrust uploads or shows it. Original approved prompt: ${originalPrompt}` },
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
        ] as any,
      },
    ],
  })
  return readSafetyResult(extractAssistantText(response), originalPrompt)
}

function isGeneratedImageContentType(value: string | null): value is 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' {
  return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp' || value === 'image/gif'
}

async function fetchGeneratedImage(prompt: string): Promise<{ bytes: Buffer, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), IMAGE_GENERATION_TIMEOUT_MS)
  try {
    const safePrompt = `${prompt}\n\nOriginal lawful safe-for-work commercial image. No logos. No text that looks like official documents. No real person likeness. No nudity. No gore. No weapons. No illegal drugs.`
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=1024&height=1024&nologo=true&safe=true&seed=${Date.now()}`
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'image/png,image/jpeg,image/webp' } })
    if (!res.ok) throw new Error(`image provider returned ${res.status}`)
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!isGeneratedImageContentType(contentType)) throw new Error(`image provider returned ${contentType || 'unknown content type'}`)
    const arrayBuffer = await res.arrayBuffer()
    const bytes = Buffer.from(arrayBuffer)
    if (bytes.byteLength < 1024) throw new Error('image provider returned an empty image')
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('image provider returned an image larger than 8 MB')
    return { bytes, mediaType: contentType }
  } finally {
    clearTimeout(timeout)
  }
}

function extensionForMediaType(mediaType: string) {
  if (mediaType === 'image/jpeg') return 'jpg'
  if (mediaType === 'image/webp') return 'webp'
  if (mediaType === 'image/gif') return 'gif'
  return 'png'
}

async function uploadGeneratedImage(admin: ReturnType<typeof createAdminClient>, userId: string, image: { bytes: Buffer, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' }) {
  const ext = extensionForMediaType(image.mediaType)
  const storagePath = `ai-generated/${userId}/${randomUUID()}.${ext}`
  const { error: uploadError } = await admin.storage.from(IMAGE_GENERATION_BUCKET).upload(storagePath, image.bytes, {
    contentType: image.mediaType,
    upsert: false,
  })
  if (uploadError) throw new Error(uploadError.message || 'image upload failed')
  const { data } = admin.storage.from(IMAGE_GENERATION_BUCKET).getPublicUrl(storagePath)
  if (!data.publicUrl) throw new Error('image upload completed but public URL was unavailable')
  return data.publicUrl
}

async function runImageGenerationAgent(params: {
  userId: string
  userInput: string
  config: AgentConfig
}) {
  const { userId, userInput, config } = params
  let anthropic: Anthropic
  try {
    anthropic = getAnthropicClient()
  } catch {
    return NextResponse.json(
      { error: 'AI image safety checks are not configured on this server (missing ANTHROPIC_API_KEY)' },
      { status: 503 },
    )
  }

  let promptSafety: ImageSafetyResult
  try {
    promptSafety = await reviewImagePromptSafety(anthropic, userInput)
  } catch (err) {
    console.error('[agents/run] image prompt safety failed:', err)
    return NextResponse.json(
      { error: 'Image safety review failed. No TrustCoins were charged.' },
      { status: 503 },
    )
  }

  if (!promptSafety.allowed) {
    return NextResponse.json(
      {
        error: `I can’t generate that image because it may be unsafe or unlawful. ${promptSafety.reason}`,
        code: 'safety_blocked',
        safetyReason: promptSafety.reason,
        creditsCharged: 0,
      },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { data: newBalance, error: spendErr } = await admin.rpc('spend_trust', {
    p_user_id: userId,
    p_amount:  IMAGE_AGENT_COST,
    p_type:    `agent_${config.name}`,
    p_desc:    `${config.displayName} agent (₮${IMAGE_AGENT_COST})`,
  })

  if (spendErr) {
    const msg = spendErr.message ?? ''
    if (msg.includes('insufficient_funds')) {
      return NextResponse.json(
        {
          error: `Not enough ₮ — this agent costs ₮${IMAGE_AGENT_COST}`,
          code: 'insufficient_funds',
          required: IMAGE_AGENT_COST,
        },
        { status: 402 },
      )
    }
    console.error('[agents/run] spend_trust image generation failed:', spendErr)
    return NextResponse.json(
      { error: spendErr.message || 'Could not debit TrustCoins' },
      { status: 500 },
    )
  }

  const refundCredits = async (reason: string) => {
    const { error: refundErr } = await admin.rpc('issue_trust', {
      p_user_id: userId,
      p_amount:  IMAGE_AGENT_COST,
      p_type:    `agent_refund_${config.name}`,
      p_desc:    `Refund: ${config.displayName} agent failed (${reason})`,
    })
    if (refundErr) console.error('[agents/run] image refund failed:', refundErr)
  }

  try {
    const generated = await fetchGeneratedImage(promptSafety.rewrittenPrompt)
    const postSafety = await reviewGeneratedImageSafety(anthropic, {
      mediaType: generated.mediaType,
      base64: generated.bytes.toString('base64'),
    }, promptSafety.rewrittenPrompt)

    if (!postSafety.allowed) {
      await refundCredits('generated image failed safety review')
      return NextResponse.json(
        {
          error: `The generated image failed FreeTrust’s safety review and was not uploaded. Your ₮${IMAGE_AGENT_COST} have been refunded.`,
          code: 'generated_image_safety_blocked',
          safetyReason: postSafety.reason,
        },
        { status: 422 },
      )
    }

    const imageUrl = await uploadGeneratedImage(admin, userId, generated)
    const data = {
      type: 'generated_image',
      image_url: imageUrl,
      media_url: imageUrl,
      prompt: userInput,
      revised_prompt: promptSafety.rewrittenPrompt,
      safety_note: 'FreeTrust checked the prompt before generation and checked the generated image before upload.',
      caption: 'Generated image ready. Review it before posting or using publicly.',
    }

    const result: AgentRunResult<typeof data> = {
      success: true,
      data,
      creditsCharged: IMAGE_AGENT_COST,
      agentName: config.name,
    }

    return NextResponse.json({
      ...result,
      newBalance: typeof newBalance === 'number' ? newBalance : null,
      model: 'pollinations-safe-image + claude-safety-review',
      tokens: { input: null, output: null },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[agents/run] image generation failed:', msg)
    await refundCredits('image generation error')
    return NextResponse.json(
      { error: 'Image generation failed — your TrustCoins have been refunded.' },
      { status: 500 },
    )
  }
}

// ── Trust Score Live Signals ─────────────────────────────────────────────────
// Fetches real DB data for the authenticated user and builds a structured
// context block that is prepended to their input when running the
// trustScoreOptimiser agent. All failures are caught and default to
// safe zero/null values so the agent always runs, even if DB calls fail.
interface TrustSignals {
  profileCompleteness: { filled: number; total: number; missing: string[] }
  listingCount: number
  avgRating: number | null
  reviewCount: number
  accountAgeDays: number
  emailVerified: boolean
  socialLinks: string[]
  followerCount: number
  lastSeenDaysAgo: number | null
  trustBalance: number
}

async function fetchTrustSignals(userId: string): Promise<TrustSignals> {
  const admin = createAdminClient()

  // Fetch profile
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, avatar_url, bio, location, website, website_url, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, created_at, last_seen_at, avg_rating, review_count, follower_count, trust_balance')
    .eq('id', userId)
    .maybeSingle()

  // Profile completeness — 9 key fields
  const completenessFields: Array<{ key: string; label: string; value: unknown }> = [
    { key: 'full_name',     label: 'Full name',    value: profile?.full_name },
    { key: 'avatar_url',    label: 'Avatar',       value: profile?.avatar_url },
    { key: 'bio',           label: 'Bio',          value: profile?.bio },
    { key: 'location',      label: 'Location',     value: profile?.location },
    { key: 'website',       label: 'Website',      value: profile?.website_url ?? profile?.website },
    { key: 'linkedin_url',  label: 'LinkedIn',     value: profile?.linkedin_url },
    { key: 'instagram_url', label: 'Instagram',    value: profile?.instagram_url },
    { key: 'twitter_url',   label: 'Twitter/X',    value: profile?.twitter_url },
    { key: 'github_url',    label: 'GitHub',       value: profile?.github_url },
  ]
  const filled   = completenessFields.filter(f => f.value && String(f.value).trim() !== '').length
  const missing  = completenessFields.filter(f => !f.value || String(f.value).trim() === '').map(f => f.label)

  // Social links present
  const socialLinks: string[] = []
  if (profile?.linkedin_url)  socialLinks.push('LinkedIn')
  if (profile?.twitter_url)   socialLinks.push('Twitter/X')
  if (profile?.instagram_url) socialLinks.push('Instagram')
  if (profile?.github_url)    socialLinks.push('GitHub')
  if (profile?.tiktok_url)    socialLinks.push('TikTok')
  if (profile?.youtube_url)   socialLinks.push('YouTube')

  // Published listings count
  const { count: listingCount } = await admin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'published')

  // Account age
  const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date()
  const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  // Last seen
  let lastSeenDaysAgo: number | null = null
  if (profile?.last_seen_at) {
    lastSeenDaysAgo = Math.floor((Date.now() - new Date(profile.last_seen_at).getTime()) / (1000 * 60 * 60 * 24))
  }

  // Email verification — check auth.users via admin (service role has access)
  let emailVerified = false
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    emailVerified = authUser?.user?.email_confirmed_at != null
  } catch {
    // non-blocking
  }

  return {
    profileCompleteness: { filled, total: completenessFields.length, missing },
    listingCount: listingCount ?? 0,
    avgRating: typeof profile?.avg_rating === 'number' ? profile.avg_rating : null,
    reviewCount: profile?.review_count ?? 0,
    accountAgeDays,
    emailVerified,
    socialLinks,
    followerCount: profile?.follower_count ?? 0,
    lastSeenDaysAgo,
    trustBalance: profile?.trust_balance ?? 0,
  }
}

function buildTrustSignalsBlock(signals: TrustSignals): string {
  const { profileCompleteness, listingCount, avgRating, reviewCount, accountAgeDays, emailVerified, socialLinks, followerCount, lastSeenDaysAgo, trustBalance } = signals
  const completenessStr = `${profileCompleteness.filled}/${profileCompleteness.total} fields filled (${Math.round(profileCompleteness.filled / profileCompleteness.total * 100)}%)`
  const missingStr = profileCompleteness.missing.length > 0 ? `Missing: ${profileCompleteness.missing.join(', ')}` : 'All fields filled'
  const ratingStr = avgRating != null ? `${avgRating.toFixed(1)}/5` : 'No reviews yet'
  const socialStr = socialLinks.length > 0 ? socialLinks.join(', ') : 'None connected'
  const lastSeenStr = lastSeenDaysAgo === 0 ? 'Today' : lastSeenDaysAgo === 1 ? 'Yesterday' : lastSeenDaysAgo != null ? `${lastSeenDaysAgo} days ago` : 'Unknown'

  return `## Live Trust Signals (real data from FreeTrust DB)
- Profile completeness: ${completenessStr} — ${missingStr}
- Published listings: ${listingCount}
- Average review score: ${ratingStr} (from ${reviewCount} review${reviewCount !== 1 ? 's' : ''})
- Account age: ${accountAgeDays} day${accountAgeDays !== 1 ? 's' : ''}
- Email verified: ${emailVerified ? 'Yes' : 'No'}
- Social links connected: ${socialStr}
- Followers: ${followerCount}
- Current ₮ balance: ₮${trustBalance.toLocaleString()}
- Last active: ${lastSeenStr}

`
}

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
      attachments?: unknown
    } | null

    const agentName = typeof body?.agent === 'string' ? body.agent : ''
    const userInput = typeof body?.input === 'string' ? body.input.trim() : ''
    const attachments = normaliseAttachments(body?.attachments)

    const config = getAgent(agentName)
    if (!config) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentName}` },
        { status: 400 },
      )
    }
    if ((!userInput || userInput.length < 3) && attachments.length === 0) {
      return NextResponse.json(
        { error: 'Input must be at least 3 characters, or attach a supported file/photo.' },
        { status: 400 },
      )
    }
    if (userInput.length > 10_000) {
      return NextResponse.json(
        { error: 'Input too long (max 10,000 characters)' },
        { status: 400 },
      )
    }

    if (config.name === 'imageGenerator') {
      return runImageGenerationAgent({ userId: user.id, userInput, config })
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

    // For the Trust Score Optimiser, prepend live DB signals to the
    // user's input so the model has ground-truth data to work from.
    let effectiveInput = userInput
    if (config.name === 'trustScoreOptimiser') {
      try {
        const signals = await fetchTrustSignals(user.id)
        effectiveInput = buildTrustSignalsBlock(signals) + userInput
      } catch (sigErr) {
        // Non-fatal — still run the agent with user input only
        console.warn('[agents/run] trust signals fetch failed:', sigErr)
      }
    }

    let response: any
    try {
      const request: any = {
        model:      config.model,
        max_tokens: config.maxTokens,
        system:     `${config.systemPrompt}${CHAT_FORMATTING_RULE}`,
        messages: [
          { role: 'user', content: buildUserContent(effectiveInput, attachments) as any },
        ],
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

      response = await anthropic.messages.create(request)
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
    const rawText = extractAssistantText(response)

    let parsedData: unknown = rawText
    if (config.responseFormat !== 'text') {
      try {
        parsedData = JSON.parse(stripJsonFence(rawText))
      } catch {
        // Model returned non-JSON (rare, but possible on refusals or
        // edge cases). Return the raw text so the caller can still
        // show it to the user.
      }
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
