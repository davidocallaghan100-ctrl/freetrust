'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setQuery('')
  }

  return (
    <div style={{
      position: 'fixed',
      top: '58px',
      left: 0,
      right: 0,
      background: '#0a0f1e',
      borderBottom: '1px solid #1e293b',
      zIndex: 90,
      padding: '8px 16px',
    }}>
      <form onSubmit={handleSearch} style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '14px',
            color: '#64748b',
            pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search FreeTrust…"
            style={{
              width: '100%',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '8px 14px 8px 36px',
              fontSize: '14px',
              color: '#f1f5f9',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = '#38bdf8')}
            onBlur={e => (e.target.style.borderColor = '#334155')}
          />
        </div>
      </form>
    </div>
  )
}
