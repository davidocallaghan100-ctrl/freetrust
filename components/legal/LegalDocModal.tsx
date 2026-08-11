'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { LegalDoc } from '@/lib/legalDocs'

type LegalDocModalProps = {
  docs: LegalDoc[]
  isOpen: boolean
  onClose: () => void
}

const navy = '#0A1628'
const blue = '#1B4F8A'
const teal = '#0D9488'
const white = '#FFFFFF'

export default function LegalDocModal({ docs, isOpen, onClose }: LegalDocModalProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const activeDoc = docs[activeIndex] ?? docs[0]

  useEffect(() => {
    if (!isOpen) return

    setActiveIndex(0)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setActiveIndex((current) => (current - 1 + docs.length) % docs.length)
      if (event.key === 'ArrowRight') setActiveIndex((current) => (current + 1) % docs.length)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [docs.length, isOpen, onClose])

  if (!isOpen || !activeDoc || docs.length === 0) return null

  const goPrevious = () => {
    setActiveIndex((current) => (current - 1 + docs.length) % docs.length)
  }

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % docs.length)
  }

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-doc-title"
      onClick={onClose}
      style={styles.overlay}
    >
      <div style={styles.shell} onClick={stopPropagation}>
        <header style={styles.header}>
          <div style={styles.wordmarkWrap} aria-label="FreeTrust">
            <span aria-hidden="true" style={styles.logoMark}>FT</span>
            <span style={styles.wordmark}>FreeTrust</span>
          </div>
          <div style={styles.headerCenter}>
            <div style={styles.headerKicker}>Legal library</div>
            <h2 id="legal-doc-title" style={styles.title}>{activeDoc.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close legal document" style={styles.closeButton}>
            ×
          </button>
        </header>

        <main style={styles.contentArea} onClick={onClose}>
          <div style={styles.deck} onClick={stopPropagation}>
            <nav aria-label="Legal document slides" style={styles.slideRail}>
              {docs.map((doc, index) => {
                const isActive = index === activeIndex

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-current={isActive ? 'step' : undefined}
                    style={{
                      ...styles.slideTab,
                      ...(isActive ? styles.slideTabActive : null),
                    }}
                  >
                    <span style={{ ...styles.slideNumber, ...(isActive ? styles.slideNumberActive : null) }}>{index + 1}</span>
                    <span>{doc.title}</span>
                  </button>
                )
              })}
            </nav>

            <article style={styles.card}>
              <div style={styles.cardTopline}>
                <div style={styles.cardKicker}>Legal slide {activeIndex + 1} of {docs.length}</div>
                <div style={styles.slideDots} aria-hidden="true">
                  {docs.map((doc, index) => (
                    <span key={doc.id} style={{ ...styles.dot, ...(index === activeIndex ? styles.dotActive : null) }} />
                  ))}
                </div>
              </div>
              <h3 style={styles.cardTitle}>{activeDoc.title}</h3>
              <p style={styles.cardIntro}>Review each FreeTrust legal section in a clean slide format. Use the document tabs or arrows to move through the set.</p>
            <div style={styles.rule} />
            <div style={styles.sectionsGrid}>
              {activeDoc.sections.map((section) => (
                <section key={`${activeDoc.id}-${section.heading}`} style={styles.section}>
                  <div style={styles.sectionLabel}>{section.heading}</div>
                  <p style={styles.bodyText}>{section.body}</p>
                </section>
              ))}
            </div>
              <div style={styles.controls}>
                <button type="button" onClick={goPrevious} style={styles.controlButton} aria-label="Previous legal document">← Previous</button>
                <span style={styles.controlStatus}>{activeIndex + 1} / {docs.length}</span>
                <button type="button" onClick={goNext} style={styles.controlButton} aria-label="Next legal document">Next →</button>
              </div>
            </article>
          </div>
        </main>

        <footer style={styles.footer}>FreeTrust legal library | Confidential | freetrust.co</footer>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 5000,
    background: 'rgba(10, 22, 40, 0.72)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
  },
  shell: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#F4F7FC',
  },
  header: {
    minHeight: 72,
    background: navy,
    color: white,
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 1.3fr) minmax(56px, 1fr)',
    alignItems: 'center',
    gap: 12,
    padding: 'calc(env(safe-area-inset-top, 0px) + 14px) clamp(16px, 3vw, 32px) 14px',
    boxShadow: '0 12px 32px rgba(10, 22, 40, 0.28)',
  },
  headerCenter: {
    minWidth: 0,
    textAlign: 'center',
  },
  headerKicker: {
    color: '#99F6E4',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  wordmarkWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${teal}, ${blue})`,
    color: white,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: '-0.04em',
    boxShadow: '0 0 18px rgba(13, 148, 136, 0.45)',
  },
  wordmark: {
    color: white,
    fontSize: 18,
    fontWeight: 850,
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  },
  title: {
    color: white,
    margin: 0,
    fontSize: 'clamp(1rem, 3.4vw, 1.55rem)',
    fontWeight: 850,
    textAlign: 'center',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  closeButton: {
    justifySelf: 'end',
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.16)',
    color: white,
    fontSize: 30,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 26px rgba(0,0,0,0.22)',
  },
  contentArea: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    background: '#F4F7FC',
    padding: 'clamp(18px, 4vw, 44px) clamp(14px, 4vw, 28px)',
  },
  deck: {
    width: '100%',
    maxWidth: 1020,
    margin: '0 auto',
  },
  slideRail: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '0 0 14px',
    marginBottom: 10,
  },
  slideTab: {
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '9px 13px',
    borderRadius: 999,
    border: '1px solid rgba(27,79,138,0.12)',
    background: 'rgba(255,255,255,0.78)',
    color: 'var(--ft-text-faint)',
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 24px rgba(10,22,40,0.06)',
  },
  slideTabActive: {
    background: navy,
    borderColor: 'rgba(13,148,136,0.45)',
    color: white,
    boxShadow: '0 14px 34px rgba(10,22,40,0.22)',
  },
  slideNumber: {
    width: 24,
    height: 24,
    minWidth: 24,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(13,148,136,0.10)',
    color: teal,
    fontSize: 12,
    fontWeight: 950,
  },
  slideNumberActive: {
    background: `linear-gradient(135deg, ${teal}, ${blue})`,
    color: white,
  },
  card: {
    width: '100%',
    maxWidth: 860,
    margin: '0 auto',
    background: white,
    borderRadius: 12,
    padding: 'clamp(24px, 5vw, 40px)',
    border: '1px solid rgba(27,79,138,0.10)',
    boxShadow: '0 24px 70px rgba(10, 22, 40, 0.14)',
    color: navy,
  },
  cardTopline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  cardKicker: {
    display: 'inline-flex',
    alignItems: 'center',
    color: teal,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cardTitle: {
    margin: 0,
    color: navy,
    fontSize: 'clamp(1.7rem, 6vw, 2.5rem)',
    lineHeight: 1.08,
    letterSpacing: '-0.04em',
    fontWeight: 900,
  },
  cardIntro: {
    color: 'var(--ft-text-tertiary)',
    fontSize: '0.98rem',
    lineHeight: 1.65,
    margin: '12px 0 0',
    maxWidth: 650,
  },
  slideDots: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: 'rgba(27,79,138,0.18)',
  },
  dotActive: {
    width: 22,
    background: `linear-gradient(90deg, ${teal}, ${blue})`,
  },
  rule: {
    width: 92,
    height: 5,
    borderRadius: 999,
    background: `linear-gradient(90deg, ${teal}, ${blue})`,
    margin: '20px 0 26px',
  },
  sectionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 18,
  },
  section: {
    border: '1px solid rgba(27,79,138,0.10)',
    borderRadius: 12,
    padding: '18px 18px 17px',
    background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)',
  },
  sectionLabel: {
    color: teal,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bodyText: {
    margin: 0,
    color: '#243247',
    fontSize: '0.96rem',
    lineHeight: 1.72,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 24,
    paddingTop: 18,
    borderTop: '1px solid rgba(27,79,138,0.10)',
  },
  controlButton: {
    minHeight: 44,
    border: '1px solid rgba(13,148,136,0.25)',
    borderRadius: 999,
    background: `linear-gradient(135deg, ${teal}, ${blue})`,
    color: white,
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 900,
    boxShadow: '0 14px 30px rgba(13,148,136,0.22)',
  },
  controlStatus: {
    color: 'var(--ft-text-tertiary)',
    fontSize: 13,
    fontWeight: 850,
    letterSpacing: '0.08em',
  },
  footer: {
    minHeight: 38,
    background: navy,
    color: white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 18px calc(env(safe-area-inset-bottom, 0px) + 9px)',
    fontSize: 12,
    letterSpacing: '0.04em',
    textAlign: 'center',
  },
}
