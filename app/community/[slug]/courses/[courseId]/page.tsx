'use client'
import React, { useState, use } from 'react'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  body: string
  video_url: string | null
  position: number
}

const MOCK_LESSONS: Lesson[] = [
  { id: 'l1', title: 'Introduction to Value-Based Pricing', body: `<h2>What is value-based pricing?</h2><p>Value-based pricing is a strategy that sets prices primarily based on the perceived value of the product or service to the customer, rather than on the cost of production or historical prices.</p><p>Unlike cost-plus pricing (where you add a markup to your costs) or competitive pricing (where you match competitors), value-based pricing starts with the question: <strong>how much is this worth to the customer?</strong></p><h3>The core principle</h3><p>Customers don't buy features. They buy outcomes. When you price based on value, you're acknowledging that the true worth of your product is determined by what it does for the customer — the problems it solves, the time it saves, the money it makes them.</p><p>A SaaS tool that saves a team 10 hours per week is worth far more than its build cost. A tool that helps a company close 20% more deals is worth a percentage of those deals, not the cost of the code.</p>`, video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', position: 0 },
  { id: 'l2', title: 'Identifying Your Value Metric', body: `<h2>What is a value metric?</h2><p>A value metric is the unit by which your customers measure the value they get from your product. Getting this right is one of the most important decisions in SaaS pricing.</p><p>Examples of value metrics:</p><ul><li><strong>Seats/users</strong> — e.g. Slack, Notion</li><li><strong>Usage volume</strong> — e.g. API calls, emails sent, storage</li><li><strong>Outcomes</strong> — e.g. revenue generated, leads closed</li><li><strong>Features</strong> — e.g. access to premium functionality</li></ul><h3>How to find your value metric</h3><p>Ask your customers: what would make you feel you were getting <em>more</em> value from this product? Their answer reveals the metric they care about most.</p>`, video_url: null, position: 1 },
  { id: 'l3', title: 'Building Your Pricing Tiers', body: `<h2>Tier structure fundamentals</h2><p>Most SaaS products benefit from 3 pricing tiers: a starter/free tier to reduce friction, a mid-tier (usually your most important) that captures the majority of customers, and an enterprise tier for high-value accounts.</p><p>The classic structure is <strong>Good / Better / Best</strong>. The trick is to make the "better" tier feel like the obvious choice — and price accordingly.</p><h3>What goes in each tier?</h3><p>Design tiers around customer segments, not features. Ask: who is my smallest viable customer? My ideal customer? My largest enterprise customer? Build tiers for each persona.</p>`, video_url: null, position: 2 },
  { id: 'l4', title: 'Anchoring and Psychological Pricing', body: `<h2>The power of anchors</h2><p>Pricing is relative. Customers don't evaluate price in isolation — they evaluate it relative to something else. That "something else" is your anchor.</p><p>By showing a higher price first (your enterprise plan), your mid-tier plan suddenly looks more reasonable. This is anchoring — one of the most powerful tools in your pricing toolkit.</p>`, video_url: null, position: 3 },
  { id: 'l5', title: 'Testing and Iterating Your Price', body: `<h2>Pricing is not a one-time decision</h2><p>One of the biggest mistakes founders make is treating pricing as a fixed decision. Your price should evolve as you learn more about your customers and market.</p><p>How to test: run A/B tests on pricing pages, grandfathering existing customers while testing higher prices on new ones, and use cohort analysis to understand price sensitivity by segment.</p>`, video_url: null, position: 4 },
]

const MOCK_COURSE = {
  id: 'c1',
  title: 'SaaS Pricing Masterclass',
  description: 'A comprehensive guide to pricing your SaaS product for maximum growth. Covers value-based pricing, packaging, tier design, and testing.',
}

export default function CoursePage({ params }: { params: Promise<{ slug: string; courseId: string }> }) {
  const { slug } = use(params)
  const [currentLesson, setCurrentLesson] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  const lesson = MOCK_LESSONS[currentLesson]
  const progress = completed.size
  const total = MOCK_LESSONS.length

  const markComplete = () => {
    setCompleted(prev => new Set(Array.from(prev).concat(currentLesson)))
    if (currentLesson < MOCK_LESSONS.length - 1) {
      setCurrentLesson(p => p + 1)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .lesson-body h2 { font-size: 1.15rem; font-weight: 700; color: #f1f5f9; margin: 1.25rem 0 0.6rem; }
        .lesson-body h3 { font-size: 1rem; font-weight: 700; color: #cbd5e1; margin: 1rem 0 0.5rem; }
        .lesson-body p { font-size: 0.92rem; color: #cbd5e1; line-height: 1.75; margin: 0 0 0.85rem; }
        .lesson-body ul { font-size: 0.92rem; color: #cbd5e1; line-height: 1.75; margin: 0 0 0.85rem; padding-left: 1.5rem; }
        .lesson-body li { margin-bottom: 0.3rem; }
        .lesson-body strong { color: #f1f5f9; }
        .lesson-sidebar-item:hover { background: rgba(56,189,248,0.06) !important; }
        @media (max-width: 900px) {
          .course-layout { grid-template-columns: 1fr !important; }
          .course-sidebar { border-right: none !important; border-bottom: 1px solid rgba(56,189,248,0.1) !important; max-height: 300px; overflow-y: auto; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.08) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,0.1)', padding: '1.25rem 1.5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.6rem' }}>
            <Link href="/community" style={{ color: '#64748b', textDecoration: 'none' }}>Communities</Link>
            <span>›</span>
            <Link href={`/community/${slug}`} style={{ color: '#64748b', textDecoration: 'none' }}>Community</Link>
            <span>›</span>
            <Link href={`/community/${slug}`} onClick={() => {}} style={{ color: '#64748b', textDecoration: 'none' }}>Classroom</Link>
            <span>›</span>
            <span style={{ color: '#94a3b8' }}>{MOCK_COURSE.title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.3rem' }}>{MOCK_COURSE.title}</h1>
              <p style={{ fontSize: '0.83rem', color: '#64748b', margin: 0 }}>{MOCK_COURSE.description}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{progress}/{total} complete</div>
              <div style={{ width: 120, height: 6, background: 'rgba(148,163,184,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progress / total) * 100}%`, background: '#38bdf8', borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="course-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 160px)' }}>

        {/* Sidebar */}
        <div className="course-sidebar" style={{ borderRight: '1px solid rgba(56,189,248,0.1)', padding: '1.25rem 0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 1.25rem', marginBottom: '0.75rem' }}>
            Lessons · {total}
          </div>
          {MOCK_LESSONS.map((l, i) => (
            <button
              key={l.id}
              className="lesson-sidebar-item"
              onClick={() => setCurrentLesson(i)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.25rem', background: i === currentLesson ? 'rgba(56,189,248,0.08)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: i === currentLesson ? '2px solid #38bdf8' : '2px solid transparent', transition: 'background 0.12s' }}
            >
              <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: completed.has(i) ? '#38bdf8' : i === currentLesson ? 'rgba(56,189,248,0.2)' : 'rgba(148,163,184,0.1)', border: completed.has(i) ? 'none' : i === currentLesson ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: completed.has(i) ? '#0f172a' : i === currentLesson ? '#38bdf8' : '#64748b' }}>
                {completed.has(i) ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.83rem', color: i === currentLesson ? '#f1f5f9' : completed.has(i) ? '#94a3b8' : '#64748b', fontWeight: i === currentLesson ? 600 : 400, lineHeight: 1.3 }}>
                {l.title}
              </span>
            </button>
          ))}
        </div>

        {/* Lesson Content */}
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Lesson {currentLesson + 1} of {total}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '1.5rem', lineHeight: 1.3 }}>{lesson.title}</h2>

            {lesson.video_url && (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginBottom: '1.75rem', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
                <iframe
                  src={lesson.video_url}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                  title={lesson.title}
                />
              </div>
            )}

            <div className="lesson-body" dangerouslySetInnerHTML={{ __html: lesson.body }} />

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(56,189,248,0.1)', flexWrap: 'wrap' }}>
              <button
                onClick={() => setCurrentLesson(p => Math.max(0, p - 1))}
                disabled={currentLesson === 0}
                style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, color: currentLesson === 0 ? '#475569' : '#94a3b8', cursor: currentLesson === 0 ? 'not-allowed' : 'pointer' }}
              >
                ← Previous
              </button>
              <button
                onClick={markComplete}
                style={{ background: completed.has(currentLesson) ? 'rgba(52,211,153,0.1)' : '#38bdf8', border: completed.has(currentLesson) ? '1px solid rgba(52,211,153,0.3)' : 'none', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: completed.has(currentLesson) ? '#34d399' : '#0f172a', cursor: 'pointer' }}
              >
                {completed.has(currentLesson) ? '✓ Completed' : currentLesson === total - 1 ? '🎉 Complete Course' : 'Mark Complete & Next →'}
              </button>
              {currentLesson < total - 1 && (
                <button
                  onClick={() => setCurrentLesson(p => Math.min(total - 1, p + 1))}
                  style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
