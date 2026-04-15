import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CurrencyProvider } from "@/context/CurrencyContext";
import AppShell from "@/components/AppShell";
import PWAInstallBanner from "@/components/PWAInstallBanner";

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

// Default site-wide metadata. Individual pages override the title,
// description, and OG tags as needed (see app/page.tsx for the
// landing-page-specific metadata and app/about/page.tsx for the
// about page). The title template places the page title ahead of
// " | FreeTrust" on every sub-page.
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "FreeTrust — Ireland's Community Economy Marketplace",
    template: '%s | FreeTrust',
  },
  description:
    "FreeTrust is Ireland's community economy marketplace for freelancers, small businesses, community organisers, and nonprofits. Earn TrustCoins (₮) for every contribution.",
  keywords: [
    'FreeTrust',
    'community marketplace',
    'TrustCoins',
    'Ireland',
    'freelancers',
    'services',
    'jobs',
    'events',
    'communities',
    'nonprofits',
    'sustainability fund',
    'social commerce',
  ],
  authors: [{ name: 'FreeTrust' }],
  creator: 'FreeTrust',
  publisher: 'FreeTrust',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IE',
    url: BASE_URL,
    siteName: 'FreeTrust',
    title: "FreeTrust — Ireland's Community Economy Marketplace",
    description:
      'Buy, sell, hire, and collaborate. Earn TrustCoins (₮) for every contribution — lower fees, better visibility, support community impact.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "FreeTrust — Ireland's Community Economy Marketplace" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "FreeTrust — Ireland's Community Economy Marketplace",
    description:
      'Earn TrustCoins (₮) for every contribution. Ireland\'s community economy marketplace.',
    images: [OG_IMAGE],
    creator: '@freetrust',
  },
  alternates: { canonical: BASE_URL },

  // ── PWA metadata ────────────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FreeTrust',
  },
  // Next.js auto-serves app/icon.png and app/apple-icon.png. These extra
  // entries add the PWA-specific sizes served dynamically via next/og at
  // app/icons/icon-*.png/route.tsx so the manifest can reference them.
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
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}',{page_path:window.location.pathname});` }} />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: '#0f172a', minHeight: '100vh', color: '#f1f5f9' }}
      >
        <CurrencyProvider>
          <AppShell>
            {children}
          </AppShell>
          <PWAInstallBanner />
        </CurrencyProvider>
      </body>
    </html>
  );
}
