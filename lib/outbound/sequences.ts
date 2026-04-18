// ── FreeTrust Outbound Email Sequences ────────────────────────────────────────
// 3-email cold sequence per ICP targeting Irish service providers.
// Variables: {first_name}, {business_name}
//
// STYLE GUIDE:
//   Email 1 — Short, punchy, problem-first. Plain-text feel. Personal.
//   Email 2 — Warmer, conversational. ₮ token system + zero fees. Simple bullets.
//   Email 3 — Brief, direct CTA. Founding member urgency. One link.
//
// ANGLE: Platform is early-stage. First-mover advantage. No social proof.

export interface OutboundEmail {
  subject: string
  body_html: string
  body_text: string
  delay_days: number
}

export interface IcpSequence {
  icp_category: string
  emails: [OutboundEmail, OutboundEmail, OutboundEmail]
}

const BASE_URL = 'https://freetrust.co'

// ── HTML helpers ──────────────────────────────────────────────────────────────
function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr><td style="padding-bottom:20px;text-align:center;">
          <a href="${BASE_URL}" style="text-decoration:none;">
            <span style="font-size:20px;font-weight:800;color:#38bdf8;">Free</span><span style="font-size:20px;font-weight:800;color:#f1f5f9;">Trust</span>
          </a>
        </td></tr>
        <tr><td style="background:#1e293b;border:1px solid rgba(56,189,248,0.15);border-radius:16px;padding:28px 32px;">
          ${body}
        </td></tr>
        <tr><td style="padding-top:20px;text-align:center;font-size:12px;color:#475569;">
          FreeTrust · Ireland's Trust-Based Marketplace<br/>
          <a href="${BASE_URL}/unsubscribe" style="color:#475569;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const h1 = (t: string) => `<h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#f1f5f9;">${t}</h2>`
const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;color:#94a3b8;line-height:1.7;">${t}</p>`
const strong = (t: string) => `<strong style="color:#f1f5f9;">${t}</strong>`
const btn = (t: string, url: string) => `<div style="margin:22px 0;"><a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#38bdf8,#0284c7);color:#0f172a;font-weight:700;font-size:15px;padding:13px 30px;border-radius:8px;text-decoration:none;">${t}</a></div>`
const divider = () => `<hr style="border:none;border-top:1px solid rgba(56,189,248,0.1);margin:18px 0;"/>`
const bullet = (items: string[]) => `<ul style="margin:0 0 16px;padding-left:20px;color:#94a3b8;font-size:15px;line-height:1.9;">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
const tokenBadge = (t: string) => `<div style="display:inline-block;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.25);border-radius:8px;padding:8px 16px;margin:10px 0;font-size:15px;font-weight:700;color:#38bdf8;">${t}</div>`
const urgencyBox = (t: string) => `<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:10px;padding:14px 18px;margin:16px 0;font-size:14px;color:#fbbf24;line-height:1.6;">${t}</div>`

// ── ICP config ─────────────────────────────────────────────────────────────────
interface IcpConfig {
  name: string
  slug: string
  role: string           // "tradesperson", "designer", etc
  role_plural: string    // "tradespeople", "designers", etc
  service_noun: string   // "services", "work", "coaching", etc
  problem1: string       // core pain (short, 1 line)
  problem2: string       // secondary pain
  subject1: string
  subject2: string
  subject3: string
}

const ICP_CONFIGS: IcpConfig[] = [
  {
    name: 'Founders & Startups', slug: 'founders-startups',
    role: 'founder', role_plural: 'founders',
    service_noun: 'services',
    problem1: 'platforms that take 20–30% on every deal',
    problem2: 'no loyalty — you build the reputation, they keep the margin',
    subject1: 'Quick question for Irish founders',
    subject2: 'Why Irish founders are claiming their spot on FreeTrust',
    subject3: 'Founding member spots — closing this week',
  },
  {
    name: 'Designers & Creatives', slug: 'designers-creatives',
    role: 'designer', role_plural: 'designers',
    service_noun: 'work',
    problem1: 'getting undercut by lower-quality work on generic platforms',
    problem2: 'clients who pick on price, not quality — because they can\'t tell the difference',
    subject1: 'Are you tired of Fiverr undercutting your rates?',
    subject2: 'How FreeTrust rewards Irish designers differently',
    subject3: 'One last thing — founding member spots closing',
  },
  {
    name: 'Developers & Tech', slug: 'developers-tech',
    role: 'developer', role_plural: 'developers',
    service_noun: 'projects',
    problem1: 'losing 20–30% of every project to platform fees',
    problem2: 'clients who ghost after scoping — no trust, no commitment',
    subject1: 'You\'re giving away too much of every project',
    subject2: 'Zero fees, ₮ rewards — a better deal for Irish devs',
    subject3: 'Founding member window closing — last call',
  },
  {
    name: 'Marketers & Growth', slug: 'marketers-growth',
    role: 'marketer', role_plural: 'marketers',
    service_noun: 'services',
    problem1: 'competing on price when your results speak for themselves',
    problem2: 'no platform that lets you build a verified track record',
    subject1: 'Your results deserve more than a race to the bottom',
    subject2: 'How FreeTrust lets Irish marketers build real credibility',
    subject3: 'Founding member spots — closing this week',
  },
  {
    name: 'Writers & Content', slug: 'writers-content',
    role: 'writer', role_plural: 'writers',
    service_noun: 'content',
    problem1: 'content mills paying insultingly low rates',
    problem2: 'clients treating your craft like a commodity',
    subject1: 'Are you still writing for €5 an article?',
    subject2: 'FreeTrust values Irish writers — here\'s how',
    subject3: 'Founding member — last few spots',
  },
  {
    name: 'Video & Animation', slug: 'video-animation',
    role: 'video creator', role_plural: 'video creators',
    service_noun: 'work',
    problem1: 'chasing clients with no reliable pipeline',
    problem2: 'platforms where you\'re invisible until you have reviews — catch-22',
    subject1: 'Breaking the Irish video creator catch-22',
    subject2: 'Get your first FreeTrust clients — ₮ rewards on every job',
    subject3: 'Founding member spots — closing soon',
  },
  {
    name: 'Music & Audio', slug: 'music-audio',
    role: 'musician', role_plural: 'musicians',
    service_noun: 'services',
    problem1: 'streaming royalties that don\'t pay the bills',
    problem2: 'no reliable way to find clients for sessions, gigs, and production',
    subject1: 'A better income stream for Irish musicians',
    subject2: 'Earn ₮ tokens on every gig — how FreeTrust works',
    subject3: 'Founding member window closing — don\'t miss it',
  },
  {
    name: 'Business & Consulting', slug: 'business-consulting',
    role: 'consultant', role_plural: 'consultants',
    service_noun: 'consulting',
    problem1: 'being invisible to SMEs that don\'t know where to find good consultants',
    problem2: 'no neutral platform where your expertise is verifiable',
    subject1: 'Are Irish SMEs finding you — or your competitors?',
    subject2: 'FreeTrust gives consultants a verified reputation layer',
    subject3: 'Founding member status — limited spots remaining',
  },
  {
    name: 'Finance & Accounting', slug: 'finance-accounting',
    role: 'accountant', role_plural: 'accountants',
    service_noun: 'services',
    problem1: 'new clients who don\'t know who to trust with their money',
    problem2: 'referral-only growth that caps how big you can scale',
    subject1: 'New clients don\'t know who to trust — here\'s how to fix that',
    subject2: 'Build verified trust with Irish clients on FreeTrust',
    subject3: 'Founding member window — closing this week',
  },
  {
    name: 'Legal & Compliance', slug: 'legal-compliance',
    role: 'legal professional', role_plural: 'legal professionals',
    service_noun: 'services',
    problem1: 'SMEs searching Google and picking whoever ranks first',
    problem2: 'no marketplace built for trust-sensitive services like legal',
    subject1: 'Irish businesses need legal help — are you findable?',
    subject2: 'A trust-verified directory for Irish legal professionals',
    subject3: 'Founding member — last few spots this week',
  },
  {
    name: 'Coaches & Mentors', slug: 'coaches-mentors',
    role: 'coach', role_plural: 'coaches',
    service_noun: 'coaching',
    problem1: 'spending more time finding clients than actually coaching',
    problem2: 'a crowded market where everyone claims the same results',
    subject1: 'You\'re a coach, not a marketer — let\'s fix that',
    subject2: 'How FreeTrust rewards Irish coaches for real results',
    subject3: 'Founding member spots — this week only',
  },
  {
    name: 'Educators & Tutors', slug: 'educators-tutors',
    role: 'tutor', role_plural: 'tutors',
    service_noun: 'sessions',
    problem1: 'parents not knowing which tutor is actually good',
    problem2: 'competing on price with no way to show quality',
    subject1: 'Parents can\'t tell a good tutor from a bad one — here\'s the fix',
    subject2: 'How FreeTrust helps Irish tutors stand out',
    subject3: 'Founding member window — closing soon',
  },
  {
    name: 'AI & Automation', slug: 'ai-automation',
    role: 'AI specialist', role_plural: 'AI specialists',
    service_noun: 'services',
    problem1: 'clients who don\'t know who to trust in an overhyped AI market',
    problem2: 'no platform built for trust-first tech services',
    subject1: 'Too many AI "experts" — how do clients find the real ones?',
    subject2: 'Build verified credibility as an Irish AI specialist',
    subject3: 'Founding member spots — closing this week',
  },
  {
    name: 'Data & Analytics', slug: 'data-analytics',
    role: 'data analyst', role_plural: 'data analysts',
    service_noun: 'services',
    problem1: 'being invisible to the businesses that need data help most',
    problem2: 'no marketplace built for specialist technical services',
    subject1: 'Irish businesses need data help — are they finding you?',
    subject2: 'Get found + earn ₮ rewards on every FreeTrust project',
    subject3: 'Founding member — limited spots left',
  },
  {
    name: 'Photographers', slug: 'photographers',
    role: 'photographer', role_plural: 'photographers',
    service_noun: 'photography',
    problem1: 'clients price-shopping with no way to value quality',
    problem2: 'Instagram as your only pipeline — algorithm changes wreck bookings',
    subject1: 'Is Instagram really your best client pipeline?',
    subject2: 'How FreeTrust gives Irish photographers a better foundation',
    subject3: 'Founding member spots — closing this week',
  },
  {
    name: 'Trades & Construction', slug: 'trades-construction',
    role: 'tradesperson', role_plural: 'tradespeople',
    service_noun: 'services',
    problem1: 'cowboys undercutting you on price with no accountability',
    problem2: 'no platform that verifies who actually does quality work',
    subject1: 'Sick of competing with dodgy operators on price?',
    subject2: 'How FreeTrust rewards Irish tradespeople who do the job right',
    subject3: 'Founding member — last few spots this week',
  },
  {
    name: 'Home & Garden', slug: 'home-garden',
    role: 'home services provider', role_plural: 'home service providers',
    service_noun: 'services',
    problem1: 'spending hours on platforms that take a cut of every booking',
    problem2: 'clients who leave no reviews even after great work',
    subject1: 'How much of your last job did you actually keep?',
    subject2: 'FreeTrust: zero fees, ₮ rewards, real Irish clients',
    subject3: 'Founding member spots — closing this week',
  },
  {
    name: 'Health & Wellness', slug: 'health-wellness',
    role: 'health professional', role_plural: 'health professionals',
    service_noun: 'services',
    problem1: 'competing with influencers on Instagram who have zero credentials',
    problem2: 'clients who can\'t tell certified professionals from weekend course graduates',
    subject1: 'The Instagram problem for Irish health professionals',
    subject2: 'Build a verified reputation Irish clients can trust',
    subject3: 'Founding member spots — this week only',
  },
  {
    name: 'Beauty & Personal Care', slug: 'beauty-personal-care',
    role: 'beauty professional', role_plural: 'beauty professionals',
    service_noun: 'services',
    problem1: 'relying on Instagram DMs and word of mouth alone',
    problem2: 'no-shows and last-minute cancellations from clients you don\'t know',
    subject1: 'Is your diary still full of Instagram-sourced clients?',
    subject2: 'FreeTrust: verified bookings + ₮ rewards for Irish beauty pros',
    subject3: 'Founding member window — closing soon',
  },
  {
    name: 'Food & Catering', slug: 'food-catering',
    role: 'food business owner', role_plural: 'food business owners',
    service_noun: 'services',
    problem1: 'platforms that take 30%+ on every order',
    problem2: 'no way to build a loyal local customer base online',
    subject1: 'How much are delivery platforms taking from your margins?',
    subject2: 'List your food business for free — earn ₮ on every order',
    subject3: 'Founding member spots — last chance this week',
  },
  {
    name: 'Events & Entertainment', slug: 'events-entertainment',
    role: 'event professional', role_plural: 'event professionals',
    service_noun: 'services',
    problem1: 'chasing bookings one by one with no reliable pipeline',
    problem2: 'clients who don\'t know how to compare event providers fairly',
    subject1: 'Still chasing every booking manually?',
    subject2: 'Build a verified events profile on FreeTrust — earn ₮ per gig',
    subject3: 'Founding member — closing this week',
  },
  {
    name: 'Transport & Delivery', slug: 'transport-delivery',
    role: 'transport provider', role_plural: 'transport providers',
    service_noun: 'services',
    problem1: 'gig platforms that take 30%+ and treat you like a number',
    problem2: 'no way to build client loyalty across jobs',
    subject1: 'Still giving 30% to the platform on every run?',
    subject2: 'Keep what you earn — zero fees + ₮ loyalty rewards',
    subject3: 'Founding member spots — closing this week',
  },
  {
    name: 'Childcare & Education', slug: 'childcare-education',
    role: 'childcare provider', role_plural: 'childcare providers',
    service_noun: 'services',
    problem1: 'parents not knowing who to trust for childcare',
    problem2: 'no verified marketplace built for trust-sensitive services',
    subject1: 'Parents need trusted childcare — are you findable?',
    subject2: 'Build a verified childcare profile Irish families can trust',
    subject3: 'Founding member spots — this week only',
  },
  {
    name: 'Pet Services', slug: 'pet-services',
    role: 'pet services provider', role_plural: 'pet service providers',
    service_noun: 'services',
    problem1: 'pet owners not knowing which provider to trust with their animals',
    problem2: 'no platform built specifically for trust in pet care',
    subject1: 'Pet owners need to trust you — here\'s how to show it',
    subject2: 'Get verified + earn ₮ rewards on every FreeTrust booking',
    subject3: 'Founding member spots — closing soon',
  },
  {
    name: 'Elder Care', slug: 'elder-care',
    role: 'carer', role_plural: 'carers',
    service_noun: 'care services',
    problem1: 'families not knowing who to trust for vulnerable loved ones',
    problem2: 'no marketplace built around trust for sensitive services',
    subject1: 'Families need to trust who\'s caring for their loved ones',
    subject2: 'Build a verified care profile — earn ₮ on every engagement',
    subject3: 'Founding member window — closing this week',
  },
  {
    name: 'Energy Services', slug: 'energy-services',
    role: 'energy services provider', role_plural: 'energy service providers',
    service_noun: 'services',
    problem1: 'homeowners not trusting unknown contractors for expensive upgrades',
    problem2: 'competing with bigger firms who dominate Google results',
    subject1: 'Homeowners don\'t trust unknown energy contractors — here\'s the fix',
    subject2: 'Build verified credentials + earn ₮ on every installation',
    subject3: 'Founding member spots — last call this week',
  },
]

// ── Build sequence ─────────────────────────────────────────────────────────────
function buildSequence(cfg: IcpConfig): IcpSequence {
  const signupUrl = `${BASE_URL}/register?utm_source=outbound&utm_medium=email&utm_campaign=${cfg.slug}`

  // ── Email 1: Short, punchy, problem-first. Plain-text feel. ─────────────────
  const email1: OutboundEmail = {
    subject: cfg.subject1,
    delay_days: 0,
    body_html: wrap(`
      ${p(`Hi {first_name},`)}
      ${p(`Quick one — I run FreeTrust, a new Irish marketplace for ${cfg.role_plural}.`)}
      ${p(`I wanted to reach out because ${cfg.problem1} is something we built this to fix.`)}
      ${p(`${cfg.problem2} — and there's no platform in Ireland that properly rewards the people who do great work.`)}
      ${divider()}
      ${p(`${strong('FreeTrust is free to join and takes zero fees.')} You'd be one of the first ${cfg.role_plural} on the platform — before your competitors are even aware it exists.`)}
      ${p(`Worth 2 minutes of your time: <a href="${signupUrl}" style="color:#38bdf8;">${BASE_URL}</a>`)}
      ${p(`— David, FreeTrust`)}
    `),
    body_text: `Hi {first_name},

Quick one — I run FreeTrust, a new Irish marketplace for ${cfg.role_plural}.

I wanted to reach out because ${cfg.problem1} is something we built this to fix.

${cfg.problem2} — and there's no platform in Ireland that properly rewards the people who do great work.

FreeTrust is free to join and takes zero fees. You'd be one of the first ${cfg.role_plural} on the platform — before your competitors are even aware it exists.

Worth 2 minutes: ${signupUrl}

— David, FreeTrust`,
  }

  // ── Email 2: Warmer, conversational. ₮ system + zero fees. ──────────────────
  const email2: OutboundEmail = {
    subject: cfg.subject2,
    delay_days: 3,
    body_html: wrap(`
      ${h1(`How FreeTrust works for ${cfg.role_plural}`)}
      ${p(`Hey {first_name}, following up from a few days ago.`)}
      ${p(`I wanted to give you a clearer picture of what you'd actually get by joining FreeTrust as a founding member.`)}
      ${divider()}
      ${p(`${strong('Here\'s the deal:')}`)}
      ${bullet([
        `${strong('Zero platform fees')} — we don't take a cut of your ${cfg.service_noun}. Ever.`,
        `${strong('₮200 Trust bonus')} on signup, deposited straight to your wallet`,
        `${strong('₮25 per listing')} — every service you add earns tokens`,
        `${strong('Verified reviews')} — every completed job builds your reputation score`,
        `${strong('Irish buyers')} — people actively searching for ${cfg.service_noun} in Ireland`,
      ])}
      ${tokenBadge('₮ Trust tokens = your reputation on the platform')}
      ${p(`The higher your Trust score, the higher you appear in search. Providers who join early build that score first — which means more visibility when the buyer volume picks up.`)}
      ${p(`You'd be one of the first ${cfg.role_plural} on FreeTrust. That's a real advantage.`)}
      ${btn('Claim My ₮200 Founding Bonus →', signupUrl)}
    `),
    body_text: `Hey {first_name}, following up from a few days ago.

Here's what you'd actually get as a FreeTrust founding member:

✓ Zero platform fees — we don't take a cut of your ${cfg.service_noun}
✓ ₮200 Trust bonus on signup
✓ ₮25 per listing you add
✓ Verified reviews on every completed job
✓ Irish buyers searching for ${cfg.service_noun}

₮ Trust tokens build your reputation score. Providers who join early rank higher when buyer volume picks up.

You'd be one of the first ${cfg.role_plural} on FreeTrust. Real first-mover advantage.

Claim your ₮200 founding bonus: ${signupUrl}

— David`,
  }

  // ── Email 3: Brief, direct CTA. Urgency. One link. ──────────────────────────
  const email3: OutboundEmail = {
    subject: cfg.subject3,
    delay_days: 7,
    body_html: wrap(`
      ${p(`Hi {first_name},`)}
      ${p(`Last one from me, I promise.`)}
      ${urgencyBox(`⏰ We're limiting the number of founding members per category. Once the ${cfg.role} spots fill up, the ₮200 bonus drops and the founding badge closes.`)}
      ${p(`If you want in before your competitors — ${strong(`now is the time.`)}`)}
      ${p(`Join free: <a href="${signupUrl}" style="color:#38bdf8;font-weight:700;">${BASE_URL}</a>`)}
      ${p(`No fees. No card. 2 minutes.`)}
      ${p(`— David, FreeTrust`)}
    `),
    body_text: `Hi {first_name},

Last one from me, I promise.

We're limiting founding member spots per category. Once the ${cfg.role} spots fill, the ₮200 bonus drops and the founding badge closes.

If you want in before your competitors — now is the time.

Join free: ${signupUrl}

No fees. No card. 2 minutes.

— David, FreeTrust`,
  }

  return { icp_category: cfg.name, emails: [email1, email2, email3] }
}

// ── Exports ────────────────────────────────────────────────────────────────────
export const ALL_SEQUENCES: Record<string, IcpSequence> = Object.fromEntries(
  ICP_CONFIGS.map(cfg => [cfg.name, buildSequence(cfg)])
)

export function getSequenceForIcp(icpCategory: string): IcpSequence | null {
  return ALL_SEQUENCES[icpCategory] ?? null
}

export function getNextEmail(
  sequence: IcpSequence,
  sequenceStep: number,
  enrolledAt: Date,
): { email: OutboundEmail; stepIndex: number } | null {
  const now = new Date()
  const nextStepIndex = sequenceStep // 0=email1 due, 1=email2 due, 2=email3 due
  if (nextStepIndex >= sequence.emails.length) return null

  const email = sequence.emails[nextStepIndex]
  const sendAt = new Date(enrolledAt.getTime() + email.delay_days * 24 * 60 * 60 * 1000)
  if (now >= sendAt) return { email, stepIndex: nextStepIndex }
  return null
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

export const ICP_CATEGORIES = ICP_CONFIGS.map(c => c.name)
export const ICP_SLUGS = ICP_CONFIGS.map(c => ({ slug: c.slug, name: c.name }))
