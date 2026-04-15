'use client'
import { useState } from 'react'
import type { FaqItem } from '@/lib/faq'

// ─────────────────────────────────────────────────────────────────────────
// FAQ Accordion — only one item open at a time
// ─────────────────────────────────────────────────────────────────────────
// Uses CSS grid-template-rows trick for smooth open/close animation:
// the inner wrapper has its grid-template-rows animating between `0fr`
// and `1fr`, which gives a real measured height transition without the
// JS height-measurement flicker of `height: auto` tricks.
//
// Tap targets are generous (14px padding vertical, whole button is
// clickable) so the accordion is comfortable on mobile. The open state
// is tracked as a single index so only one answer is visible at a time.

interface FAQAccordionProps {
  items: readonly FaqItem[]
  /**
   * Optional id used for scroll anchors — set this when the accordion
   * is placed inside a <section id="faq"> so the "Jump to FAQ" links
   * work without extra wiring.
   */
  id?: string
}

export default function FAQAccordion({ items, id }: FAQAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <div
      id={id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        width: '100%',
      }}
    >
      {items.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div
            key={i}
            style={{
              background: '#1e293b',
              border: `1px solid ${isOpen ? 'rgba(56,189,248,0.35)' : 'rgba(56,189,248,0.08)'}`,
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-header-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                width: '100%',
                padding: '1rem 1.1rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#f1f5f9',
                fontSize: '0.95rem',
                fontWeight: 700,
                fontFamily: 'inherit',
                lineHeight: 1.4,
                minHeight: 52,
              }}
            >
              <span>{item.question}</span>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isOpen ? '#38bdf8' : 'rgba(56,189,248,0.12)',
                  color: isOpen ? '#0f172a' : '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  lineHeight: 1,
                  transition: 'transform 0.25s ease, background 0.2s, color 0.2s',
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                }}
              >
                +
              </span>
            </button>

            {/* Animated panel — grid-template-rows trick for smooth open */}
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-header-${i}`}
              style={{
                display: 'grid',
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.28s ease',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <p
                  style={{
                    margin: 0,
                    padding: '0 1.1rem 1.1rem',
                    fontSize: '0.88rem',
                    color: '#94a3b8',
                    lineHeight: 1.65,
                  }}
                >
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
