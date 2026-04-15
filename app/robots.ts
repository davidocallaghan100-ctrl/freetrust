import { MetadataRoute } from 'next'

// Canonical site URL — same fallback pattern as app/sitemap.ts and
// app/layout.tsx. NEXT_PUBLIC_BASE_URL from the Vercel environment,
// falling back to freetrust.co. Previously hardcoded to the
// freetrust.vercel.app preview subdomain.
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

// FreeTrust policy: AI crawlers are ALLOWED.
//
// The previous version of this file explicitly blocked GPTBot with
// `{ userAgent: 'GPTBot', disallow: ['/'] }`. That was wrong — we
// want FreeTrust content indexed by every AI search surface
// (ChatGPT / Perplexity / Claude / Google SGE) because those are
// rapidly becoming the dominant discovery layer for platforms like
// ours. Explicitly allowing each AI bot here (in addition to the
// default `*` rule) makes the intent unmistakable and is the
// recommended pattern for every named AI crawler.
//
// Disallowed paths (below each userAgent) are the ones that should
// never be indexed regardless of which crawler is asking:
// authenticated surfaces, api routes, admin, and the Stripe seller
// onboarding flow.
const DISALLOW_PRIVATE = [
  '/dashboard',
  '/wallet',
  '/messages',
  '/admin',
  '/api/',
  '/settings',
  '/seller',
  '/orders',
  '/onboarding',
]

const ALLOW_PUBLIC = [
  '/',
  '/services',
  '/products',
  '/jobs',
  '/events',
  '/browse',
  '/articles',
  '/community',
  '/communities',
  '/members',
  '/about',
  '/impact',
  '/marketplace',
  '/feed',
  '/llms.txt',
]

// Every named AI / search crawler we want to explicitly greenlight.
// The default `*` rule below already permits them, but naming them
// individually is the canonical pattern and survives future policy
// changes by third-party bots that check for their own user-agent
// string before the wildcard.
const AI_CRAWLERS = [
  'GPTBot',            // OpenAI / ChatGPT
  'ChatGPT-User',      // OpenAI browser
  'OAI-SearchBot',     // OpenAI search
  'PerplexityBot',     // Perplexity
  'ClaudeBot',         // Anthropic / Claude
  'anthropic-ai',      // Anthropic legacy UA
  'Claude-Web',        // Anthropic web fetch
  'Google-Extended',   // Google Bard / Gemini training
  'CCBot',             // Common Crawl (used by many LLM training sets)
  'Bytespider',        // ByteDance AI
  'Applebot-Extended', // Apple Intelligence
  'Amazonbot',         // Amazon Alexa / AI
  'Meta-ExternalAgent',// Meta AI
  'FacebookBot',       // Meta
]

const SEARCH_CRAWLERS = [
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'DuckDuckBot',
  'Slurp',             // Yahoo
  'YandexBot',
  'Baiduspider',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule for every unlisted user-agent.
      {
        userAgent: '*',
        allow:     ALLOW_PUBLIC,
        disallow:  DISALLOW_PRIVATE,
      },
      // Explicit allow entries for every AI crawler we want to index
      // us — even though they'd be covered by `*`, naming them makes
      // the intent unambiguous to both the bot operators and future
      // developers reading this file.
      ...AI_CRAWLERS.map(userAgent => ({
        userAgent,
        allow:    ['/'],
        disallow: DISALLOW_PRIVATE,
      })),
      ...SEARCH_CRAWLERS.map(userAgent => ({
        userAgent,
        allow:    ['/'],
        disallow: DISALLOW_PRIVATE,
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host:    BASE,
  }
}
