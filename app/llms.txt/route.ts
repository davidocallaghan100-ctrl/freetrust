// /llms.txt — plain text feed for AI crawlers (ChatGPT, Perplexity,
// Claude, Google SGE). Follows the emerging llms.txt convention
// (https://llmstxt.org) so LLM-powered search tools can quickly
// ingest a structured summary of what FreeTrust is and what we
// offer, without having to render the full landing page.
//
// Served as text/plain with a 1h edge cache — the content rarely
// changes and we want to be cheap to crawl at scale.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const dynamic = 'force-static'
export const revalidate = 3600

const BODY = `# FreeTrust
> The community economy marketplace where trust is currency

## What is FreeTrust?
FreeTrust is a community economy platform where
members earn TrustCoins (₮) for every contribution they make —
listing services, posting jobs, creating events, publishing
articles, completing orders and leaving reviews.

## Features
- Marketplace for products and services
- Jobs board for local opportunities
- Events discovery and creation
- Communities around shared interests
- Social feed for updates and connections
- Trust economy with TrustCoins (₮)
- Sustainability fund for community impact
- Organisations directory

## Trust Economy
Members earn ₮ for: signing up (₮200), creating listings (₮50),
publishing articles (₮75), completing orders (₮100),
creating communities (₮100), leaving reviews (₮10).
TrustCoins can be spent on: boosting listings, donating to the
sustainability fund, unlocking badges, featuring profiles.

## Who is it for?
Freelancers, small businesses, community organisers,
nonprofits and social enterprises everywhere.

## Website
${BASE_URL}
`

export function GET() {
  return new Response(BODY, {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
