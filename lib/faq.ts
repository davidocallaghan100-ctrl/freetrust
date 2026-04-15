// ────────────────────────────────────────────────────────────────────────────
// FAQ — shared source of truth
// ────────────────────────────────────────────────────────────────────────────
// Single constant consumed by:
//   * components/marketing/FAQAccordion.tsx (the UI)
//   * app/page.tsx (the FAQPage JSON-LD schema used by Google SGE,
//     Perplexity, ChatGPT and other AI search extractors)
//
// Keeping them in sync is critical — a JSON-LD answer that differs
// from the visible UI is a structured-data violation and can get
// the rich result suppressed. Hence the shared file.
//
// Answers are written in plain language so AI crawlers can extract
// them as atomic definitions. Avoid markdown inside answers — many
// schema extractors strip or mis-render it.

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'What is FreeTrust?',
    answer:
      'FreeTrust is a community economy marketplace built in Ireland where members buy, sell, hire, and collaborate with each other. Every contribution earns TrustCoins (₮) — a reputation currency that unlocks lower fees, better visibility, and access to community features. Think of it as a trust layer on top of a full marketplace, jobs board, events platform, and social feed.',
  },
  {
    question: 'Is FreeTrust free to join?',
    answer:
      'Yes. Signing up is completely free and every new member receives ₮200 TrustCoins on account creation. There is no subscription, no listing fee, and no monthly charge. You only pay platform fees on real money transactions, and even those are reduced as your Trust score grows.',
  },
  {
    question: 'What are TrustCoins (₮)?',
    answer:
      'TrustCoins (₮) are FreeTrust\'s reputation currency. They are earned by contributing — signing up, creating listings, completing orders, leaving reviews, donating to the Sustainability Fund, and more. They are spent to boost listings, unlock badges, feature your profile, offset fees, and donate to community impact projects. Unlike money, TrustCoins reward non-monetary contributions like good reviews, community engagement, and event hosting.',
  },
  {
    question: 'How do I earn TrustCoins?',
    answer:
      'You earn TrustCoins automatically as you use the platform. The main rewards are: signing up (₮200), completing your profile (₮50), creating a service or product listing (₮50), posting a job (₮30), creating an event (₮50), publishing an article (₮75), creating a community (₮100), completing an order (₮100), and receiving a review (₮25). Donating to the Sustainability Fund earns a small thank-you bonus too.',
  },
  {
    question: 'Can I withdraw real money from FreeTrust?',
    answer:
      'Yes. When you sell a product or service, the real money earnings land in your FreeTrust wallet. You can withdraw to your bank account via Stripe Connect — FreeTrust creates an Express account for you during onboarding, and once your identity is verified you can trigger withdrawals directly from the Wallet page. Payouts typically arrive in 1 to 2 business days. TrustCoins (₮) are reputation, not cash, and cannot be withdrawn.',
  },
  {
    question: 'How does the marketplace work?',
    answer:
      'FreeTrust has two marketplaces: services (digital and in-person work like design, plumbing, tutoring) and products (physical and digital goods). Sellers create listings with photos, descriptions, and pricing. Buyers pay securely through Stripe with funds held in escrow until delivery is confirmed. FreeTrust takes a small platform fee — 5% to 8% depending on category — and the rest goes straight to the seller.',
  },
  {
    question: 'Is FreeTrust only for Irish users?',
    answer:
      'FreeTrust is built in Ireland and optimised for the Irish community, but it is open to members worldwide. The marketplace supports international shipping, remote services, and multiple currencies. Withdrawals via Stripe Connect are supported across Ireland, the EU, the UK, and most countries where Stripe Connect Express is available.',
  },
  {
    question: 'How is FreeTrust different from other marketplaces?',
    answer:
      'Three things: (1) Trust is a first-class currency — every contribution is rewarded with ₮ that lowers your fees and raises your visibility, so active members get compounding benefits. (2) FreeTrust combines a marketplace, jobs board, events platform, communities, social feed, and nonprofit directory in one place — you do not need five separate accounts. (3) 1% of every transaction funds community impact projects through the Sustainability Fund, and members vote on which projects get the money.',
  },
  {
    question: 'What is the Sustainability Fund?',
    answer:
      'The Sustainability Fund is a community-governed pool of TrustCoins that gets allocated to real-world impact projects — reforestation, clean energy, ocean plastic cleanup, education, and more. It grows two ways: automatically, with 1% of every FreeTrust transaction contributing to the pool, and voluntarily, when members donate TrustCoins via the Impact page. Every quarter the community votes on which projects receive the funds.',
  },
  {
    question: 'How do I create an organisation on FreeTrust?',
    answer:
      'Go to the Organisations tab and click "Create Organisation". You can set up a profile for a business, nonprofit, community group, or social enterprise. Organisations have their own page, feed, member list, and can post jobs, events, and listings under the organisation\'s name. Members can follow your organisation, join as staff or volunteers, and donate via the Sustainability Fund.',
  },
  {
    question: 'Is my data safe on FreeTrust?',
    answer:
      'Yes. FreeTrust uses Supabase with row-level security on every table, meaning no member can ever see another member\'s private data by default. Payments are processed by Stripe — FreeTrust never sees or stores card numbers. Authentication uses industry-standard email/password with optional OAuth. We follow GDPR best practices and you can request a full export or deletion of your account from Settings at any time.',
  },
  {
    question: 'How do I get support?',
    answer:
      'Every page on FreeTrust has a Help link in the footer. For account or payment issues, email support@freetrust.co — we aim to reply within one business day. You can also ask questions in the community feed or in any community you have joined. For urgent issues (suspected account compromise, payment failure), include the word "urgent" in your email subject.',
  },
] as const
