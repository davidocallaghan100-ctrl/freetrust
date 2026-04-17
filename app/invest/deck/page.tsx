'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const C = {
  bg: '#0f172a',
  bgSoft: '#1e293b',
  card: 'rgba(30,41,59,0.6)',
  border: 'rgba(148,163,184,0.15)',
  borderStrong: 'rgba(56,189,248,0.35)',
  sky: '#38bdf8',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
};

const SLIDES = ['cover','problem','insight','product','model','moat','traction','market','gtm','roadmap','ask'] as const;
type SlideKey = typeof SLIDES[number];
interface Metrics { members: number; listings: number; orders: number; trustInCirculation: number; founderBuyers: number; aiCreditsUsed: number; }

export default function InvestorDeckPage() {
  const [i, setI] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const next = useCallback(() => setI(n => Math.min(n + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setI(n => Math.max(n - 1, 0)), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(SLIDES.length - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  useEffect(() => {
    let c = false;
    fetch('/api/invest/metrics', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!c && d) setMetrics(d); })
      .catch(() => {});
    return () => { c = true; };
  }, []);

  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    const MIN_SWIPE_DISTANCE = 50;
    const MAX_SWIPE_TIME = 600;
    const MAX_VERTICAL_DRIFT = 80;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    }

    function onTouchEnd(e: TouchEvent) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;

      if (dt > MAX_SWIPE_TIME) return;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT) return;
      if (Math.abs(dx) < MIN_SWIPE_DISTANCE) return;

      if (dx < 0) {
        next();
      } else {
        prev();
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [next, prev]);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        .dt { position: sticky; top: 0; z-index: 50; background: rgba(15,23,42,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid ${C.border}; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .db { font-weight: 600; font-size: 15px; color: ${C.text}; display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
        .db .dot { width: 10px; height: 10px; background: ${C.sky}; border-radius: 50%; }
        .da { display: flex; gap: 10px; align-items: center; }
        .btn { background: transparent; border: 1px solid ${C.border}; color: ${C.textMuted}; padding: 8px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; text-decoration: none; }
        .btn:hover { color: ${C.text}; border-color: ${C.borderStrong}; }
        .btn-p { background: ${C.sky}; color: ${C.bg}; border-color: ${C.sky}; font-weight: 600; }
        .btn-p:hover { background: #7dd3fc; color: ${C.bg}; }
        .ct { font-size: 12px; color: ${C.textFaint}; font-family: ui-monospace, monospace; }
        .ss { min-height: calc(100vh - 120px); padding: 48px 20px 80px; display: flex; align-items: center; justify-content: center; animation: slideFade 0.28s ease-out; }
        @keyframes slideFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sl { width: 100%; max-width: 1040px; }
        .pre { font-size: 11px; letter-spacing: 3px; color: ${C.sky}; text-transform: uppercase; font-weight: 500; margin-bottom: 14px; }
        .h { font-size: 44px; font-weight: 600; line-height: 1.1; margin: 0 0 18px; color: ${C.text}; }
        .h .a { color: ${C.sky}; }
        .sub { font-size: 19px; color: ${C.textMuted}; line-height: 1.55; margin: 0 0 28px; max-width: 720px; }
        .body { font-size: 16px; color: ${C.text}; line-height: 1.7; }
        .g2 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 12px; }
        .g3 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 12px; }
        .g4 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
        .tile { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 20px; }
        .tile h3 { font-size: 17px; font-weight: 600; margin: 0 0 8px; color: ${C.text}; }
        .tile p { font-size: 14px; color: ${C.textMuted}; line-height: 1.6; margin: 0; }
        .stat { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 18px 16px; text-align: center; }
        .sl1 { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.textMuted}; margin-bottom: 8px; }
        .sv { font-size: 30px; font-weight: 600; color: ${C.text}; line-height: 1; }
        .sh { font-size: 11px; color: ${C.textFaint}; margin-top: 6px; }
        .bu { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; }
        .bd { color: ${C.sky}; font-size: 18px; line-height: 1.4; flex-shrink: 0; }
        .qc { background: ${C.card}; border-left: 3px solid ${C.sky}; border-radius: 0 14px 14px 0; padding: 20px 24px; margin: 20px 0; font-style: italic; color: ${C.textMuted}; font-size: 16px; line-height: 1.6; }
        .qa { display: block; margin-top: 10px; font-style: normal; font-size: 13px; color: ${C.textFaint}; }
        .dn { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; padding: 10px 14px; background: rgba(15,23,42,0.9); border: 1px solid ${C.border}; border-radius: 999px; z-index: 40; }
        .dot-b { width: 8px; height: 8px; border-radius: 50%; background: ${C.textFaint}; border: none; cursor: pointer; padding: 10px; box-sizing: content-box; -webkit-tap-highlight-color: transparent; background-clip: content-box; }
        .dot-a { background: ${C.sky}; width: 24px; border-radius: 4px; }
        .en { position: fixed; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: ${C.card}; border: 1px solid ${C.border}; color: ${C.text}; font-size: 20px; cursor: pointer; z-index: 40; display: flex; align-items: center; justify-content: center; }
        .en:hover:not(:disabled) { border-color: ${C.borderStrong}; }
        .en:disabled { opacity: 0.3; cursor: not-allowed; }
        .ep { left: 16px; }
        .enx { right: 16px; }
        .lr { display: flex; align-items: baseline; gap: 16px; padding: 14px 0; border-bottom: 1px solid ${C.border}; }
        .lr:last-child { border-bottom: none; }
        .ln { font-size: 12px; font-weight: 600; color: ${C.sky}; min-width: 56px; }
        .lt { font-weight: 600; color: ${C.text}; margin-right: 12px; }
        .ld { color: ${C.textMuted}; font-size: 14px; }

        @media (min-width: 720px) {
          .g2 { grid-template-columns: 1fr 1fr; }
          .g3 { grid-template-columns: 1fr 1fr 1fr; }
          .g4 { grid-template-columns: repeat(4, 1fr); }
          .h { font-size: 56px; }
        }
        @media (max-width: 560px) {
          .h { font-size: 32px; }
          .sub { font-size: 16px; }
          .sv { font-size: 24px; }
          .en { display: none; }
        }

        .swipe-hint { display: none; margin-top: 40px; font-size: 12px; color: ${C.textFaint}; letter-spacing: 1px; text-transform: uppercase; align-items: center; gap: 10px; animation: hintPulse 2s ease-in-out infinite; }
        .swipe-arrow { display: inline-block; animation: hintSlide 2s ease-in-out infinite; }
        @keyframes hintPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes hintSlide { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }
        @media (max-width: 720px) { .swipe-hint { display: inline-flex; } }

        @media print {
          .dt, .dn, .en { display: none !important; }
          body, .ss { background: white !important; color: black !important; }
          .ss { min-height: auto; page-break-after: always; padding: 40px; display: flex !important; }
          .h { color: #0f172a !important; }
          .h .a { color: #0284c7 !important; }
          .sub, .body, .tile p, .ld { color: #475569 !important; }
          .tile, .stat { background: white !important; border: 1px solid #cbd5e1 !important; }
          .sv, .lt { color: #0f172a !important; }
          .pre, .ln { color: #0284c7 !important; }
        }
      `}</style>

      <div className="dt">
        <Link href="/" className="db"><span className="dot"></span>FreeTrust · Investor deck</Link>
        <div className="da">
          <span className="ct">{String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
          <button type="button" className="btn" onClick={() => window.print()}>Download PDF</button>
          <a className="btn btn-p" href="mailto:hello@freetrust.co?subject=FreeTrust%20investor%20conversation">Get in touch</a>
        </div>
      </div>

      {SLIDES.map((k, idx) => (
        <div key={k} className="ss" style={{ display: idx === i ? 'flex' : 'none' }}>
          <div className="sl"><Slide k={k} metrics={metrics} /></div>
        </div>
      ))}

      <button type="button" className="en ep" onClick={prev} disabled={i === 0} aria-label="Previous">‹</button>
      <button type="button" className="en enx" onClick={next} disabled={i === SLIDES.length - 1} aria-label="Next">›</button>

      <nav className="dn" aria-label="Slide navigation">
        {SLIDES.map((_, idx) => (
          <button key={idx} type="button" className={`dot-b ${idx === i ? 'dot-a' : ''}`} onClick={() => setI(idx)} aria-label={`Go to slide ${idx + 1}`} />
        ))}
      </nav>
    </div>
  );
}

function Slide({ k, metrics }: { k: SlideKey; metrics: Metrics | null }) {
  switch (k) {
    case 'cover':
      return (<>
        <div className="pre">✦ FreeTrust · Investor deck · 2026</div>
        <h1 className="h">Trust is the <span className="a">new pricing model.</span></h1>
        <p className="sub">FreeTrust is a community economy marketplace where every transaction, review, and AI agent action builds reputation. Reputation lowers fees. Lower fees attract sellers. Sellers bring liquidity. Liquidity brings buyers.</p>
        <p className="body" style={{ color: C.textFaint, fontSize: 14 }}>Founded in Ireland · freetrust.co · 2026</p>
        <div className="swipe-hint" aria-hidden="true">
          <span>swipe or use arrows</span>
          <span className="swipe-arrow">→</span>
        </div>
      </>);
    case 'problem':
      return (<>
        <div className="pre">✦ Problem</div>
        <h1 className="h">Marketplaces extract. Per-seat SaaS is dying.</h1>
        <p className="sub">The incumbent marketplace model charges 15–30% of every transaction. Software&apos;s per-seat model is collapsing as AI replaces users. Community economies have no infrastructure built for them.</p>
        <div className="g3">
          <div className="tile"><h3>Fee extraction</h3><p>Fiverr, Upwork, Etsy take 15–30% per transaction. Sellers rent their own customer relationships.</p></div>
          <div className="tile"><h3>Per-seat collapse</h3><p>SaaSpocalypse Feb 2026: $285B wiped in 48h. Atlassian declines. The human user is no longer the unit of work.</p></div>
          <div className="tile"><h3>Community void</h3><p>Local economies, solo founders, creators and charities have no platform built for trust, reputation, and fair exchange.</p></div>
        </div>
      </>);
    case 'insight':
      return (<>
        <div className="pre">✦ Insight</div>
        <h1 className="h">The moat is the <span className="a">data and orchestration layer.</span></h1>
        <p className="sub">AI agents commoditise UI. What stays valuable is the proprietary data, workflow permissions, and transaction graph that agents need to function. Whoever owns the connective tissue captures value from every layer above.</p>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '8px 20px', marginTop: 20 }}>
          <div className="lr"><div className="ln">Layer 1</div><div><span className="lt">Copilots</span><span className="ld">AI bolted on. Commoditised.</span></div></div>
          <div className="lr"><div className="ln">Layer 2</div><div><span className="lt">Credits</span><span className="ld">Transitional. Moderate defensibility.</span></div></div>
          <div className="lr"><div className="ln">Layer 3</div><div><span className="lt">Autonomous agents</span><span className="ld">Digital labour.</span></div></div>
          <div className="lr"><div className="ln">Layer 4</div><div><span className="lt">Outcome-as-a-service</span><span className="ld">Pay for results.</span></div></div>
          <div className="lr" style={{ background: 'rgba(56,189,248,0.06)', borderRadius: 10, padding: '14px 10px' }}>
            <div className="ln">Layer 5</div>
            <div><span className="lt" style={{ color: C.sky }}>Data + orchestration ← FreeTrust</span><span className="ld">Highest defensibility.</span></div>
          </div>
        </div>
      </>);
    case 'product':
      return (<>
        <div className="pre">✦ Product</div>
        <h1 className="h">Live and shipped.</h1>
        <p className="sub">Not a pitch for what we&apos;ll build. A look at what already works, today, at freetrust.co.</p>
        <div className="g2">
          <div className="tile"><h3>Marketplace + social graph</h3><p>Services, products, jobs, events, communities, organisations, articles. Stripe Connect for payouts. GDPR-compliant. Live.</p></div>
          <div className="tile"><h3>Trust Coin (₮) economy</h3><p>Reputation currency earned through every contribution. Lowers fees. Unlocks visibility. Stored in every member&apos;s wallet.</p></div>
          <div className="tile"><h3>Nine AI agents</h3><p>Listing Creator, Match Finder, Message Drafter, Sales Development, Article Drafter, Event Promoter, Application Writer, Reputation Coach, Translator.</p></div>
          <div className="tile"><h3>Invest tiers</h3><p>Seven paid tiers from €99 to €5,000. Lifetime lower fees, AI Credits, ₮ bonuses, monthly refills. Live revenue stream.</p></div>
        </div>
      </>);
    case 'model':
      return (<>
        <div className="pre">✦ Business model</div>
        <h1 className="h">Four revenue streams. Aligned incentives.</h1>
        <p className="sub">FreeTrust only earns when members earn. No subscriptions, no ads, no data sales.</p>
        <div className="g2">
          <div className="tile"><h3>01 · Transaction fees</h3><p>8% services / 5% products standard. Drops to 0.25% / 0% at top tier. Volume × avg fee × member count.</p></div>
          <div className="tile"><h3>02 · AI Credit purchases</h3><p>Members buy credits in packs (€10–€150). ~95% margin after API costs. Cross-sells into every feature.</p></div>
          <div className="tile"><h3>03 · Invest tiers</h3><p>One-time payments €99–€5,000. Instant revenue, lifetime lower fees. Captures high-intent members.</p></div>
          <div className="tile"><h3>04 · Sponsorships + organisations</h3><p>Charities, community groups, sponsors pay for featured placements and organisation pages.</p></div>
        </div>
      </>);
    case 'moat':
      return (<>
        <div className="pre">✦ Moat</div>
        <h1 className="h">The reputation graph <span className="a">compounds.</span></h1>
        <p className="sub">Every listing, order, review, agent run, and invest purchase writes to a single graph we control. That graph is what AI agents need to function.</p>
        <div className="g3">
          <div className="tile"><h3>Proprietary data</h3><p>Transaction history, reputation scores, matching signals, behavioural patterns — none of it replicable from outside.</p></div>
          <div className="tile"><h3>Integrated workflow</h3><p>Agents run on our infrastructure, read from our DB, write to our ledger. External agents can&apos;t substitute.</p></div>
          <div className="tile"><h3>Network effects</h3><p>More members → more listings → more matches → more transactions → more reputation data → better agents.</p></div>
        </div>
      </>);
    case 'traction':
      return (<>
        <div className="pre">✦ Traction · Live metrics</div>
        <h1 className="h">Early. Honest. Compounding.</h1>
        <p className="sub">Figures update from the live database. Built solo with AI operating tooling in under 6 months.</p>
        <div className="g4">
          <div className="stat"><div className="sl1">Members</div><div className="sv">{metrics?.members ?? '—'}</div><div className="sh">verified humans</div></div>
          <div className="stat"><div className="sl1">Listings</div><div className="sv">{metrics?.listings ?? '—'}</div><div className="sh">services + products</div></div>
          <div className="stat"><div className="sl1">Orders</div><div className="sv">{metrics?.orders ?? '—'}</div><div className="sh">completed</div></div>
          <div className="stat"><div className="sl1">₮ in circulation</div><div className="sv">{metrics?.trustInCirculation ?? '—'}</div><div className="sh">reputation stock</div></div>
          <div className="stat"><div className="sl1">Invest tier buyers</div><div className="sv">{metrics?.founderBuyers ?? '—'}</div><div className="sh">paid tier members</div></div>
          <div className="stat"><div className="sl1">AI agent runs</div><div className="sv">{metrics?.aiCreditsUsed ?? '—'}</div><div className="sh">credits spent</div></div>
        </div>
        <p className="body" style={{ marginTop: 20, color: C.textFaint, fontSize: 13 }}>Metrics refresh on every page load. The graph builds from here.</p>
      </>);
    case 'market':
      return (<>
        <div className="pre">✦ Market</div>
        <h1 className="h">Ireland first. Europe next. Global by design.</h1>
        <p className="sub">Community economy is a €150B+ opportunity across services, creator economy, and local commerce.</p>
        <div className="g3">
          <div className="tile"><h3>Ireland beachhead</h3><p>5m population, €12B SME economy, strong community identity, no incumbent trust-based marketplace.</p></div>
          <div className="tile"><h3>EU expansion</h3><p>€2T+ creator + services economy. GDPR-native. Stripe Connect covers 47 countries out of the box.</p></div>
          <div className="tile"><h3>Global architecture</h3><p>Multi-currency, universal translation agent, reputation graph language-agnostic. No rebuild per region.</p></div>
        </div>
      </>);
    case 'gtm':
      return (<>
        <div className="pre">✦ Go-to-market</div>
        <h1 className="h">Bottom-up. <span className="a">Member-led.</span></h1>
        <p className="sub">Individual sellers and creators adopt first — they bring their networks, their orgs, their charities.</p>
        <div style={{ marginTop: 20 }}>
          <div className="bu"><span className="bd">●</span><span><strong>Content-led discovery</strong> — AI-parseable product copy means FreeTrust surfaces in LLM answer engines, where 89% of B2B research now begins.</span></div>
          <div className="bu"><span className="bd">●</span><span><strong>Community anchors</strong> — sponsorships with Irish charities, community groups, and local events drive early trust-building.</span></div>
          <div className="bu"><span className="bd">●</span><span><strong>Member referrals</strong> — every completed transaction rewards both sides in ₮, creating organic pull.</span></div>
          <div className="bu"><span className="bd">●</span><span><strong>Invest tier flywheel</strong> — paid members have permanent skin in the game, become natural evangelists.</span></div>
        </div>
      </>);
    case 'roadmap':
      return (<>
        <div className="pre">✦ Roadmap · Next 18 months</div>
        <h1 className="h">From Ireland to the graph.</h1>
        <p className="sub">Concrete milestones. Outcome-focused, not feature-focused.</p>
        <div className="g2">
          <div className="tile"><h3>0–6 months</h3><p>1,000 Irish members · first 100 invest tier buyers · €50k+ transaction volume · 10+ agents per DAU.</p></div>
          <div className="tile"><h3>6–12 months</h3><p>Organisation tier launch · UK + EU members · 10k members · €500k transaction volume · community governance v1.</p></div>
          <div className="tile"><h3>12–18 months</h3><p>Member-to-member ₮ trading · API for third-party agents · member-owned governance · sponsorships at scale.</p></div>
          <div className="tile"><h3>North star</h3><p>Become the trust + settlement layer for community economies globally — the Stripe of reputation-based commerce.</p></div>
        </div>
      </>);
    case 'ask':
      return (<>
        <div className="pre">✦ The ask</div>
        <h1 className="h">Invest in the <span className="a">infrastructure</span>, not the application.</h1>
        <p className="sub">FreeTrust is shipped, live, and compounding. The raise funds a focused growth push and the first strategic hires without compromising solo-founder-plus-AI economics.</p>
        <div className="g2">
          <div className="tile"><h3>Structure</h3><p>SAFE or convertible note. Contact for current terms. Flexible on ticket size and structure for strategic partners.</p></div>
          <div className="tile"><h3>Use of funds</h3><p>18-month runway · engineering hire · UK/EU expansion · community partnerships · paid acquisition testing.</p></div>
        </div>
        <div className="qc" style={{ marginTop: 28 }}>
          <span>If you believe trust is the new pricing model — and that whoever owns the data and orchestration layer wins the next decade of commerce — we should talk.</span>
          <span className="qa">— David O&apos;Callaghan, Founder, FreeTrust</span>
        </div>
        <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="mailto:hello@freetrust.co?subject=FreeTrust%20investor%20conversation" style={{ padding: '14px 28px', background: C.sky, color: C.bg, borderRadius: 12, fontWeight: 600, textDecoration: 'none' }}>hello@freetrust.co</a>
          <Link href="/" style={{ padding: '14px 28px', border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, fontWeight: 500, textDecoration: 'none' }}>See FreeTrust live →</Link>
        </div>
      </>);
    default:
      return null;
  }
}
