import {defineRouting} from 'next-intl/routing'

export const locales = ['en','ga','fr','de','es','it','pt','pl','nl','sv','ro','uk','ar','zh','ja','ko','hi','tr','ru','cs'] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'en'

export const rtlLocales: AppLocale[] = ['ar']

export const localeNames: Record<AppLocale, { flag: string; nativeName: string; englishName: string }> = {
  en: { flag: '🇺🇸', nativeName: 'English', englishName: 'English' },
  ga: { flag: '🇮🇪', nativeName: 'Gaeilge', englishName: 'Irish' },
  fr: { flag: '🇫🇷', nativeName: 'Français', englishName: 'French' },
  de: { flag: '🇩🇪', nativeName: 'Deutsch', englishName: 'German' },
  es: { flag: '🇪🇸', nativeName: 'Español', englishName: 'Spanish' },
  it: { flag: '🇮🇹', nativeName: 'Italiano', englishName: 'Italian' },
  pt: { flag: '🇵🇹', nativeName: 'Português', englishName: 'Portuguese' },
  pl: { flag: '🇵🇱', nativeName: 'Polski', englishName: 'Polish' },
  nl: { flag: '🇳🇱', nativeName: 'Nederlands', englishName: 'Dutch' },
  sv: { flag: '🇸🇪', nativeName: 'Svenska', englishName: 'Swedish' },
  ro: { flag: '🇷🇴', nativeName: 'Română', englishName: 'Romanian' },
  uk: { flag: '🇺🇦', nativeName: 'Українська', englishName: 'Ukrainian' },
  ar: { flag: '🇦🇪', nativeName: 'العربية', englishName: 'Arabic' },
  zh: { flag: '🇨🇳', nativeName: '简体中文', englishName: 'Chinese (Simplified)' },
  ja: { flag: '🇯🇵', nativeName: '日本語', englishName: 'Japanese' },
  ko: { flag: '🇰🇷', nativeName: '한국어', englishName: 'Korean' },
  hi: { flag: '🇮🇳', nativeName: 'हिन्दी', englishName: 'Hindi' },
  tr: { flag: '🇹🇷', nativeName: 'Türkçe', englishName: 'Turkish' },
  ru: { flag: '🇷🇺', nativeName: 'Русский', englishName: 'Russian' },
  cs: { flag: '🇨🇿', nativeName: 'Čeština', englishName: 'Czech' },
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Phase 1 keeps existing production URLs stable. The locale is stored in
  // NEXT_LOCALE/localStorage and the shell refreshes immediately on selection.
  localePrefix: 'never',
  localeCookie: {
    name: 'NEXT_LOCALE',
    sameSite: 'lax',
  },
})

export function isAppLocale(locale: string | null | undefined): locale is AppLocale {
  return Boolean(locale && (locales as readonly string[]).includes(locale))
}

export function directionForLocale(locale: string | null | undefined): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
