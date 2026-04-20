// ────────────────────────────────────────────────────────────────────────────
// FreeTrust FAQ — single source of truth
// ────────────────────────────────────────────────────────────────────────────
//
// Same data is rendered in three places:
//   1. The <FAQAccordion /> on the landing page (human-readable UI)
//   2. The FAQPage JSON-LD emitted by app/page.tsx (Google / Bing /
//      ChatGPT / Perplexity / Claude / Google SGE use this)
//   3. The /llms.txt route (plain-text AI crawler feed)
//
// Keeping these aligned matters because the JSON-LD is what AI search
// systems actually pull to render answers — any drift between the
// displayed FAQ and the structured data is reported as a "content
// mismatch" in Google Rich Results Test and will suppress the rich
// card entirely.

export interface FAQItem {
  question: string
  answer:   string
}

export const FAQS: readonly FAQItem[] = [
  {
    question: 'What is FreeTrust?',
    answer:
      "FreeTrust is the community economy marketplace — a platform where members earn TrustCoins (₮) for every contribution they make and spend them to grow. You can list services, sell products, post jobs, run events, join communities, publish articles and support sustainability projects, all in one place.",
  },
  {
    question: 'Is FreeTrust free to join?',
    answer:
      "Yes, FreeTrust is completely free to join. New members receive ₮200 in TrustCoins on signup and there is no subscription or monthly fee. We only charge a small fee on completed transactions.",
  },
  {
    question: 'What are TrustCoins (₮)?',
    answer:
      'TrustCoins (₮) are the native reputation currency of FreeTrust. Every contribution to the community — listing a service, completing an order, publishing an article, leaving a review — earns you ₮. Higher ₮ balances unlock lower fees, better visibility and access to platform perks.',
  },
  {
    question: 'How do I earn TrustCoins?',
    answer:
      'You earn ₮ for every meaningful action: ₮200 on signup, ₮50 for creating a listing, ₮75 for publishing an article, ₮100 for completing an order, ₮100 for creating a community, ₮10 for leaving a review, and more. The full earning schedule is in your wallet.',
  },
  {
    question: 'Can I withdraw real money from FreeTrust?',
    answer:
      'Yes — sellers connect a Stripe account via /seller/connect and can withdraw the euro proceeds from any completed sale directly to their bank. TrustCoins themselves are not withdrawable, they are a reputation currency used inside the platform.',
  },
  {
    question: 'How does the marketplace work?',
    answer:
      'List a product, service or gig from /services/new or /products/new, set your price in EUR, GBP or USD, and buyers pay securely via Stripe. Orders are tracked end-to-end with messaging, reviews and disputes built in. You earn TrustCoins at each step and get paid out to your bank.',
  },
  {
    question: 'Is FreeTrust only for certain users?',
    answer:
      "FreeTrust is built for the community economy and is open to members worldwide. We support multiple currencies, international Stripe payouts and have members in the UK, EU and beyond.",
  },
  {
    question: 'How is FreeTrust different from other marketplaces?',
    answer:
      'Unlike fee-extracting platforms, FreeTrust rewards contribution directly. Every action earns TrustCoins, 1% of every transaction goes to the Sustainability Fund for real community impact projects, and reputation (not ads) determines visibility. You are building a shared economy, not paying rent to a marketplace.',
  },
  {
    question: 'What is the Sustainability Fund?',
    answer:
      'The Sustainability Fund is a community-governed pool that receives 1% of every transaction on FreeTrust plus direct ₮ donations. Members vote quarterly on which real-world sustainability projects to fund — reforestation, clean energy, ocean clean-ups, education and more.',
  },
  {
    question: 'How do I create an organisation on FreeTrust?',
    answer:
      'Head to /organisations/new to create an organisation page for your business, charity, community group or social enterprise. You can list it in the directory, post on the feed as the organisation, invite team members and run events and listings under the organisation brand.',
  },
  {
    question: 'Is my data safe on FreeTrust?',
    answer:
      'Yes. FreeTrust uses Supabase with row-level security on every table, authenticated Stripe payments, GDPR-compliant data handling and no ad-tech trackers. Your personal data is never sold, and you can export or delete it at any time from /settings.',
  },
  {
    question: 'How do I get support?',
    answer:
      'Every page has a built-in support path via /help, or you can message the FreeTrust team directly from /messages. For account and payment issues, head to /settings for self-serve options first — most questions are answered in under a minute there.',
  },
] as const
