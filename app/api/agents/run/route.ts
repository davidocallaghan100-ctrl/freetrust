export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgent } from '@/lib/agents'
import type { AgentRunResult } from '@/lib/agents'

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

    let response: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      response = await anthropic.messages.create({
        model:      config.model,
        max_tokens: config.maxTokens,
        system:     config.systemPrompt,
        messages: [
          { role: 'user', content: effectiveInput },
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
