import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Trust & Safety Policy | FreeTrust',
  description: 'How FreeTrust protects members with verified accounts, on-platform payments, protected messaging, AI image generation safeguards, reporting and marketplace safety rules.',
}

const safetySections = [
  {
    title: 'Verified member trust',
    body: 'FreeTrust is designed around accountable member profiles, trust signals and behaviour-based protections. We do not allow impersonation, fake accounts, automated marketplace activity or attempts to manipulate TrustCoins, reviews, listings or reputation signals.',
  },
  {
    title: 'Protected messaging',
    body: 'FreeTrust messages are intended for genuine marketplace and community communication. Members should keep payment, delivery and order details inside FreeTrust. We may limit, block or review messaging activity that appears spammy, abusive, fraudulent, unsafe or designed to move transactions off-platform.',
  },
  {
    title: 'On-platform payments',
    body: 'For marketplace protection, FreeTrust encourages members to transact through FreeTrust checkout and connected payment flows. We do not support requests to pay by bank transfer, crypto, cash apps, gift cards or other off-platform methods when a FreeTrust checkout is available.',
  },
  {
    title: 'Marketplace integrity',
    body: 'Listings must be accurate, lawful and offered by the person or organisation responsible for fulfilling them. FreeTrust may remove listings, restrict checkout, suspend seller activity or investigate orders where listing, seller, price, fulfilment or identity data appears incomplete or unsafe.',
  },
  {
    title: 'AI image generation safeguards',
    body: 'FreeTrust image generation is limited to creative, professional and brand-safe uses such as marketplace visuals, service concepts, event posters, profile banners and community graphics. Prompts are reviewed before generation and generated images are reviewed before upload. We block unsafe, unlawful, sexual, hateful, violent, impersonation, fake-document, privacy-invasive, copyrighted/trademark-imitating, unsolicited outreach, spam, phishing, pressure-sales, fake endorsement, deceptive or manipulative promotional content. Image generation never silently posts to the feed; members must review and confirm any use publicly.',
  },
  {
    title: 'Reports, blocks and moderation',
    body: 'Members can report suspicious behaviour, harassment, misleading listings, unsafe payment requests or prohibited content. FreeTrust may use reports, trust signals, transaction history and platform logs to review abuse and take appropriate action.',
  },
  {
    title: 'Data protection and transparency',
    body: 'FreeTrust uses technical and organisational controls to protect personal data and platform activity. Our Privacy Policy explains what data we collect, how we use it, and the rights members have under applicable data protection law.',
  },
]

const prohibited = [
  'Fake, duplicate or impersonation accounts',
  'Requests to move protected transactions off FreeTrust',
  'Spam, harassment, threats or abusive messaging',
  'Misleading listings, fake reviews or TrustCoin manipulation',
  'Unsafe, unlawful or unsolicited AI-generated images, including spam, pressure-sales, phishing, impersonation, fake endorsements or manipulative promotional content',
  'Illegal goods, counterfeit goods or services that violate applicable law',
  'Attempts to bypass security, rate limits, payment checks or moderation systems',
]

export default function SafetyPage() {
  return (
    <div className="ft-policy-page">
      <div className="ft-policy-wrap">
        <section className="ft-policy-hero">
          <Link href="/" className="ft-policy-back">← Back to FreeTrust</Link>
          <div className="ft-policy-eyebrow">
            🛡 Trust &amp; Safety
          </div>
          <h1>
            Safer community commerce by design
          </h1>
          <p className="ft-policy-subtitle">
            FreeTrust combines member accountability, protected messaging, on-platform payments,
            marketplace rules and clear reporting paths to help members trade, collaborate and build trust safely.
          </p>
          <div className="ft-policy-actions">
            <Link href="/register" className="ft-policy-btn ft-policy-btn-primary">
              Join FreeTrust safely →
            </Link>
            <Link href="/privacy" className="ft-policy-btn">
              Privacy Policy
            </Link>
            <Link href="/terms" className="ft-policy-btn">
              Terms of Service
            </Link>
          </div>
        </section>

        <section className="ft-policy-grid">
          {safetySections.map(section => (
            <article key={section.title} className="ft-policy-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="ft-policy-danger">
          <h2>Not allowed on FreeTrust</h2>
          <ul className="ft-policy-bad-list">
            {prohibited.map(item => (
              <li key={item}>
                <span aria-hidden="true">✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ft-policy-report">
          <h2>If something feels unsafe</h2>
          <p className="ft-policy-subtitle">
            Keep the conversation and payment trail inside FreeTrust, do not send money externally,
            save any relevant messages or order details, and contact FreeTrust support for review.
          </p>
          <a href="mailto:hello@freetrust.co" className="ft-policy-btn ft-policy-btn-primary">
            Report a safety concern
          </a>
        </section>
      </div>
    </div>
  )
}
