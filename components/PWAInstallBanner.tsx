'use client'
import { useEffect, useState } from 'react'

// Minimal BeforeInstallPromptEvent shape — not in the standard DOM lib yet.
type BIP = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BIP | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BIP)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const result = await prompt.userChoice
    if (result.outcome === 'accepted') setShow(false)
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#00b4d8',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '999px',
        zIndex: 9999,
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ fontWeight: 600 }}>Install FreeTrust App</span>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          background: '#fff',
          color: '#00b4d8',
          border: 'none',
          borderRadius: '999px',
          padding: '6px 16px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Install
      </button>
      <button
        type="button"
        onClick={() => setShow(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '0 4px',
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
