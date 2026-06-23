import {getRequestConfig} from 'next-intl/server'
import {defaultLocale, isAppLocale} from './routing'

type Messages = Record<string, unknown>

function mergeMessages(fallback: Messages, override: Messages): Messages {
  const merged: Messages = {...fallback}
  for (const [key, value] of Object.entries(override)) {
    const baseValue = fallback[key]
    merged[key] = baseValue && value && typeof baseValue === 'object' && typeof value === 'object' && !Array.isArray(baseValue) && !Array.isArray(value)
      ? mergeMessages(baseValue as Messages, value as Messages)
      : value
  }
  return merged
}

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale
  const locale = isAppLocale(requested) ? requested : defaultLocale

  return {
    locale,
    messages: locale === defaultLocale
      ? (await import(`../messages/${defaultLocale}.json`)).default
      : mergeMessages(
        (await import(`../messages/${defaultLocale}.json`)).default,
        (await import(`../messages/${locale}.json`)).default,
      ),
  }
})
