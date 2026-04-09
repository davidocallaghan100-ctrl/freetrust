import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const SLACK_BOT_TOKEN   = process.env.SLACK_BOT_TOKEN   // DavidsAIOS bot
const OS_COMMANDS_CHANNEL = 'C0AQP8K79T9'

// ─── FreeTrust knowledge base ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Trust Assistant, the friendly AI helper for FreeTrust — a trust-based social commerce platform where reputation is the currency.

PERSONALITY:
- Warm, encouraging, and plain-spoken — never robotic or corporate
- Use the user's first name when you know it
- Celebrate milestones enthusiastically (use emojis naturally)
- Always solution-focused — if you can't fully solve something, give the next best step
- Keep responses concise — 2-4 sentences unless a detailed explanation is needed

PLATFORM KNOWLEDGE:

Trust Economy:
- Trust (₮) is earned by: completing orders ₮5-20, getting 5-star reviews ₮10, completing profile ₮10, posting articles ₮5, joining communities ₮2, inviting friends ₮15, first listing ₮25
- Trust can be spent on: boosting listings, premium features, donating to impact projects
- Trust milestones: ₮100 = Trusted Member, ₮500 = Verified Pro, ₮1000 = FreeTrust Elite
- Trust score affects search ranking and buyer confidence

Payments & Escrow:
- All payments go through Stripe (Apple Pay, Google Pay, card all supported)
- Escrow holds payment until buyer confirms delivery
- Platform fee: 5% on products, 8% on services
- Payouts released within 2-3 business days after confirmation
- Currency: EUR default, also supports GBP and USD

Listings & Services:
- Anyone can list services or products
- Listings need title, description, price, and category
- Products can be digital (instant download) or physical (shipped)
- Services can be online or in-person

Disputes:
- Raise a dispute from the order page within 14 days
- FreeTrust mediates between buyer and seller
- If unresolved in 7 days, FreeTrust decides based on evidence
- Refunds processed within 5-7 business days

Communities:
- Free communities and paid communities (set your own price)
- Community creators earn from memberships
- Each community has posts, events, and courses

Platform fees:
- Products: 5% FreeTrust fee
- Services: 8% FreeTrust fee  
- Communities: 10% of membership fees
- Listings are free to create

Account & Profile:
- Verify with email, then optionally with ID for higher Trust
- Complete profile earns ₮10 Trust bonus
- Connect social accounts to boost Trust score

Support:
- Free AI support: unlimited questions (that's me!)
- AI writing tools: 1 credit per use (helps write listings, replies, bios)
- Human support: ticket created via "Talk to a human" button
- Email: support@freetrust.co

IMPORTANT RULES:
- Never make up specific prices or numbers not in your knowledge base
- If you don't know something, say so and offer to escalate to a human
- Never discuss competitors by name
- Keep all amounts in EUR unless user specifies otherwise
- If the user seems frustrated, empathise first before problem-solving`

// ─── Conversation logging ────────────────────────────────────────────────────
async function logConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string | null,
  userId: string | null,
  userMessage: string,
  assistantReply: string,
  page: string
): Promise<string> {
  try {
    if (!conversationId) {
      const { data } = await supabase
        .from('assistant_conversations')
        .insert({ user_id: userId, page, message_count: 1, last_message: userMessage })
        .select('id')
        .single()
      conversationId = data?.id ?? crypto.randomUUID()
    }
    await supabase.from('assistant_messages').insert({
      conversation_id: conversationId,
      user_message: userMessage,
      assistant_reply: assistantReply,
      page,
    })
    // Update convo last_message
    await supabase.from('assistant_conversations')
      .update({ last_message: userMessage, updated_at: new Date().toISOString() })
      .eq('id', conversationId)
    return conversationId!
  } catch {
    return conversationId ?? crypto.randomUUID()
  }
}

// ─── Daily summary tracker ────────────────────────────────────────────────────
async function checkDailySummary(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('assistant_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00Z')
    // Post to Slack if milestone hits (every 50 conversations)
    if (count && count % 50 === 0 && SLACK_BOT_TOKEN) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        body: JSON.stringify({
          channel: OS_COMMANDS_CHANNEL,
          text: `🤖 *Trust Assistant Update* — ${count} conversations today so far. Milestone reached! 🎉`,
        }),
      })
    }
  } catch { /* no-op */ }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    const body = await req.json()
    const { message, conversationId, page, history = [], user: userCtx } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    // Build context string
    const contextParts: string[] = []
    if (page) contextParts.push(`Current page: ${page}`)
    if (userCtx?.name) contextParts.push(`User's name: ${userCtx.name.split(' ')[0]}`)
    if (userCtx?.trustBalance !== undefined) contextParts.push(`User's Trust balance: ₮${userCtx.trustBalance}`)
    const contextNote = contextParts.length > 0 ? `\n\n[CONTEXT: ${contextParts.join(' | ')}]` : ''

    // Build messages array for Claude
    const claudeMessages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message + contextNote },
    ]

    let reply = ''

    if (ANTHROPIC_API_KEY) {
      // Use real Claude API
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: claudeMessages,
        }),
      })
      const claudeData = await claudeRes.json()
      reply = claudeData.content?.[0]?.text ?? "I'm having a moment — please try again!"
    } else {
      // Fallback: rule-based responses when no API key configured
      reply = getFallbackReply(message, page, userCtx)
    }

    // Log to Supabase
    const newConversationId = await logConversation(
      supabase,
      conversationId ?? null,
      authUser?.id ?? null,
      message,
      reply,
      page ?? '/'
    )

    // Background daily summary check (non-blocking)
    checkDailySummary(supabase).catch(() => {})

    return NextResponse.json({ reply, conversationId: newConversationId })
  } catch (err) {
    console.error('[Trust Assistant Chat]', err)
    return NextResponse.json({ reply: "Sorry, I'm having trouble right now. Try again in a moment!" })
  }
}

// ─── Fallback replies when no Claude key ────────────────────────────────────
function getFallbackReply(message: string, page: string, user: { name?: string; trustBalance?: number } | null): string {
  const msg = message.toLowerCase()
  const name = user?.name?.split(' ')[0] ?? ''
  const greet = name ? `${name}, ` : ''

  if (msg.includes('trust') && (msg.includes('earn') || msg.includes('how') || msg.includes('more'))) {
    return `Great question, ${greet}here are the fastest ways to earn Trust:\n\n1. **Complete your profile** → ₮10\n2. **Create your first listing** → ₮25\n3. **Complete an order** → ₮5–20\n4. **Get a 5-star review** → ₮10\n5. **Invite a friend** → ₮15 each\n\nWhich would you like to start with?`
  }
  if (msg.includes('escrow') || msg.includes('payment') || msg.includes('pay')) {
    return `FreeTrust uses **escrow protection** on all orders 🛡️\n\nHere's how it works:\n1. You pay → money is held securely by FreeTrust\n2. Seller delivers → you confirm receipt\n3. Payment released to seller\n\nIf anything goes wrong, raise a dispute and we step in. Your money is always protected.`
  }
  if (msg.includes('dispute') || msg.includes('refund') || msg.includes('problem') || msg.includes('issue')) {
    return `I'm sorry to hear you're having an issue! Here's how to raise a dispute:\n\n1. Go to **Orders** → find your order\n2. Click **"Raise Dispute"**\n3. Describe what happened (be specific)\n4. Upload any evidence (screenshots, messages)\n\nFreeTrust will mediate within 7 days. Would you like help writing your dispute description?`
  }
  if (msg.includes('listing') || msg.includes('sell') || msg.includes('create')) {
    return `Creating a listing on FreeTrust is quick! Here's how:\n\n1. Click **"Create"** in the nav\n2. Choose **Service** or **Product**\n3. Add title, description, price, and photos\n4. Publish!\n\nYour first listing earns you **₮25 Trust** 🎉 Want tips on writing a great listing description?`
  }
  if (msg.includes('community')) {
    return `FreeTrust communities are groups built around shared goals or interests. You can:\n\n- **Join free communities** instantly\n- **Join paid communities** for exclusive content and networking\n- **Create your own** and earn from memberships\n\nHead to the **Community** tab to browse all 8 communities. Want help finding the right one for you?`
  }
  if (msg.includes('fee') || msg.includes('cost') || msg.includes('charge')) {
    return `FreeTrust fees are straightforward:\n\n- **Products:** 5% platform fee\n- **Services:** 8% platform fee\n- **Creating listings:** Free ✅\n- **Joining communities:** Free (unless paid tier)\n- **AI writing tools:** 1 credit per use\n\nAll payments go through Stripe — Apple Pay and Google Pay supported 🍎`
  }
  if (page?.startsWith('/wallet')) {
    return `${greet}your Trust wallet shows everything in one place — your balance, transaction history, and pending payouts.\n\nTo earn more Trust quickly: complete your profile, create a listing, or complete your first order. Each earns you ₮10–25!\n\nWhat would you like to know more about?`
  }
  return `Hi ${greet}I'm your Trust Assistant! I can help with:\n\n- **How Trust works** and how to earn more\n- **Payments & escrow** explained simply\n- **Creating listings** and growing your presence\n- **Disputes** and getting issues resolved\n- **Platform navigation** — anything you can't find\n\nWhat can I help you with today?`
}
