import type { CSSProperties } from 'react'

export type ProfileVerificationStatus = 'unverified' | 'submitted' | 'verified' | 'rejected' | string | null | undefined

type Props = {
  status?: ProfileVerificationStatus
  size?: 'sm' | 'md'
  showLabel?: boolean
  style?: CSSProperties
}

export function isProfileVerified(status?: ProfileVerificationStatus) {
  return status === 'verified'
}

export default function VerifiedBadge({ status, size = 'sm', showLabel = false, style }: Props) {
  if (!isProfileVerified(status)) return null

  const isMd = size === 'md'
  return (
    <span
      title="FreeTrust verified profile"
      aria-label="FreeTrust verified profile"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showLabel ? 5 : 0,
        minWidth: isMd ? 22 : 18,
        minHeight: isMd ? 22 : 18,
        borderRadius: 999,
        padding: showLabel ? (isMd ? '0.2rem 0.55rem' : '0.12rem 0.45rem') : 0,
        justifyContent: 'center',
        background: 'linear-gradient(135deg,var(--ft-accent),#34d399)',
        color: '#020617',
        fontSize: isMd ? '0.78rem' : '0.68rem',
        fontWeight: 900,
        lineHeight: 1,
        boxShadow: '0 0 0 2px rgba(56,189,248,0.12)',
        flexShrink: 0,
        ...style,
      }}
    >
      ✓{showLabel && <span style={{ fontWeight: 800 }}>Verified</span>}
    </span>
  )
}
