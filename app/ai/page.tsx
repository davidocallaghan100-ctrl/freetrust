'use client'
import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'ai'
  text: string
  links?: { label: string; href: string }[]
}

// ── FreeTrust AI knowledge base ───────────────────────────────────────────────
const KB: { patterns: RegExp[]; answer: string; links?: { label: string; href: string }[] }[] = [
  {
    patterns: [/trust score|trust point|trust token|₮|earn trust|how.*trust work/i],
    answer: `**Trust Score (₮)** is FreeTrust's reputation currency — you earn it by doing good things on the platform:\n\n• ✅ Complete your profile → ₮10\n• 🛒 Make or receive a sale → ₮25\n• ⭐ Get a 5-star review → ₮20\n• 📝 Post content → ₮5 per post\n• 💼 Apply for a job → ₮5\n• 👥 Get 10 followers → ₮20\n• 🎉 Join a community → ₮5\n\nHigher Trust = lower fees, better visibility, and access to exclusive features. Founding members start with a bonus.`,
    links: [{ label: 'View your Trust Score', href: '/analytics' }],
  },
  {
    patterns: [/fee|commission|how much.*cost|pricing|how.*charge|cost to sell/i],
    answer: `FreeTrust uses a **sliding fee structure based on your Trust Score**:\n\n• 🌱 New (₮0–99) → 5% fee\n• 🔵 Active (₮100–499) → 3% fee\n• 💚 Verified (₮500–999) → 2% fee\n• 💜 Top Trusted (₮1000–4999) → 1% fee\n• 🏆 Elite (₮5000+) → **0% fee forever**\n\nThe more you contribute, the less you pay. That's the FreeTrust promise.`,
    links: [{ label: 'Start earning Trust', href: '/analytics' }],
  },
  {
    patterns: [/sell.*service|offer.*service|list.*service|become.*seller|freelanc/i],
    answer: `**Selling services on FreeTrust is free to start.** Here's how:\n\n1. Go to *Offer a Service* and create your gig\n2. Set your packages (Basic, Standard, Premium)\n3. Your listing appears in the Services marketplace\n4. Buyers can book directly — funds held in escrow until delivery\n5. On completion, Trust is awarded to both parties 🎉\n\nYou keep 95–100% depending on your Trust level.`,
    links: [{ label: 'Offer a Service', href: '/seller/gigs/create' }, { label: 'Browse Services', href: '/services' }],
  },
  {
    patterns: [/sell.*product|list.*product|marketplace|sell.*item|digital product/i],
    answer: `**The FreeTrust Marketplace** supports both physical and digital products.\n\n• Digital products (templates, code, music, designs) → instant delivery\n• Physical products → standard shipping\n• All transactions go through escrow for buyer protection\n• Sellers earn Trust on every completed sale\n\nList your product in minutes — just go to Collab → Marketplace.`,
    links: [{ label: 'List a Product', href: '/seller/gigs/create' }, { label: 'View Marketplace', href: '/collab/marketplace' }],
  },
  {
    patterns: [/how.*join|sign up|register|create.*account|get started|founding member/i],
    answer: `**Welcome! Here's how to get started on FreeTrust:**\n\n1. 👤 Create your account (free)\n2. ✅ Complete your profile to earn ₮10 straight away\n3. 🌟 You're a **Founding Member** — this gives you early access perks and a head start on Trust\n4. 🛍 Browse the marketplace, services, jobs or events\n5. 💼 List your own service or product to start earning\n\nAs a founding member, your Trust Score will give you advantages that later members won't have.`,
    links: [{ label: 'Create Account', href: '/register' }, { label: 'Complete Profile', href: '/profile' }],
  },
  {
    patterns: [/job|hire|recruit|apply.*job|post.*job|find.*work|employment/i],
    answer: `**FreeTrust Jobs** connects trusted talent with trusted employers.\n\n• Browse full-time, part-time, contract and freelance roles\n• Filter by location type (remote, hybrid, on-site), salary, and category\n• Apply with your cover letter + upload your CV directly\n• Earn ₮5 Trust for every application you submit\n• Post a job to reach thousands of vetted community members`,
    links: [{ label: 'Browse Jobs', href: '/jobs' }, { label: 'Post a Job', href: '/jobs/new' }],
  },
  {
    patterns: [/event|meetup|webinar|workshop|conference/i],
    answer: `**FreeTrust Events** hosts online and in-person gatherings:\n\n• 🎙 Webinars and live Q&As with top community members\n• 🤝 In-person meetups in Dublin, London and beyond\n• 🏆 Hackathons with cash prizes\n• 📚 Workshops and skills sessions\n• 🆓 Many events are completely free — filter by price\n\nCreating an event earns Trust and builds your reputation in the community.`,
    links: [{ label: 'Browse Events', href: '/events' }, { label: 'Create an Event', href: '/events/create' }],
  },
  {
    patterns: [/community|group|forum|discussion/i],
    answer: `**Communities** are the heart of FreeTrust — topic-based spaces where members connect, share, and collaborate.\n\n• Join existing communities around your interests\n• Create your own community around your niche\n• Post updates, share resources, run events\n• Community activity earns Trust points\n\nActive communities get featured on the homepage 🌟`,
    links: [{ label: 'Browse Communities', href: '/community' }, { label: 'Create a Community', href: '/community/new' }],
  },
  {
    patterns: [/escrow|payment|safe|secure|buyer protection/i],
    answer: `**FreeTrust Escrow** protects every transaction:\n\n• 🔒 Buyer's funds are held securely until delivery is confirmed\n• ✅ Seller gets paid only when the buyer approves the work\n• 🛡 Disputes are handled by the FreeTrust resolution team\n• 💳 We support card payments via Stripe\n\nNeither party can lose money — it's the trust-first way to transact.`,
    links: [{ label: 'View Orders', href: '/orders' }],
  },
  {
    patterns: [/impact|charity|donate|1%|purpose|social good/i],
    answer: `**FreeTrust Impact** — 1% of every transaction goes to community impact projects.\n\nThis is automatic — you don't need to do anything. Every time you buy or sell, a small portion goes directly to causes chosen by the FreeTrust community.\n\nMembers can also donate Trust tokens directly to impact initiatives. Trade well, do good.`,
    links: [{ label: 'View Impact', href: '/impact' }],
  },
  {
    patterns: [/analytics|dashboard|stat|performance|revenue|insight/i],
    answer: `**Your Analytics Dashboard** shows everything about your performance:\n\n• 📊 Trust earned this month\n• 👁 Profile views\n• 💰 Revenue from sales\n• 📝 Content engagement (views, likes, comments)\n• 👥 Follower growth\n• 🛒 Marketplace conversion rates\n\nSign in to access your full dashboard.`,
    links: [{ label: 'Open Analytics', href: '/analytics' }],
  },
  {
    patterns: [/profile|bio|avatar|complete.*profile/i],
    answer: `**Your FreeTrust profile** is your trust identity on the platform.\n\n• Add a photo, bio, location and website\n• Completing it earns you ₮10 immediately\n• Your Trust Score is displayed prominently\n• Clients, buyers and employers check it before engaging\n• You can showcase your services, products and reviews\n\nA complete profile gets 3× more enquiries.`,
    links: [{ label: 'Edit Profile', href: '/profile' }],
  },
  {
    patterns: [/hello|hi |hey |howdy|greet|good morning|good afternoon/i],
    answer: `**Hey there! 👋 I'm the FreeTrust AI assistant.**\n\nI can help you with:\n\n• 💎 Understanding Trust Scores and how to earn them\n• 💰 Fees and how they decrease as you grow\n• 🛍 Selling services or products on the marketplace\n• 💼 Finding or posting jobs\n• 🎉 Discovering events and communities\n• 🔒 How escrow and payments work\n\nWhat would you like to know?`,
    links: [],
  },
  {
    patterns: [/what is freetrust|about freetrust|what.*platform|how.*freetrust work/i],
    answer: `**FreeTrust** is a trust-based social commerce platform.\n\nThe core idea: **Trust is your currency.** The more you contribute — selling, buying, creating, engaging — the more Trust you earn, and the less you pay in fees.\n\n🌟 **For sellers:** List services, products and jobs. Earn Trust with every transaction.\n🛒 **For buyers:** Find vetted, trusted providers. Every purchase is protected by escrow.\n🤝 **For everyone:** Connect, collaborate, and build reputation in a community that rewards integrity.\n\nFreeTrust is built for creators, freelancers, founders and purpose-driven businesses.`,
    links: [{ label: 'Get Started', href: '/register' }, { label: 'Browse Services', href: '/services' }],
  },
]

const FALLBACKS = [
  `I don't have a specific answer for that yet, but I'm learning! Try asking me about **Trust Scores**, **fees**, **selling services**, **jobs**, or **events**. Or browse the platform to explore 👇`,
  `Great question! I'm still building my knowledge base. In the meantime, try the **Help** section or ask about how Trust works, fees, or how to sell on FreeTrust.`,
  `I'm not sure about that one — but I can definitely help with Trust Scores, the marketplace, jobs, events, and how payments work. What would you like to know?`,
]

function getResponse(input: string): Message {
  const match = KB.find(k => k.patterns.some(p => p.test(input)))
  if (match) return { role: 'ai', text: match.answer, links: match.links }
  return {
    role: 'ai',
    text: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)],
    links: [
      { label: 'Browse Services', href: '/services' },
      { label: 'Browse Jobs', href: '/jobs' },
      { label: 'Browse Events', href: '/events' },
    ],
  }
}

function renderText(text: string) {
  // Bold **text** and line breaks
  const parts = text.split('\n')
  return parts.map((line, li) => {
    const segments = line.split(/\*\*([^*]+)\*\*/g)
    return (
      <span key={li}>
        {segments.map((seg, si) =>
          si % 2 === 1 ? <strong key={si} style={{ color: '#f1f5f9' }}>{seg}</strong> : seg
        )}
        {li < parts.length - 1 && <br />}
      </span>
    )
  })
}

const QUICK_PROMPTS = [
  'How does Trust work?',
  'What are the fees?',
  'How do I sell a service?',
  'Tell me about jobs',
  'What is FreeTrust?',
  'How does escrow work?',
]

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: `**Hey! I'm the FreeTrust AI 👋**\n\nI'm here to help you get the most out of the platform. Ask me anything about Trust Scores, fees, selling, jobs, events, or how FreeTrust works.\n\nWhat can I help you with today?`,
      links: [],
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const send = (text: string) => {
    const q = text.trim()
    if (!q) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(m => [...m, getResponse(q)])
    }, 600 + Math.random() * 400)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', paddingTop: 104 }}>
      <style>{`
        .ai-msg-user { background: linear-gradient(135deg,#38bdf8,#0284c7); color: #0f172a; border-radius: 18px 18px 4px 18px; align-self: flex-end; max-width: 78%; }
        .ai-msg-ai { background: #1e293b; border: 1px solid #334155; border-radius: 18px 18px 18px 4px; align-self: flex-start; max-width: 88%; }
        .ai-quick-btn { background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2); color: #38bdf8; border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; transition: all 0.15s; font-family: inherit; flex-shrink: 0; }
        .ai-quick-btn:hover { background: rgba(56,189,248,0.18); border-color: rgba(56,189,248,0.4); }
        .ai-link-btn { display: inline-flex; align-items: center; gap: 5px; background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.25); border-radius: 8px; padding: 5px 12px; font-size: 12px; color: #38bdf8; text-decoration: none; font-weight: 600; transition: all 0.15s; }
        .ai-link-btn:hover { background: rgba(56,189,248,0.15); }
        @keyframes ai-typing { 0%,80%,100% { transform: scale(0.6); opacity:0.4; } 40% { transform: scale(1); opacity:1; } }
        .ai-dot { width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block; animation: ai-typing 1.2s ease-in-out infinite; }
        .ai-dot:nth-child(2) { animation-delay: 0.2s; }
        .ai-dot:nth-child(3) { animation-delay: 0.4s; }
        @media (max-width: 640px) { .ai-msg-ai { max-width: 95%; } .ai-msg-user { max-width: 88%; } }
      `}</style>

      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid rgba(56,189,248,0.1)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'fixed', top: 104, left: 0, right: 0, zIndex: 50 }}>
        <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</Link>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>FreeTrust AI</div>
          <div style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            Online · Always here to help
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 160px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720, margin: '0 auto', width: '100%' }}>

        {/* Quick prompts — shown at top */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {QUICK_PROMPTS.map(q => (
            <button key={q} className="ai-quick-btn" onClick={() => send(q)}>{q}</button>
          ))}
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-ai'} style={{ padding: '12px 16px', fontSize: 14, lineHeight: 1.65 }}>
            {msg.role === 'ai' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>🤖</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>FreeTrust AI</span>
              </div>
            )}
            <div style={{ color: msg.role === 'user' ? '#0f172a' : '#cbd5e1' }}>
              {renderText(msg.text)}
            </div>
            {msg.links && msg.links.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {msg.links.map(l => (
                  <Link key={l.href} href={l.href} className="ai-link-btn">
                    {l.label} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="ai-msg-ai" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="ai-dot" />
            <div className="ai-dot" />
            <div className="ai-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, background: '#0f172a', borderTop: '1px solid rgba(56,189,248,0.1)', padding: '10px 16px', zIndex: 50 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, maxWidth: 720, margin: '0 auto' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask me anything about FreeTrust…"
            style={{ flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(56,189,248,0.2)')}
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            style={{ background: input.trim() ? 'linear-gradient(135deg,#38bdf8,#0284c7)' : '#1e293b', border: 'none', borderRadius: 12, padding: '0 18px', color: input.trim() ? '#0f172a' : '#475569', fontWeight: 800, fontSize: 18, cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.15s', minWidth: 48, flexShrink: 0 }}
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  )
}
