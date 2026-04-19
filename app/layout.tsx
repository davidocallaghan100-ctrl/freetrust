import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { CurrencyProvider } from "@/context/CurrencyContext";
import AppShell from "@/components/AppShell";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";

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

// Absolute URL to the OG image generated on demand by app/og-image.png/route.tsx
// (uses next/og under the hood — no binary file in the repo). The URL is the
// stable literal /og-image.png so deep-links from WhatsApp, Twitter, LinkedIn,
// Slack etc. all resolve cleanly.
const OG_IMAGE = `${BASE_URL}/og-image.png`

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
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'FreeTrust — The Community Economy Marketplace' }],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="copyright" content="FreeTrust 2026" />
        <meta name="author" content="FreeTrust" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: '#0f172a', minHeight: '100vh', color: '#f1f5f9' }}
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

        <CurrencyProvider>
          <AppShell>
            {children}
          </AppShell>
          <PWAInstallBanner />
        </CurrencyProvider>

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
