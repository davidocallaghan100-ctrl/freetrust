import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SLACK_BOT_TOKEN     = process.env.SLACK_BOT_TOKEN
const OS_COMMANDS_CHANNEL = 'C0AQP8K79T9' // DavidsAIOS #os-commands

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const { conversationId, userId, userName, userEmail, page, summary } = body

    // 1. Create support ticket in Supabase
    const ticketRef = `FT-${Date.now().toString(36).toUpperCase()}`
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        ticket_ref:      ticketRef,
        user_id:         userId ?? null,
        user_name:       userName ?? 'Guest',
        user_email:      userEmail ?? null,
        page:            page ?? '/',
        conversation_id: conversationId ?? null,
        summary:         summary ?? 'User requested human support',
        status:          'open',
      })
      .select('id')
      .single()

    // 2. Notify Slack #os-commands (DavidsAIOS)
    if (SLACK_BOT_TOKEN) {
      const slackBody = {
        channel: OS_COMMANDS_CHANNEL,
        text: `🎫 *New Support Ticket — ${ticketRef}*`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🎫 Support Ticket ${ticketRef}` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*User:*\n${userName ?? 'Guest'}` },
              { type: 'mrkdwn', text: `*Email:*\n${userEmail ?? 'Not provided'}` },
              { type: 'mrkdwn', text: `*Page:*\n\`${page ?? '/'}\`` },
              { type: 'mrkdwn', text: `*Status:*\n🟡 Open` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Conversation Summary:*\n\`\`\`${(summary ?? '').slice(0, 500)}\`\`\`` },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `Ticket ID: ${ticket?.id ?? 'N/A'} · Created via Trust Assistant · freetrust.co${page ?? '/'}` }],
          },
        ],
      }

      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        body: JSON.stringify(slackBody),
      })
    }

    return NextResponse.json({ success: true, ticketRef, ticketId: ticket?.id })
  } catch (err) {
    console.error('[Trust Assistant Escalate]', err)
    return NextResponse.json({ success: false, error: 'Failed to create ticket' }, { status: 500 })
  }
}
