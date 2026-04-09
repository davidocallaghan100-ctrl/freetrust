'use client'

interface AvatarProps {
  url?: string | null
  name?: string | null
  email?: string | null
  size?: number
  className?: string
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

export default function Avatar({ url, name, email, size = 40, className }: AvatarProps) {
  const initials = getInitials(name, email)
  const fontSize = Math.max(10, Math.round(size * 0.35))

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? email ?? 'avatar'}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    )
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
