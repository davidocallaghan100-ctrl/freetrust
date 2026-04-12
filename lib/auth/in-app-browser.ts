/**
 * In-app browser detection for Google OAuth.
 *
 * Google blocks OAuth inside embedded WebViews with
 *   Error 403: disallowed_useragent
 * as an anti-abuse policy. This affects Facebook, Instagram, Line, TikTok,
 * Twitter, WeChat, LinkedIn, Snapchat, and most other native apps that
 * open external links in their own WebView.
 *
 * No code change makes OAuth work inside these browsers — the fix is to
 * detect them and guide the user to open the site in their default
 * system browser instead.
 */

// Patterns for known in-app browser user-agent strings. Case-insensitive.
const IN_APP_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Facebook',  pattern: /\bFBAN\b|\bFBAV\b|\bFB_IAB\b|\bFBIOS\b/i },
  { name: 'Instagram', pattern: /\bInstagram\b/i },
  { name: 'Messenger', pattern: /\bMessenger\b/i },
  { name: 'Line',      pattern: /\bLine\//i },
  { name: 'TikTok',    pattern: /\bmusical_ly\b|\bBytedanceWebview\b|\bTikTok\b/i },
  { name: 'WeChat',    pattern: /\bMicroMessenger\b/i },
  { name: 'LinkedIn',  pattern: /\bLinkedInApp\b/i },
  { name: 'Twitter',   pattern: /\bTwitter(?:for)?(?:iPhone|Android)\b/i },
  { name: 'Snapchat',  pattern: /\bSnapchat\b/i },
  { name: 'Pinterest', pattern: /\bPinterest\b/i },
  { name: 'Reddit',    pattern: /\bReddit\b/i },
]

// Generic WebView markers — these catch a lot of lesser-known in-app
// browsers that don't have a unique marker but do use a WebView.
//   iOS:     iPhone/iPad UA without Safari token and without CriOS/FxiOS
//   Android: Android UA with wv token (WebView flag)
function isGenericWebView(ua: string): boolean {
  // Android WebView: "wv" token in the UA
  if (/\bwv\b/i.test(ua) && /android/i.test(ua)) return true

  // iOS WebView: has iPhone/iPad but no Safari and no known browser
  const isIosDevice = /iPhone|iPad|iPod/i.test(ua)
  if (isIosDevice) {
    const hasSafari = /Safari\//i.test(ua)
    const hasKnownBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
    if (!hasSafari && !hasKnownBrowser) return true
  }

  return false
}

export interface InAppBrowserInfo {
  isInApp: boolean
  browserName: string | null
  platform: 'ios' | 'android' | 'other'
}

export function detectInAppBrowser(ua?: string): InAppBrowserInfo {
  if (typeof window === 'undefined' && !ua) {
    return { isInApp: false, browserName: null, platform: 'other' }
  }
  const userAgent = ua ?? window.navigator.userAgent

  let browserName: string | null = null
  for (const { name, pattern } of IN_APP_PATTERNS) {
    if (pattern.test(userAgent)) {
      browserName = name
      break
    }
  }
  if (!browserName && isGenericWebView(userAgent)) {
    browserName = 'In-app browser'
  }

  const platform: 'ios' | 'android' | 'other' =
    /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' :
    /android/i.test(userAgent)          ? 'android' :
    'other'

  return {
    isInApp: !!browserName,
    browserName,
    platform,
  }
}

/**
 * Build a URL that tries to force-open the current page in the system
 * browser (Safari on iOS, Chrome on Android). Works in some in-app
 * browsers, ignored by others — but always worth trying as the first step.
 */
export function buildSystemBrowserUrl(currentUrl: string, platform: 'ios' | 'android' | 'other'): string | null {
  try {
    const url = new URL(currentUrl)
    if (platform === 'android') {
      // Chrome intent URI — opens the URL in Chrome if available,
      // otherwise the system default browser
      const host = url.host
      const path = url.pathname + url.search + url.hash
      return `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
    }
    if (platform === 'ios') {
      // x-safari-https:// forces Safari on iOS (Safari-only trick)
      return currentUrl.replace(/^https:/, 'x-safari-https:')
    }
    return null
  } catch {
    return null
  }
}
