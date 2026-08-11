import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
// Globally load MapLibre styles so maps inside dynamic({ ssr:false })
// components always have canvas sizing rules available at mount.
// Without this, on mobile the stylesheet can arrive after the map
// initialises and the canvas ends up 0×0 inside a visible wrapper.
import "maplibre-gl/dist/maplibre-gl.css";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { BasketProvider } from "@/context/BasketContext";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/context/ThemeContext";
import AppShell from "@/components/AppShell";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";
import { defaultLocale, directionForLocale, isAppLocale } from "@/i18n/routing";

type Messages = Record<string, unknown>

function mergeMessages(fallback: Messages, override: Messages): Messages {
  const merged: Messages = { ...fallback }

  for (const [key, value] of Object.entries(override)) {
    const baseValue = fallback[key]
    merged[key] = baseValue && value && typeof baseValue === 'object' && typeof value === 'object' && !Array.isArray(baseValue) && !Array.isArray(value)
      ? mergeMessages(baseValue as Messages, value as Messages)
      : value
  }

  return merged
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

// Use the static app logo for share previews. Some mobile messengers are
// inconsistent with dynamic `next/og` image routes, but reliably fetch static
// PNG assets from /public. The versioned icon URL also busts stale preview
// caches when links are re-shared.
const OG_IMAGE = `${BASE_URL}/icons/freetrust-share-logo-20260524.png`

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'FreeTrust — The Community Economy Marketplace',
    template: '%s | FreeTrust',
  },
  description: 'FreeTrust is the community economy marketplace built around Trust Coin (₮). Buy, sell, find jobs, and build trust — member-owned, community-first.',
  keywords: [
    'community economy', 'trust coin', 'FreeTrust', 'community marketplace',
    'trust-based marketplace', 'freelance marketplace', 'community jobs board',
    'ethical marketplace', 'sustainable economy platform', 'member-owned marketplace',
    'alternative to Fiverr', 'alternative to Upwork', 'community-first marketplace',
  ],
  authors: [{ name: 'FreeTrust' }],
  creator: 'FreeTrust',
  publisher: 'FreeTrust',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'FreeTrust',
    title: 'FreeTrust — The Community Economy Marketplace',
    description: 'FreeTrust is the community economy marketplace built around Trust Coin (₮). Buy, sell, find jobs, and build trust — member-owned, community-first.',
    images: [{ url: OG_IMAGE, width: 512, height: 512, type: 'image/png', alt: 'FreeTrust logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreeTrust — The Community Economy Marketplace',
    description: 'FreeTrust is the community economy marketplace built around Trust Coin (₮). Buy, sell, find jobs, and build trust — member-owned, community-first.',
    images: [OG_IMAGE],
    creator: '@freetrust',
  },
  alternates: { canonical: BASE_URL },
  // Search console & Bing verification — set these env vars in Vercel
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
    other: {
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION ?? '',
    },
  },

  // ── PWA metadata ────────────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FreeTrust',
  },
  icons: {
    icon: [
      { url: '/icons/icon-16x16.png',  sizes: '16x16',   type: 'image/png' },
      { url: '/icons/icon-32x32.png',  sizes: '32x32',   type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#00b4d8',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localeCookie = cookies().get('NEXT_LOCALE')?.value
  const locale = isAppLocale(localeCookie) ? localeCookie : defaultLocale
  const dir = directionForLocale(locale)
  const defaultMessages = (await import(`../messages/${defaultLocale}.json`)).default as Messages
  const messages = locale === defaultLocale
    ? defaultMessages
    : mergeMessages(defaultMessages, (await import(`../messages/${locale}.json`)).default as Messages)

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <meta name="copyright" content="FreeTrust 2026" />
        <meta name="author" content="FreeTrust" />
        {/* Apply saved theme before hydration to avoid a light/dark flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: 'var(--ft-bg)', minHeight: '100vh', color: 'var(--ft-text)' }}
      >
        {/* Skip to main content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:text-white"
          style={{ background: '#38bdf8', color: '#0f172a' }}
        >
          Skip to content
        </a>

        {/* Structured data — global */}
        <OrganizationSchema />

        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <CurrencyProvider>
              <BasketProvider>
                <AppShell>
                  {children}
                </AppShell>
                <PWAInstallBanner />
              </BasketProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />

        {/* Google Analytics 4 — loaded after page is interactive */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}',{page_path:window.location.pathname});`}
            </Script>
          </>
        )}

      </body>
    </html>
  );
}
