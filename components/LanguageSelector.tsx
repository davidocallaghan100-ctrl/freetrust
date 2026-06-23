'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
import {type AppLocale, defaultLocale, directionForLocale, isAppLocale, localeNames, locales} from '@/i18n/routing'

type LanguageSelectorProps = {
  variant?: 'header' | 'floating'
}

const STORAGE_KEY = 'freetrust_locale'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function useViewportWidth() {
  const [width, setWidth] = useState<number>(() => (typeof window === 'undefined' ? 1024 : window.innerWidth))
  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
}

export default function LanguageSelector({variant = 'header'}: LanguageSelectorProps) {
  const router = useRouter()
  const activeLocale = useLocale()
  const t = useTranslations('language')
  const width = useViewportWidth()
  const isMobile = width < 768
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const locale = isAppLocale(activeLocale) ? activeLocale : defaultLocale
  const current = localeNames[locale]
  const floating = variant === 'floating'

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (isAppLocale(saved) && saved !== locale) {
        document.cookie = `NEXT_LOCALE=${saved}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
        router.refresh()
      }
    } catch {
      // localStorage is progressive enhancement only.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const options = useMemo(() => locales.map(code => ({code, ...localeNames[code]})), [])

  async function syncAccountLocale(nextLocale: AppLocale) {
    try {
      const supabase = createClient()
      const {data: {user}} = await supabase.auth.getUser()
      if (!user) return
      const {error} = await supabase
        .from('user_preferences')
        .upsert({user_id: user.id, locale: nextLocale, updated_at: new Date().toISOString()}, {onConflict: 'user_id'})
      if (error) throw error
    } catch {
      setSyncError(true)
    }
  }

  async function selectLocale(nextLocale: AppLocale) {
    setSaving(true)
    setSyncError(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale)
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
      document.documentElement.lang = nextLocale
      document.documentElement.dir = directionForLocale(nextLocale)
      setOpen(false)
      void syncAccountLocale(nextLocale)
      router.refresh()
      window.setTimeout(() => {
        window.location.reload()
      }, 80)
    } finally {
      setSaving(false)
    }
  }

  if (floating && !isMobile) return null
  if (!floating && isMobile) return null

  const triggerLabel = `${current.flag} ${current.nativeName}`
  const mobileTriggerText = 'Translate'

  return (
    <div
      ref={containerRef}
      style={floating ? {
        position: 'fixed',
        top: '112px',
        right: 0,
        zIndex: 101,
      } : {
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={t('selectorLabel')}
        aria-expanded={open}
        style={{
          minWidth: floating ? 116 : 118,
          height: floating ? 42 : 34,
          borderRadius: floating ? '12px 0 0 12px' : 999,
          border: '1px solid rgba(56,189,248,0.28)',
          background: floating ? 'rgba(15,23,42,0.88)' : 'rgba(15,23,42,0.72)',
          color: '#e0f2fe',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: floating ? 8 : 7,
          padding: floating ? '0 12px' : '0 10px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontWeight: 800,
          fontSize: floating ? 13 : 12,
          boxShadow: floating ? '0 12px 30px rgba(2,6,23,0.48), 0 0 18px rgba(56,189,248,0.16)' : 'none',
          backdropFilter: 'blur(12px)',
        }}
      >
        <span aria-hidden="true" style={{fontSize: floating ? 17 : undefined}}>{floating ? '🌐' : current.flag}</span>
        {floating && <span>{mobileTriggerText}</span>}
        {floating && <span aria-hidden="true" style={{fontSize: 15}}>{current.flag}</span>}
        {!floating && <span>{current.nativeName}</span>}
        {!floating && <span style={{color: '#64748b', fontSize: 10}}>▾</span>}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('selectorLabel')}
          style={floating ? {
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 78,
            maxHeight: 'min(68vh, 560px)',
            overflowY: 'auto',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
            border: '1px solid rgba(56,189,248,0.26)',
            borderRadius: 22,
            boxShadow: '0 28px 90px rgba(0,0,0,0.66)',
            padding: 10,
          } : {
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 244,
            maxHeight: 430,
            overflowY: 'auto',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 14,
            boxShadow: '0 16px 50px rgba(0,0,0,0.48)',
            padding: 8,
          }}
        >
          <div style={{padding: '8px 10px 10px', color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase'}}>
            {t('currentLanguage')}: {triggerLabel}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: floating ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 6}}>
            {options.map(option => {
              const active = option.code === locale
              return (
                <button
                  key={option.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  disabled={saving}
                  onClick={() => selectLocale(option.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    minHeight: 44,
                    borderRadius: 12,
                    border: active ? '1px solid rgba(56,189,248,0.45)' : '1px solid transparent',
                    background: active ? 'rgba(56,189,248,0.13)' : 'transparent',
                    color: active ? '#e0f2fe' : '#cbd5e1',
                    padding: '9px 10px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: active ? 800 : 650,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{fontSize: 18, lineHeight: 1}}>{option.flag}</span>
                  <span style={{minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{option.nativeName}</span>
                  {active && <span style={{color: '#38bdf8'}}>✓</span>}
                </button>
              )
            })}
          </div>
          {syncError && <p style={{margin: '9px 10px 2px', color: '#fbbf24', fontSize: 12, lineHeight: 1.4}}>{t('saveError')}</p>}
        </div>
      )}
    </div>
  )
}
