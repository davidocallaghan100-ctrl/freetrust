'use client'

import { BUILD_SECTIONS, ON_DEMAND_SECTION_COST, type SectionKey } from '@/lib/build/spec'

export interface SectionRecord {
  section_key: string
  content: string
  cost_spent?: number
  generated_at?: string
}

interface BuildSectionsProps {
  sections: SectionRecord[]
  activeKey: SectionKey
  onSelect: (key: SectionKey) => void
  onGenerate: (key: SectionKey) => void
  generatingKey: SectionKey | null
  disabled: boolean
}

export default function BuildSections({ sections, activeKey, onSelect, onGenerate, generatingKey, disabled }: BuildSectionsProps) {
  const byKey = new Map(sections.map(s => [s.section_key, s]))
  const active = BUILD_SECTIONS.find(s => s.key === activeKey)
  const activeRecord = byKey.get(activeKey)

  return (
    <div style={{ borderTop: '1px solid #1c3548', background: '#0a1420' }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 14px', borderBottom: '1px solid #1c3548' }}>
        {BUILD_SECTIONS.map(s => {
          const hasContent = !!byKey.get(s.key)?.content
          const isActive = s.key === activeKey
          return (
            <button
              key={s.key}
              onClick={() => onSelect(s.key)}
              style={{
                flexShrink: 0, fontSize: 11, padding: '6px 11px', borderRadius: 999, whiteSpace: 'nowrap',
                border: `1px solid ${isActive ? '#2dd4bf' : '#1c3548'}`,
                color: isActive ? '#2dd4bf' : (hasContent ? '#e6f1f5' : '#8ca7b5'),
                background: isActive ? '#134e4a' : '#0e1f2e',
                cursor: 'pointer',
              }}
            >
              {s.icon} {s.label}{!s.core && !hasContent ? ` · ${ON_DEMAND_SECTION_COST} TC` : ''}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '14px 16px', minHeight: 90, maxHeight: 260, overflowY: 'auto' }}>
        {!active ? null : activeRecord?.content ? (
          <div>
            <div style={{ fontSize: 12, color: '#2dd4bf', fontWeight: 600, marginBottom: 6 }}>{active.icon} {active.label}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e6f1f5', whiteSpace: 'pre-wrap' }}>{activeRecord.content}</div>
            {!active.core && (
              <button
                onClick={() => onGenerate(active.key)}
                disabled={disabled || generatingKey === active.key}
                style={{
                  marginTop: 10, fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '6px 11px',
                  border: '1px solid #1c3548', background: '#0e1f2e', color: '#8ca7b5',
                  cursor: disabled ? 'default' : 'pointer',
                }}
              >
                {generatingKey === active.key ? 'Regenerating…' : `↻ Regenerate — ${ON_DEMAND_SECTION_COST} TC`}
              </button>
            )}
          </div>
        ) : active.core ? (
          <div style={{ fontSize: 12.5, color: '#8ca7b5' }}>
            This section fills in automatically the first time you generate a design above.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: '#8ca7b5', marginBottom: 10 }}>{active.description}</div>
            <button
              onClick={() => onGenerate(active.key)}
              disabled={disabled || generatingKey === active.key}
              style={{
                fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '9px 14px',
                border: '1px solid #f4c451', background: 'rgba(244,196,81,0.08)', color: '#f4c451',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              {generatingKey === active.key ? 'Generating…' : `✨ Generate — ${ON_DEMAND_SECTION_COST} TC`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
