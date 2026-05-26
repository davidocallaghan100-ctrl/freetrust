import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TIERS, getTierForBalance } from '@/lib/trust/tiers'
import { TRUST_REWARDS, DELIVERY_TRUST_REWARDS } from '@/lib/trust/rewards'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Trust Economy — FreeTrust',
  description: 'Build your trust. Earn your tier. How TrustCoins (₮) and tier progression work on FreeTrust.',
}

const GOLD = '#fbbf24'
const GOLD_SOFT = 'rgba(251,191,36,0.12)'
const GREEN = '#10b981'
const GREEN_SOFT = 'rgba(16,185,129,0.12)'

interface EarnRow {
  icon: string
  label: string
  amount: number
  note?: string
}

const EARN_ROWS: EarnRow[] = [
  // Signup + profile
  { icon: '🎁', label: 'Welcome signup bonus',                      amount: TRUST_REWARDS.SIGNUP_BONUS,     note: 'One-off — automatically granted on signup' },
  { icon: '✅', label: 'Complete your profile',                     amount: TRUST_REWARDS.COMPLETE_PROFILE, note: 'When your profile hits 100%' },
  { icon: '👥', label: 'Refer a new member',                        amount: TRUST_REWARDS.REFER_USER,       note: 'Per successful referral' },
  // Creation
  { icon: '🛠️', label: 'List a service',                            amount: TRUST_REWARDS.CREATE_SERVICE },
  { icon: '📦', label: 'List a product',                            amount: TRUST_REWARDS.CREATE_PRODUCT },
  { icon: '💼', label: 'Post a job',                                amount: TRUST_REWARDS.CREATE_JOB },
  { icon: '📅', label: 'Create an event',                           amount: TRUST_REWARDS.CREATE_EVENT },
  { icon: '📰', label: 'Publish an article',                        amount: TRUST_REWARDS.PUBLISH_ARTICLE },
  // Community
  { icon: '🏘️', label: 'Create a community',                        amount: TRUST_REWARDS.CREATE_COMMUNITY },
  { icon: '🤝', label: 'Join a community',                          amount: TRUST_REWARDS.JOIN_COMMUNITY },
  { icon: '🎟️', label: 'RSVP to an event',                          amount: TRUST_REWARDS.RSVP_EVENT },
  // Transactions
  { icon: '💼', label: 'Complete an order (seller)',                amount: TRUST_REWARDS.COMPLETE_ORDER },
  { icon: '⭐', label: 'Leave a review',                            amount: TRUST_REWARDS.LEAVE_REVIEW },
  { icon: '🌟', label: 'Receive a review from your counterparty',   amount: TRUST_REWARDS.RECEIVE_REVIEW },
  // Engagement
  { icon: '💚', label: 'Donate to the Sustainability Fund',         amount: TRUST_REWARDS.DONATE_IMPACT, note: 'Per donation' },
  { icon: '❤️', label: 'Your feed post gets a like',                amount: TRUST_REWARDS.POST_LIKED },
  // Delivery-weighted
  { icon: '⚡', label: 'On-time delivery (seller)',                 amount: DELIVERY_TRUST_REWARDS.DELIVERED_ON_TIME, note: 'Arrives on or before the expected date' },
  { icon: '📦', label: 'Delivered late (seller)',                   amount: DELIVERY_TRUST_REWARDS.DELIVERED_LATE,    note: 'Still rewarded for completion' },
  { icon: '✅', label: 'Buyer confirms receipt',                    amount: DELIVERY_TRUST_REWARDS.BUYER_CONFIRMED },
  { icon: '⭐', label: '5-star review bonus',                       amount: DELIVERY_TRUST_REWARDS.FIVE_STAR_BONUS,   note: 'On top of the review reward' },
  { icon: '📍', label: 'Use live delivery tracking (seller)',       amount: DELIVERY_TRUST_REWARDS.TRACKING_USED },
]

async function getCurrentBalance(): Promise<number | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()
    return (data?.balance as number | undefined) ?? 0
  } catch {
    return null
  }
}

export default async function TrustEconomyPage() {
  const balance = await getCurrentBalance()
  const isLoggedIn = balance !== null
  const { current: currentTier } = balance !== null
    ? getTierForBalance(balance)
    : { current: TIERS[0] }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '2rem 1.25rem 4rem', color: '#cbd5e1' }}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.04))',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 20,
        marginBottom: '2rem',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: GOLD, textTransform: 'uppercase', marginBottom: 12 }}>
          The Trust Economy
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1, margin: '0 0 1rem' }}>
          Build your trust.<br />Earn your tier.
        </h1>
        <p style={{ maxWidth: 620, margin: '0 auto', fontSize: '1rem', lineHeight: 1.6, color: '#94a3b8' }}>
          FreeTrust runs on TrustCoins (₮) — earned by being a real, contributing member of the community.
          Every action you take builds your reputation. Reputation unlocks tiers. Tiers earn recognition.
        </p>
        {isLoggedIn && (
          <div style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, background: currentTier.bg, border: `1px solid ${currentTier.color}40` }}>
            <span style={{ fontSize: 18 }}>{currentTier.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: currentTier.color }}>
              You are: {currentTier.name} · ₮{balance!.toLocaleString()}
            </span>
          </div>
        )}
      </section>

      {/* ── The Ladder ───────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.35rem' }}>The Ladder</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Ten tiers, from your first ₮0 to Founding Pillar status.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TIERS.map(tier => {
            const reached = balance !== null && balance >= tier.threshold
            const isHere  = isLoggedIn && tier.rank === currentTier.rank
            return (
              <div
                key={tier.rank}
                id={`tier-${tier.rank}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: isHere ? tier.bg : '#1e293b',
                  border: isHere ? `2px solid ${tier.color}` : '1px solid #334155',
                  boxShadow: isHere ? `0 0 0 4px ${tier.color}1a` : 'none',
                  scrollMarginTop: 100,
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: tier.bg,
                  border: `1px solid ${tier.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  flexShrink: 0,
                }}>
                  {tier.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>TIER {tier.rank}</span>
                    {isHere && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: tier.color, background: `${tier.color}22`, padding: '2px 8px', borderRadius: 999 }}>
                        ← YOU ARE HERE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: reached || isHere ? '#f1f5f9' : '#cbd5e1', marginBottom: 2 }}>
                    {tier.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{tier.description}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: tier.color }}>₮{tier.threshold.toLocaleString()}</div>
                  {reached ? (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#34d399' }}>✓ Reached</div>
                  ) : balance !== null ? (
                    <div style={{ fontSize: 10, color: '#475569' }}>₮{(tier.threshold - balance).toLocaleString()} away</div>
                  ) : (
                    <div style={{ fontSize: 10, color: '#475569' }}>threshold</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── How to Earn ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.35rem' }}>How to Earn TrustCoins</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Every action below adds ₮ to your balance. Negative amounts are penalties.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {EARN_ROWS.map((row, i) => {
            const positive = row.amount >= 0
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{row.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>{row.label}</div>
                  {row.note && <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>{row.note}</div>}
                </div>
                <div style={{
                  flexShrink: 0,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: positive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  color:      positive ? '#34d399' : '#f87171',
                  whiteSpace: 'nowrap',
                }}>
                  {positive ? '+' : ''}₮{Math.abs(row.amount)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Verification Badge ───────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{
          padding: '1.5rem',
          background: `linear-gradient(135deg, ${GREEN_SOFT}, rgba(16,185,129,0.04))`,
          border: `1px solid ${GREEN}33`,
          borderRadius: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: GREEN_SOFT,
              border: `1px solid ${GREEN}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              flexShrink: 0,
            }}>
              ✓
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: GREEN, textTransform: 'uppercase', marginBottom: 6 }}>
                Separate from tier progression
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.5rem' }}>
                The Verified Badge
              </h2>
              <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: '#cbd5e1', margin: '0 0 1rem' }}>
                The green <strong style={{ color: GREEN }}>Verified</strong> badge confirms your real-world identity via Stripe Identity —
                a one-time ID check that&apos;s separate from tier progression. Verifying proves you&apos;re a real person to other members,
                and we never see or store your ID document. Tier badges (in gold) show your contribution over time;
                the Verified badge (in green) shows you&apos;re who you say you are.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: GREEN_SOFT, border: `1px solid ${GREEN}40`, borderRadius: 999 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>+₮100 one-off bonus</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>credited automatically when verification succeeds</div>
              </div>
              <Link
                href="/settings?tab=verification"
                style={{
                  display: 'inline-block',
                  background: GREEN,
                  color: '#06281f',
                  fontSize: 14,
                  fontWeight: 800,
                  padding: '10px 18px',
                  borderRadius: 10,
                  textDecoration: 'none',
                }}
              >
                Verify my identity →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Tiers Matter ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.35rem' }}>Why Tiers Matter</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Reputation is a real currency — here&apos;s what it unlocks.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { icon: '🔍', title: 'Discovery boost',       body: 'Higher-tier members appear earlier in search results and member lists.' },
            { icon: '💬', title: 'Buyer confidence',      body: 'A visible tier badge signals reliability — buyers transact faster with proven sellers.' },
            { icon: '🎨', title: 'Profile flair',         body: 'Unlock cosmetic tier icons and frame accents that travel with you across the platform.' },
            { icon: '🏛️', title: 'Community recognition', body: 'Reach the top tiers and become part of the founding generation of FreeTrust.' },
          ].map(card => (
            <div key={card.title} style={{
              padding: '16px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 14,
            }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>{card.title}</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>{card.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{
        padding: '2rem 1.5rem',
        textAlign: 'center',
        background: `linear-gradient(135deg, ${GOLD_SOFT}, rgba(245,158,11,0.04))`,
        border: `1px solid ${GOLD}33`,
        borderRadius: 20,
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', margin: '0 0 0.5rem' }}>
          Ready to climb?
        </h2>
        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', maxWidth: 520, margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
          The fastest way to earn is to do what you came here to do — list, post, transact, contribute.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/create" style={{
            background: GOLD,
            color: '#1e293b',
            fontSize: 14,
            fontWeight: 800,
            padding: '12px 20px',
            borderRadius: 10,
            textDecoration: 'none',
          }}>
            Start earning →
          </Link>
          <Link href="/wallet" style={{
            background: 'transparent',
            color: GOLD,
            border: `1px solid ${GOLD}66`,
            fontSize: 14,
            fontWeight: 700,
            padding: '12px 20px',
            borderRadius: 10,
            textDecoration: 'none',
          }}>
            View my wallet
          </Link>
        </div>
      </section>
    </div>
  )
}
