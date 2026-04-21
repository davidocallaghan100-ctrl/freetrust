'use client'
import React, { useState } from 'react'

interface CompanyLogoProps {
  src: string | null | undefined
  companyName: string
  size?: number
  borderRadius?: number
  isLocal?: boolean
}

/**
 * Smart company logo with 3-tier fallback:
 *  1. Provided src URL (Remotive redirect or Supabase storage)
 *  2. logo.dev CDN (free, no auth needed) — derived from company name
 *  3. Letter avatar (initials, gradient background)
 */
export default function CompanyLogo({ src, companyName, size = 36, borderRadius = 8, isLocal = false }: CompanyLogoProps) {
  const initials = companyName
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Derive a domain guess for logo.dev fallback
  // e.g. "Digital Builders GmbH" → "digitalbuilders.com" (best effort)
  const domainGuess = companyName
    .toLowerCase()
    .replace(/\b(gmbh|inc|ltd|llc|corp|co|ag|sa|bv|plc|pty|srl|nv|as|ab|oy|se|spa|sas|kft|kk)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('')
  const logoDevUrl = `https://img.logo.dev/${domainGuess}.com?token=pk_X8dBNBa4TnuJSMNrMXKJXA&size=64&format=png`

  const [triedSrc, setTriedSrc] = useState(false)
  const [triedLogoDev, setTriedLogoDev] = useState(false)
  const [showFallback, setShowFallback] = useState(!src)

  const gradientBg = isLocal
    ? 'linear-gradient(135deg,#fb923c,#ea580c)'
    : 'linear-gradient(135deg,#38bdf8,#0284c7)'

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  }

  const FallbackAvatar = () => (
    <div style={{
      ...containerStyle,
      background: gradientBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: size * 0.38,
      color: '#0f172a',
    }}>
      {initials}
    </div>
  )

  if (showFallback) return <FallbackAvatar />

  const currentSrc = !triedSrc && src ? src : (!triedLogoDev ? logoDevUrl : null)

  if (!currentSrc) return <FallbackAvatar />

  return (
    <div style={containerStyle}>
      <img
        src={currentSrc}
        alt={companyName}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#fff',
          padding: 3,
        }}
        onError={() => {
          if (!triedSrc && src && currentSrc === src) {
            setTriedSrc(true)
          } else if (!triedLogoDev && currentSrc === logoDevUrl) {
            setTriedLogoDev(true)
            setShowFallback(true)
          } else {
            setShowFallback(true)
          }
        }}
      />
    </div>
  )
}
