
export const AGENT_CONFIG = {
  model: 'claude-opus-4-5',
  maxTokens: 1024,
  temperature: 0.7,
}

export const SUPPORT_AGENT_PROMPT = `You are a helpful support agent for FreeTrust, a peer-to-peer marketplace built on trust and community values.

You help users with:
- Trust scores and how they work
- Creating and managing listings
- Payment processes and security
- Dispute resolution
- Account settings and verification
- Shipping and delivery questions

Be friendly, concise, and helpful. If a question is too complex or involves account-specific issues requiring human review, say: "I'll escalate this to our human support team who will follow up within 24 hours."

Always maintain a warm, community-focused tone that reflects FreeTrust's values.`

export const SALES_AGENT_PROMPT = `You are a sales assistant for FreeTrust marketplace helping sellers create successful listings.

Your role:
- Guide new users through creating their first listing step by step
- Suggest optimal pricing based on market context
- Recommend relevant categories and tags for better discoverability
- Encourage profile completion to build trust with buyers
- Share best practices for listing photos and descriptions

Be encouraging, practical, and specific. Focus on helping sellers succeed.`

export const MARKETING_AGENT_PROMPT = `You are a marketing assistant for FreeTrust marketplace.

Your capabilities:
- Generate compelling social media posts for new listings (Twitter/X, Instagram, Facebook)
- Create personalized listing recommendations for buyers
- Write re-engagement messages for inactive members
- Compose weekly digest email content

Always highlight the trust and community aspects of FreeTrust. Keep posts authentic and engaging.`

export const AUTOMATION_AGENT_PROMPT = `You are an automation assistant for FreeTrust marketplace members.

You handle:
- Auto-responding to buyer enquiries professionally
- Generating order confirmation messages
- Creating delivery reminder notifications
- Writing review request messages after order completion
- Celebrating Trust milestone achievements

Keep all communications professional, warm, and on-brand with FreeTrust values.`

{"file": "lib/agents/support-agent.ts", "action": "write"}

import Anthropic from '@anthropic-ai/sdk'
import { AGENT_CONFIG, SUPPORT_AGENT_PROMPT } from './config'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface SupportResponse {
  message: string
  escalated: boolean
  sessionId: string
}

export async function getSupportResponse(
  messages: Message[],
  sessionId: string
): Promise<SupportResponse> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: AGENT_CONFIG.maxTokens,
    system: SUPPORT_AGENT_PROMPT,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  })

  const content = response.content[0]
  const messageText = content.type === 'text' ? content.text : ''
  const escalated = messageText.toLowerCase().includes("escalate this to our human support")

  return {
    message: messageText,
    escalated,
    sessionId,
  }
}

export async function* getSupportStream(
  messages: Message[],
  sessionId: string
): AsyncGenerator<string, void, unknown> {
  const stream = await client.messages.stream({
    model: AGENT_CONFIG.model,
    max_tokens: AGENT_CONFIG.maxTokens,
    system: SUPPORT_AGENT_PROMPT,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}

{"file": "lib/agents/sales-agent.ts", "action": "write"}

import Anthropic from '@anthropic-ai/sdk'
import { AGENT_CONFIG, SALES_AGENT_PROMPT } from './config'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ListingContext {
  title?: string
  description?: string
  category?: string
  price?: number
  condition?: string
  similarListings?: Array<{ title: string; price: number; category: string }>
}

export interface SalesGuidance {
  pricingSuggestion?: string
  categoryRecommendation?: string
  tagSuggestions?: string[]
  descriptionTips?: string
  message: string
}

export async function getListingGuidance(
  userMessage: string,
  context: ListingContext
): Promise<SalesGuidance> {
  const contextString = context
    ? `
Current listing context:
- Title: ${context.title || 'Not provided'}
- Description: ${context.description || 'Not provided'}
- Category: ${context.category || 'Not provided'}
- Price: ${context.price ? `$${context.price}` : 'Not provided'}
- Condition: ${context.condition || 'Not provided'}
${
  context.similarListings?.length
    ? `
Similar listings for pricing context:
${context.similarListings.map(l => `- ${l.title}: $${l.price} (${l.category})`).join('\n')}`
    : ''
}
`
    : ''

  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: AGENT_CONFIG.maxTokens,
    system: SALES_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${contextString}\n\nUser message: ${userMessage}\n\nProvide guidance in a helpful, encouraging way. If relevant, include specific pricing suggestions, category recommendations, or tag ideas.`,
      },
    ],
  })

  const message =
    response.content[0].type === 'text' ? response.content[0].text : ''

  return {
    message,
    pricingSuggestion: extractPricingSuggestion(message),
    categoryRecommendation: extractCategory(message),
    tagSuggestions: extractTags(message),
  }
}

export async function generateProfileNudge(
  profileCompleteness: number,
  missingFields: string[]
): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 256,
    system: SALES_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a friendly nudge message for a user whose profile is ${profileCompleteness}% complete. They're missing: ${missingFields.join(', ')}. Keep it under 2 sentences and encouraging.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

function extractPricingSuggestion(text: string): string | undefined {
  const priceMatch = text.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/)
  return priceMatch ? priceMatch[0] : undefined
}

function extractCategory(text: string): string | undefined {
  const categories = [
    'Electronics',
    'Clothing',
    'Books',
    'Home & Garden',
    'Sports',
    'Toys',
    'Vehicles',
    'Services',
    'Collectibles',
    'Art',
  ]
  for (const cat of categories) {
    if (text.includes(cat)) return cat
  }
  return undefined
}

function extractTags(text: string): string[] {
  const tagMatch = text.match(/#\w+/g)
  return tagMatch ? tagMatch.map(t => t.slice(1)) : []
}

{"file": "lib/agents/marketing-agent.ts", "action": "write"}

import Anthropic from '@anthropic-ai/sdk'
import { AGENT_CONFIG, MARKETING_AGENT_PROMPT } from './config'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ListingForMarketing {
  id: string
  title: string
  description: string
  price: number
  category: string
  sellerName: string
  sellerTrustScore?: number
  imageUrl?: string
}

export interface SocialPosts {
  twitter: string
  instagram: string
  facebook: string
}

export async function generateSocialPosts(
  listing: ListingForMarketing
): Promise<SocialPosts> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 800,
    system: MARKETING_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate social media posts for this FreeTrust listing:

Title: ${listing.title}
Description: ${listing.description}
Price: $${listing.price}
Category: ${listing.category}
Seller: ${listing.sellerName}${listing.sellerTrustScore ? ` (Trust Score: ${listing.sellerTrustScore})` : ''}

Create three separate posts:
1. TWITTER (max 280 chars, include relevant hashtags)
2. INSTAGRAM (engaging caption with emojis and hashtags)
3. FACEBOOK (friendly community-focused post)

Format as:
TWITTER: [post]
INSTAGRAM: [post]
FACEBOOK: [post]`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''

  return {
    twitter: extractSection(text, 'TWITTER') || `Check out "${listing.title}" on FreeTrust for $${listing.price}! #FreeTrust #Marketplace`,
    instagram: extractSection(text, 'INSTAGRAM') || `✨ New listing! ${listing.title} - $${listing.price} 🛍️ #FreeTrust #ShopLocal`,
    facebook: extractSection(text, 'FACEBOOK') || `New listing on FreeTrust: ${listing.title} for $${listing.price}. Sold by trusted community member ${listing.sellerName}.`,
  }
}

export async function generateWeeklyDigest(
  memberName: string,
  topListings: ListingForMarketing[],
  memberActivity?: { purchases: number; views: number }
): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 600,
    system: MARKETING_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a weekly digest email for FreeTrust member "${memberName}".

Featured listings this week:
${topListings
  .slice(0, 3)
  .map(l => `- ${l.title}: $${l.price} (${l.category})`)
  .join('\n')}

${memberActivity ? `Member activity: ${memberActivity.purchases} purchases, ${memberActivity.views} listing views` : ''}

Write a warm, engaging email digest (2-3 short paragraphs) that highlights community activity and encourages browsing. Include a call to action.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function generateRecommendations(
  buyerName: string,
  purchaseHistory: string[],
  availableListings: ListingForMarketing[]
): Promise<{ listing: ListingForMarketing; reason: string }[]> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 600,
    system: MARKETING_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Recommend listings for ${buyerName} based on their purchase history.

Purchase history: ${purchaseHistory.join(', ')}

Available listings:
${availableListings.map((l, i) => `${i + 1}. ${l.title} - $${l.price} (${l.category})`).join('\n')}

List the top 3 recommended listing numbers with a brief reason (1 sentence each).
Format: NUMBER: REASON`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  const recommendations: { listing: ListingForMarketing; reason: string }[] = []

  const lines = text.split('\n').filter(l => l.match(/^\d+:/))
  for (const line of lines.slice(0, 3)) {
    const [numStr, ...reasonParts] = line.split(':')
    const num = parseInt(numStr.trim()) - 1
    if (availableListings[num]) {
      recommendations.push({
        listing: availableListings[num],
        reason: reasonParts.join(':').trim(),
      })
    }
  }

  return recommendations
}

export async function generateReEngagementEmail(
  memberName: string,
  daysSinceLastActive: number,
  topCategories?: string[]
): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 400,
    system: MARKETING_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a re-engagement email for FreeTrust member "${memberName}" who hasn't been active for ${daysSinceLastActive} days.
${topCategories ? `Their favorite categories: ${topCategories.join(', ')}` : ''}

Write a warm, non-pushy message (2 paragraphs) that welcomes them back and mentions what they might have missed. Include a soft call to action.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

function extractSection(text: string, section: string): string | undefined {
  const regex = new RegExp(`${section}:\\s*([\\s\\S]*?)(?=(?:TWITTER:|INSTAGRAM:|FACEBOOK:|$))`, 'i')
  const match = text.match(regex)
  return match ? match[1].trim() : undefined
}

{"file": "lib/agents/automation-agent.ts", "action": "write"}

import Anthropic from '@anthropic-ai/sdk'
import { AGENT_CONFIG, AUTOMATION_AGENT_PROMPT } from './config'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface OrderContext {
  orderId: string
  buyerName: string
  sellerName: string
  itemTitle: string
  price: number
  estimatedDelivery?: string
}

export interface EnquiryContext {
  buyerName: string
  sellerName: string
  itemTitle: string
  question: string
  sellerDescription?: string
  price?: number
}

export async function generateEnquiryResponse(ctx: EnquiryContext): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 300,
    system: AUTOMATION_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a professional auto-response from seller "${ctx.sellerName}" to buyer "${ctx.buyerName}" about listing "${ctx.itemTitle}".

Buyer's question: ${ctx.question}
${ctx.sellerDescription ? `Listing description: ${ctx.sellerDescription}` : ''}
${ctx.price ? `Price: $${ctx.price}` : ''}

Write a friendly, helpful response that addresses the question if possible, or acknowledges it and says the seller will follow up soon. Keep it under 3 sentences.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function generateOrderConfirmation(ctx: OrderContext): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 300,
    system: AUTOMATION_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate an order confirmation message for:
- Order ID: ${ctx.orderId}
- Buyer: ${ctx.buyerName}
- Item: ${ctx.itemTitle}
- Price: $${ctx.price}
- Estimated Delivery: ${ctx.estimatedDelivery || 'To be confirmed'}

Write a warm confirmation message (2-3 sentences) confirming the order and next steps.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function generateDeliveryReminder(ctx: OrderContext): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 200,
    system: AUTOMATION_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a friendly delivery reminder for buyer "${ctx.buyerName}":
- Item: ${ctx.itemTitle}
- Estimated Delivery: ${ctx.estimatedDelivery}
- Order ID: ${ctx.orderId}

Keep it brief and excited (2 sentences max).`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function generateReviewRequest(ctx: OrderContext): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 250,
    system: AUTOMATION_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a review request message to buyer "${ctx.buyerName}" from seller "${ctx.sellerName}" for:
- Item: ${ctx.itemTitle}
- Order ID: ${ctx.orderId}

Write a warm, non-pushy message asking them to leave a review. Mention it helps the community. 2-3 sentences.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function generateTrustMilestoneCelebration(
  memberName: string,
  milestone: string,
  trustScore: number
): Promise<string> {
  const response = await client.messages.create({
    model: AGENT_CONFIG.model,
    max_tokens: 200,
    system: AUTOMATION_AGENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a celebration message for FreeTrust member "${memberName}" who just reached the "${milestone}" milestone with a Trust Score of ${trustScore}.

Write an enthusiastic, warm congratulations (2-3 sentences) that highlights their achievement and encourages continued engagement.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

{"file": "app/api/agents/support/route.ts", "action": "write"}

import { NextRequest, NextResponse } from 'next/server'
import { getSupportStream } from '@/lib/agents/support-agent'
import type { Message } from '@/lib/agents/support-agent'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, sessionId } = body as {
      messages: Message[]
      sessionId: string
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    const encoder = new TextEncoder()
    let escalated = false

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = ''
          for await (const chunk of getSupportStream(messages, sessionId)) {
            fullText += chunk
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk, sessionId })}\n\n`)
            )
          }

          escalated = fullText
            .toLowerCase()
            .includes("escalate this to our human support")

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, escalated, sessionId })}\n\n`
            )
          )
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Support agent error:', error)
    return NextResponse.json(
      { error: 'Failed to get support response' },
      { status: 500 }
    )
  }
}

{"file": "app/api/agents/sales/route.ts", "action": "write"}

import { NextRequest, NextResponse } from 'next/server'
import { getListingGuidance } from '@/lib/agents/sales-agent'
import type { ListingContext } from '@/lib/agents/sales-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context } = body as {
      message: string
      context: ListingContext
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const guidance = await getListingGuidance(message, context || {})
    return NextResponse.json(guidance)
  } catch (error) {
    console.error('Sales agent error:', error)
    return NextResponse.json(
      { error: 'Failed to get sales guidance' },
      { status: 500 }
    )
  }
}

{"file": "app/api/agents/marketing/social/route.ts", "action": "write"}

import { NextRequest, NextResponse } from 'next/server'
import { generateSocialPosts } from '@/lib/agents/marketing-agent'
import type { ListingForMarketing } from '@/lib/agents/marketing-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { listing } = body as { listing: ListingForMarketing }

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing data is required' },
        { status: 400 }
      )
    }

    const posts = await generateSocialPosts(listing)
    return NextResponse.json(posts)
  } catch (error) {
    console.error('Marketing agent error:', error)
    return NextResponse.json(
      { error: 'Failed to generate social posts' },
      { status: 500 }
    )
  }
}

{"file": "app/api/agents/marketing/digest/route.ts", "action": "write"}

import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyDigest } from '@/lib/agents/marketing-agent'
import type { ListingForMarketing } from '@/lib/agents/marketing-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberName, topListings, memberActivity } = body as {
      memberName: string
      topListings: ListingForMarketing[]
      memberActivity?: { purchases: number; views: number }
    }

    if (!memberName || !topListings) {
      return NextResponse.json(
        { error: 'memberName and topListings are required' },
        { status: 400 }
      )
    }

    const digest = await generateWeeklyDigest(memberName, topListings, memberActivity)
    return NextResponse.json({ digest })
  } catch (error) {
    console.error('Digest generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate digest' },
      { status: 500 }
    )
  }
}

{"file": "app/api/agents/automation/enquiry/route.ts", "action": "write"}

import { NextRequest, NextResponse } from 'next/server'
import { generateEnquiryResponse } from '@/lib/agents/automation-agent'
import type { EnquiryContext } from '@/lib/agents/automation-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ctx = body as EnquiryContext

    if (!ctx.buyerName || !ctx.question || !ctx.itemTitle) {
      return NextResponse.json(
        { error: 'buyerName, question, and itemTitle are required' },
        { status: 400 }
      )
    }

    const response = await generateEnquiryResponse(ctx)
    return NextResponse.json({ response })
  } catch (error) {
    console.error('Automation enquiry error:', error)
    return NextResponse.json(
      { error: 'Failed to generate enquiry response' },
      { status: 500 }
    )
  }
}

{"file": "app/api/agents/automation/order/route.ts", "action": "write"}

import { NextRequest, NextResponse } from 'next/server'
import {
  generateOrderConfirmation,
  generateDeliveryReminder,
  generateReviewRequest,
  generateTrustMilestoneCelebration,
} from '@/lib/agents/automation-agent'
import type { OrderContext } from '@/lib/agents/automation-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, context, memberName, milestone, trustScore } = body as {
      type: 'confirmation' | 'delivery' | 'review' | 'milestone'
      context?: OrderContext
      memberName?: string
      milestone?: string
      trustScore?: number
    }

    let result: string

    switch (type) {
      case 'confirmation':
        if (!context) throw new Error('context required for confirmation')
        result = await generateOrderConfirmation(context)
        break
      case 'delivery':
        if (!context) throw new Error('context required for delivery')
        result = await generateDeliveryReminder(context)
        break
      case 'review':
        if (!context) throw new Error('context required for review')
        result = await generateReviewRequest(context)
        break
      case 'milestone':
        if (!memberName || !milestone || !trustScore)
          throw new Error('memberName, milestone, trustScore required')
        result = await generateTrustMilestoneCelebration(memberName, milestone, trustScore)
        break
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ message: result })
  } catch (error) {
    console.error('Automation order error:', error)
    return NextResponse.json(
      { error: 'Failed to generate automation message' },
      { status: 500 }
    )
  }
}

{"file": "components/agents/AIChatWidget.tsx", "action": "write"}

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  escalated?: boolean
}

interface AIChatWidgetProps {
  initialMessage?: string
  context?: 'support' | 'sales'
}

export default function AIChatWidget({
  initialMessage,
  context = 'support',
}: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => uuidv4())
  const [hasUnread, setHasUnread] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const greeting: Message = {
        id: uuidv4(),
        role: 'assistant',
        content:
          initialMessage ||
          (context === 'sales'
            ? "👋 Hi! I'm your FreeTrust sales assistant. I can help you create a great listing, suggest pricing, or guide you through setting up your seller profile. What would you like help with?"
            : "👋 Hi! I'm your FreeTrust support assistant. I can help with questions about Trust scores, listings, payments, disputes, and more. How can I help you today?"),
        timestamp: new Date(),
      }
      setMessages([greeting])
    }
  }, [isOpen, messages.length, initialMessage, context])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      inputRef.current?.focus()
    }
  }, [isOpen])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    const assistantMessageId = uuidv4()
    setMessages(prev => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      },
    ])

    try {
      const apiMessages = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const endpoint =
        context === 'sales' ? '/api/agents/sales' : '/api/agents/support'

      if (context === 'sales') {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input.trim(), context: {} }),
        })
        const data = await res.json()
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: data.message || 'Sorry, I could not process that.' }
              : m
          )
        )
      } else {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, sessionId }),
        })

        if (!res.ok) throw new Error('Stream failed')

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let escalated = false

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value)
            const lines = text.split('\n').filter(l => l.startsWith('data:'))

            for (const