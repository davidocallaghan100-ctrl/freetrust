// ────────────────────────────────────────────────────────────────────────────
// /llms.txt — AI crawler plain-text summary
// ────────────────────────────────────────────────────────────────────────────
// Emerging convention (see https://llmstxt.org) — a plain-text file at
// /llms.txt that describes the site in a form optimised for LLM
// consumption. Perplexity, ChatGPT, Claude, and other AI crawlers
// preferentially lift content from this file for answers.
//
// The format is simple:
//   * A top-level H1 with the site name
//   * A one-line blockquote with the tagline
//   * Optional H2 sections with plain-text content
//
// Keep it under ~2KB and avoid clever markdown — extractors are
// conservative. Prose + short bulleted lists only.
//
// Built dynamically from FAQ_ITEMS so it stays in sync with the
// visible site. Cached for 6 hours so crawlers don't hammer the
// route.

import { FAQ_ITEMS } from '@/lib/faq'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6 hours

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

function buildBody(): string {
  const lines: string[] = []

  lines.push('# FreeTrust')
  lines.push('')
  lines.push("> Ireland's community economy marketplace where trust is currency.")
  lines.push('')
  lines.push(`Canonical URL: ${BASE_URL}`)
  lines.push('')

  lines.push('## What is FreeTrust?')
  lines.push('')
  lines.push(
    'FreeTrust is a community economy marketplace built in Ireland. Members buy, sell, hire, and collaborate on a single platform that combines a marketplace, jobs board, events platform, communities, social feed, and organisations directory. Every contribution earns TrustCoins (₮) — a reputation currency that lowers fees, boosts visibility, and unlocks community features.'
  )
  lines.push('')

  lines.push('## Who is it for?')
  lines.push('')
  lines.push('- Freelancers and service providers')
  lines.push('- Small businesses and makers selling physical or digital products')
  lines.push('- Community organisers and event hosts')
  lines.push('- Nonprofits and social enterprises')
  lines.push('')

  lines.push('## Features')
  lines.push('')
  lines.push('- Marketplace — physical and digital products with Stripe checkout and 1-2 day bank payouts')
  lines.push('- Services — gig-style listings for freelance and in-person work')
  lines.push('- Jobs board — full-time, part-time, and contract roles')
  lines.push('- Events — ticketed or free, hosted by members or organisations')
  lines.push('- Communities — free or paid groups with their own feed and events')
  lines.push('- Social feed — share updates, articles, and resources')
  lines.push('- Trust economy — reputation currency that rewards contribution')
  lines.push('- Sustainability Fund — 1% of every transaction funds real-world impact projects')
  lines.push('- Organisations directory — profiles for businesses, nonprofits, and community groups')
  lines.push('')

  lines.push('## Trust Economy')
  lines.push('')
  lines.push(
    'TrustCoins (₮) are FreeTrust\'s reputation currency. They are earned automatically for contributions — signing up (₮200), completing your profile (₮50), creating a service listing (₮50), listing a product (₮50), posting a job (₮30), creating an event (₮50), publishing an article (₮75), creating a community (₮100), completing an order (₮100), and receiving a review (₮25). They can be spent to boost listings, offset platform fees, donate to the Sustainability Fund, unlock badges, and feature your profile.'
  )
  lines.push('')

  lines.push('## Sustainability Fund')
  lines.push('')
  lines.push(
    'The Sustainability Fund is a community-governed pool of TrustCoins that gets allocated to real-world impact projects — reforestation, clean energy, ocean plastic cleanup, education, and more. It grows two ways: automatically, with 1% of every FreeTrust transaction contributing to the pool, and voluntarily, when members donate TrustCoins via the Impact page.'
  )
  lines.push('')

  lines.push('## Key pages')
  lines.push('')
  lines.push(`- Home: ${BASE_URL}/`)
  lines.push(`- About: ${BASE_URL}/about`)
  lines.push(`- Services marketplace: ${BASE_URL}/services`)
  lines.push(`- Product marketplace: ${BASE_URL}/products`)
  lines.push(`- Jobs board: ${BASE_URL}/jobs`)
  lines.push(`- Events: ${BASE_URL}/events`)
  lines.push(`- Communities: ${BASE_URL}/community`)
  lines.push(`- Members directory: ${BASE_URL}/members`)
  lines.push(`- Impact / Sustainability Fund: ${BASE_URL}/impact`)
  lines.push(`- Register (free): ${BASE_URL}/register`)
  lines.push('')

  lines.push('## FAQ')
  lines.push('')
  for (const item of FAQ_ITEMS) {
    lines.push(`### ${item.question}`)
    lines.push('')
    lines.push(item.answer)
    lines.push('')
  }

  lines.push('## Contact')
  lines.push('')
  lines.push('Support: support@freetrust.co')
  lines.push('')

  return lines.join('\n')
}

export async function GET() {
  const body = buildBody()
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Allow AI crawlers and browsers to cache for an hour;
      // the file is regenerated by Next's ISR every 6 hours anyway.
      'Cache-Control': 'public, max-age=3600, s-maxage=21600',
    },
  })
}
