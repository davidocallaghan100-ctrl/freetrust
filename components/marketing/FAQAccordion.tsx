'use client'

import { useState } from 'react'
import type { FAQItem } from '@/lib/faq'

// Accordion with smooth open/close, single-open behaviour, and mobile
// friendly tap targets (full-row clickable, 48px+ row height).
//
// No external animation libs — we use CSS `grid-template-rows`
// 1fr ⇄ 0fr transition which animates height without needing to
// measure the content. Works in every modern browser and is ~20 lines.
//
// The h3 question is the clickable element (important for a11y and
// for Google / Bing to pick up as a heading in the FAQ structured
// data pairing). aria-expanded + aria-controls wire up screen reader
// announcement on open/close.
export default function FAQAccordion({ items }: { items: readonly FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid rgba(56,189,248,0.1)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => {
        const isOpen = openIndex === i
        const panelId = `faq-panel-${i}`
        const buttonId = `faq-button-${i}`
        return (
          <div
            key={item.question}
            style={{
              borderBottom:
                i < items.length - 1 ? '1px solid rgba(56,189,248,0.08)' : 'none',
            }}
          >
            <h3 style={{ margin: 0 }}>
              <button
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width:          '100%',
                  minHeight:      56,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  gap:            '1rem',
                  padding:        '1rem 1.25rem',
                  background:     'transparent',
                  border:         'none',
                  color:          '#f1f5f9',
                  fontSize:       '0.95rem',
                  fontWeight:     700,
                  textAlign:      'left',
                  cursor:         'pointer',
                  fontFamily:     'inherit',
                }}
              >
                <span style={{ flex: 1, lineHeight: 1.4 }}>{item.question}</span>
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink:  0,
                    width:       24,
                    height:      24,
                    display:     'flex',
                    alignItems:  'center',
                    justifyContent: 'center',
                    color:       '#38bdf8',
                    fontSize:    '1.1rem',
                    transform:   isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition:  'transform 0.25s ease',
                  }}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              style={{
                display:            'grid',
                gridTemplateRows:   isOpen ? '1fr' : '0fr',
                transition:         'grid-template-rows 0.28s ease',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    padding:    '0 1.25rem 1.1rem',
                    color:      '#94a3b8',
                    fontSize:   '0.88rem',
                    lineHeight: 1.65,
                  }}
                >
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
