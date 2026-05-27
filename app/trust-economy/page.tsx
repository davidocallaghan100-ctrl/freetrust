import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TIERS, getTierForBalance } from '@/lib/trust/tiers'
import { TRUST_REWARDS, DELIVERY_TRUST_REWARDS } from '@/lib/trust/rewards'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Trust Economy — FreeTrust',
  description: 'Explore FreeTrust TrustCoins, the 10-tier trust ladder, and the actions that help members build reputation, visibility, and community recognition.',
}

const AMBER = '#fbbf24'

const tierDescriptions: Record<number, string> = {
  1: 'Your first step into the FreeTrust economy — start showing up and building a visible reputation.',
  2: 'You are participating, earning signals, and becoming easier for other members to trust.',
  3: 'Your contributions are starting to compound through listings, reviews, posts, and community activity.',
  4: 'A dependable member with a stronger footprint across the marketplace and community.',
  5: 'A proven FreeTrust member with enough activity to stand out in discovery and buyer confidence.',
  6: 'A community builder whose activity helps others find trusted people, services, and opportunities.',
  7: 'A high-trust operator with visible consistency across delivery, reviews, and participation.',
  8: 'A recognised impact maker whose trust record signals reliability and community value.',
  9: 'One of the most established members in the FreeTrust ecosystem, with elite trust visibility.',
  10: 'A pillar of the FreeTrust economy — long-term trust, contribution, and reputation at scale.',
}

const earningCards = [
  { icon: '🎁', label: 'Signup bonus', amount: TRUST_REWARDS.SIGNUP_BONUS, note: 'Welcome TrustCoins for joining FreeTrust.' },
  { icon: '✅', label: 'Complete your profile', amount: TRUST_REWARDS.COMPLETE_PROFILE, note: 'Earn when your profile reaches full completeness.' },
  { icon: '🤝', label: 'Refer a member', amount: TRUST_REWARDS.REFER_USER, note: 'Successful referral after a new member signs up.' },
  { icon: '🛍️', label: 'Create a listing', amount: TRUST_REWARDS.CREATE_LISTING, note: 'Fallback marketplace listing reward.' },
  { icon: '🛠️', label: 'Publish a service', amount: TRUST_REWARDS.CREATE_SERVICE, note: 'Create a service gig that other members can book.' },
  { icon: '📦', label: 'List a product', amount: TRUST_REWARDS.CREATE_PRODUCT, note: 'Add a physical or digital product to the marketplace.' },
  { icon: '💼', label: 'Post a job', amount: TRUST_REWARDS.CREATE_JOB, note: 'Create an opportunity for the community.' },
  { icon: '📅', label: 'Create an event', amount: TRUST_REWARDS.CREATE_EVENT, note: 'Host a gathering, workshop, or community moment.' },
  { icon: '📰', label: 'Publish an article', amount: TRUST_REWARDS.PUBLISH_ARTICLE, note: 'Share knowledge that helps the network.' },
  { icon: '🌍', label: 'Create a community', amount: TRUST_REWARDS.CREATE_COMMUNITY, note: 'Start a new space for shared interests or local action.' },
  { icon: '🙋', label: 'Join a community', amount: TRUST_REWARDS.JOIN_COMMUNITY, note: 'Participate in an existing community.' },
  { icon: '🎟️', label: 'RSVP to an event', amount: TRUST_REWARDS.RSVP_EVENT, note: 'Signal participation in FreeTrust events.' },
  { icon: '🏁', label: 'Complete an order', amount: TRUST_REWARDS.COMPLETE_ORDER, note: 'Seller-side reward when an order is completed.' },
  { icon: '⭐', label: 'Leave a review', amount: TRUST_REWARDS.LEAVE_REVIEW, note: 'Help others understand who they can trust.' },
  { icon: '💬', label: 'Receive a review', amount: TRUST_REWARDS.RECEIVE_REVIEW, note: 'Earn when a counterparty reviews your work.' },
  { icon: '🌱', label: 'Donate to impact', amount: TRUST_REWARDS.DONATE_IMPACT, note: 'Per donation to the Sustainability Fund.' },
  { icon: '❤️', label: 'Post liked', amount: TRUST_REWARDS.POST_LIKED, note: 'When your feed post earns community engagement.' },
  { icon: '⚡', label: 'On-time delivery', amount: DELIVERY_TRUST_REWARDS.DELIVERED_ON_TIME, note: 'Seller bonus for arriving on or before the expected date.' },
  { icon: '📦', label: 'Delivery completed', amount: DELIVERY_TRUST_REWARDS.DELIVERED_LATE, note: 'Seller reward for completed delivery even when late.' },
  { icon: '✅', label: 'Buyer confirmed receipt', amount: DELIVERY_TRUST_REWARDS.BUYER_CONFIRMED, note: 'Buyer-side reward for confirming receipt quickly.' },
  { icon: '🌟', label: '5-star review bonus', amount: DELIVERY_TRUST_REWARDS.FIVE_STAR_BONUS, note: 'Bonus for a five-star review signal.' },
  { icon: '⚠️', label: 'Dispute lost', amount: DELIVERY_TRUST_REWARDS.DISPUTE_LOST, note: 'Deduction when a dispute is resolved against the seller.' },
  { icon: '📍', label: 'Live tracking used', amount: DELIVERY_TRUST_REWARDS.TRACKING_USED, note: 'Seller reward for using delivery tracking.' },
]

async function getViewerTrustBalance(): Promise<number | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    return data?.balance ?? 0
  } catch (err) {
    console.error('[trust-economy] failed to load viewer trust balance', err)
    return null
  }
}

function formatTrust(amount: number) {
  const sign = amount < 0 ? '-' : ''
  return `${sign}₮${Math.abs(amount).toLocaleString()}`
}

export default async function TrustEconomyPage() {
  const viewerBalance = await getViewerTrustBalance()
  const balanceForProgress = viewerBalance ?? 0
  const currentTier = getTierForBalance(balanceForProgress)

  return (
    <main style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '4.5rem 1.25rem 2rem' }}>
        {/* Hero */}
        <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(251,191,36,0.26)', background: 'radial-gradient(circle at top left, rgba(251,191,36,0.18), transparent 34%), linear-gradient(135deg,#111827 0%,#0f172a 55%,#1e293b 100%)', borderRadius: 28, padding: 'clamp(2rem, 6vw, 4.5rem)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.1)', color: AMBER, borderRadius: 999, padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            <span>₮</span> The Trust Economy
          </div>
          <h1 style={{ maxWidth: 760, fontSize: 'clamp(2.4rem, 8vw, 5.2rem)', lineHeight: 0.95, letterSpacing: '-0.06em', margin: 0, fontWeight: 950 }}>
            Build your trust. Earn your tier.
          </h1>
          <p style={{ maxWidth: 720, color: '#cbd5e1', fontSize: 'clamp(1rem, 2.2vw, 1.25rem)', lineHeight: 1.7, margin: '1.35rem 0 0' }}>
            FreeTrust turns positive marketplace and community activity into TrustCoins. As your balance grows, you progress through a 10-tier ladder that signals reputation, reliability, and contribution.
          </p>
          {viewerBalance !== null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '1.5rem', border: `1px solid ${currentTier.color}66`, background: `${currentTier.color}18`, color: '#f8fafc', borderRadius: 999, padding: '0.65rem 1rem', fontWeight: 850, boxShadow: `0 0 0 4px ${currentTier.color}10` }}>
              <span style={{ fontSize: '1.2rem' }}>{currentTier.icon}</span>
              You are: <span style={{ color: currentTier.color }}>{currentTier.label}</span> · ₮{viewerBalance.toLocaleString()}
            </div>
          )}
        </div>

        {/* The Ladder */}
        <section style={{ marginTop: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ color: AMBER, fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.45rem' }}>The Ladder</div>
              <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', lineHeight: 1.05, margin: 0, fontWeight: 900 }}>10 tiers of earned reputation</h2>
            </div>
            <p style={{ maxWidth: 420, color: '#94a3b8', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
              Every tier is powered by the shared FreeTrust tier ladder, so wallet, profile, assistant, and this page stay aligned.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {TIERS.map(tier => {
              const reached = balanceForProgress >= tier.minBalance
              const isCurrent = viewerBalance !== null && currentTier.tier === tier.tier
              const away = Math.max(tier.minBalance - balanceForProgress, 0)
              return (
                <article
                  id={`tier-${tier.tier}`}
                  key={tier.tier}
                  style={{
                    scrollMarginTop: '90px',
                    border: isCurrent ? `2px solid ${AMBER}` : `1px solid ${reached ? `${tier.color}55` : '#334155'}`,
                    background: isCurrent ? 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(30,41,59,0.98))' : '#1e293b',
                    borderRadius: 18,
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: '1rem',
                    alignItems: 'center',
                    boxShadow: isCurrent ? '0 18px 50px rgba(251,191,36,0.12)' : 'none',
                  }}
                >
                  <div style={{ width: 58, height: 58, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tier.color}18`, border: `1px solid ${tier.color}44`, color: tier.color, fontSize: '1.75rem', flexShrink: 0 }}>
                    {tier.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tier {tier.tier}</span>
                      {isCurrent && <span style={{ color: '#0f172a', background: AMBER, borderRadius: 999, padding: '0.18rem 0.55rem', fontSize: '0.68rem', fontWeight: 950 }}>← YOU ARE HERE</span>}
                    </div>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.18rem', fontWeight: 900 }}>{tier.label}</h3>
                    <p style={{ margin: '0.3rem 0 0', color: '#94a3b8', lineHeight: 1.55, fontSize: '0.92rem' }}>{tierDescriptions[tier.tier]}</p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 118 }}>
                    <div style={{ color: tier.color, fontWeight: 950, fontSize: '1rem' }}>₮{tier.minBalance.toLocaleString()}+</div>
                    <div style={{ marginTop: '0.35rem', display: 'inline-flex', borderRadius: 999, padding: '0.24rem 0.62rem', fontSize: '0.74rem', fontWeight: 850, color: reached ? tier.color : '#94a3b8', background: reached ? `${tier.color}14` : 'rgba(148,163,184,0.08)', border: reached ? `1px solid ${tier.color}35` : '1px solid rgba(148,163,184,0.14)' }}>
                      {reached ? '✓ Reached' : `₮${away.toLocaleString()} away`}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* How to Earn TrustCoins */}
        <section style={{ marginTop: '3.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ color: AMBER, fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.45rem' }}>How to Earn TrustCoins</div>
            <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', lineHeight: 1.05, margin: 0, fontWeight: 900 }}>Trust is earned through action</h2>
            <p style={{ maxWidth: 720, color: '#94a3b8', lineHeight: 1.65, margin: '0.85rem 0 0' }}>
              These values come from FreeTrust's central reward constants and delivery-quality reward constants. The award helper records them after the main user action succeeds, without blocking the core flow.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.9rem' }}>
            {earningCards.map(card => {
              const isDeduction = card.amount < 0
              return (
                <article key={card.label} style={{ background: '#1e293b', border: `1px solid ${isDeduction ? 'rgba(248,113,113,0.28)' : 'rgba(51,65,85,0.9)'}`, borderRadius: 16, padding: '1rem', minHeight: 164 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginBottom: '0.75rem' }}>
                    <span style={{ width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDeduction ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)', fontSize: '1.35rem' }}>{card.icon}</span>
                    <span style={{ color: isDeduction ? '#f87171' : AMBER, fontWeight: 950, fontSize: '1rem' }}>{formatTrust(card.amount)}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 850 }}>{card.label}</h3>
                  <p style={{ margin: '0.45rem 0 0', color: '#94a3b8', lineHeight: 1.5, fontSize: '0.86rem' }}>{card.note}</p>
                </article>
              )
            })}
          </div>
        </section>

        {/* Why Tiers Matter */}
        <section style={{ marginTop: '3.5rem' }}>
          <div style={{ color: AMBER, fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.45rem' }}>Why Tiers Matter</div>
          <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', lineHeight: 1.05, margin: 0, fontWeight: 900 }}>Reputation you can see</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
            {[
              { icon: '🛡️', title: 'Social trust signals', body: 'Tiers make trust legible at a glance. Members can quickly understand your activity and reliability before they message, book, or buy.' },
              { icon: '🔎', title: 'Visibility in discovery', body: 'Higher trust tiers help members stand out in discovery. The stronger your trust record, the easier it is for the community to find you.' },
              { icon: '🏆', title: 'Community recognition', body: 'Tiers celebrate contribution, not just transactions. They recognise people who build the marketplace and strengthen the network.' },
            ].map(card => (
              <article key={card.title} style={{ background: 'linear-gradient(180deg,#1e293b,#172033)', border: '1px solid #334155', borderRadius: 18, padding: '1.2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{card.icon}</div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>{card.title}</h3>
                <p style={{ margin: '0.55rem 0 0', color: '#94a3b8', lineHeight: 1.55, fontSize: '0.9rem' }}>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: '3.5rem', border: '1px solid rgba(251,191,36,0.24)', borderRadius: 24, padding: 'clamp(1.5rem, 5vw, 2.5rem)', background: 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(30,41,59,0.92))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 950 }}>Ready to climb?</h2>
            <p style={{ margin: '0.45rem 0 0', color: '#cbd5e1', lineHeight: 1.55 }}>Create, contribute, deliver well, and let your FreeTrust reputation compound.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/create" style={{ background: `linear-gradient(135deg,${AMBER},#f59e0b)`, color: '#0f172a', borderRadius: 12, padding: '0.8rem 1.05rem', fontSize: '0.92rem', fontWeight: 950, textDecoration: 'none' }}>Start earning →</Link>
            <Link href="/wallet" style={{ background: 'rgba(15,23,42,0.55)', color: '#f8fafc', border: '1px solid rgba(251,191,36,0.32)', borderRadius: 12, padding: '0.8rem 1.05rem', fontSize: '0.92rem', fontWeight: 850, textDecoration: 'none' }}>View my wallet</Link>
          </div>
        </section>
      </section>
    </main>
  )
}
