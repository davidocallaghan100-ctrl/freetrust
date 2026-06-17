import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fallbackParse(query: string) {
  const priceMatch = query.match(/(?:under|below|less than|up to|max(?:imum)?)\s*[€£$]?\s*(\d+(?:\.\d+)?)/i)
  const maxPrice = priceMatch ? Number(priceMatch[1]) : null
  const keywords = query
    .replace(/(?:under|below|less than|up to|max(?:imum)?)\s*[€£$]?\s*\d+(?:\.\d+)?/gi, '')
    .replace(/\b(eur|euro|euros|gbp|pounds?|quid|usd|dollars?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return { keywords: keywords || query, maxPrice, category: null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(fallbackParse(query))
    }

    const message = await client.messages.create({
      model: process.env.CLAUDE_SEARCH_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Extract the core search keywords and any filters from this shopping query.
Return ONLY a JSON object with these fields:
- keywords: string (2-5 word search phrase, no filler words)
- maxPrice: number or null (in EUR if mentioned)
- category: string or null

Query: "${query}"

JSON only, no explanation.`,
        },
      ],
    })

    const textBlock = message.content.find(block => block.type === 'text')
    const text = textBlock && 'text' in textBlock ? textBlock.text : ''

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return NextResponse.json({
        keywords: typeof parsed.keywords === 'string' && parsed.keywords.trim() ? parsed.keywords.trim() : query,
        maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : null,
        category: typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : null,
      })
    } catch {
      return NextResponse.json(fallbackParse(query))
    }
  } catch (err) {
    console.error('[parse-search-intent]', err)
    return NextResponse.json({ error: 'Unable to parse search intent' }, { status: 500 })
  }
}
