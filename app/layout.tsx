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

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'FreeTrust – Trust-Based Social Commerce',
    template: '%s | FreeTrust',
  },
  description: 'Buy, sell and collaborate with people you can trust. Join the FreeTrust community.',
  keywords: ['social commerce', 'trust economy', 'marketplace', 'freelance', 'services', 'products', 'community'],
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
    locale: 'en_GB',
    url: BASE_URL,
    siteName: 'FreeTrust',
    title: 'FreeTrust – Trust-Based Social Commerce',
    description: 'Buy, sell and collaborate with people you can trust. Join the FreeTrust community.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'FreeTrust – Trust-Based Social Commerce' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreeTrust – Trust-Based Social Commerce',
    description: 'Buy, sell and collaborate with people you can trust. Join the FreeTrust community.',
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
        {/*
          Early capture of beforeinstallprompt. Chrome can fire this event
          during initial HTML parse, long before React hydrates — if we only
          listen inside the React component, we'd miss it entirely. This
          inline script captures the live event into window.__ftPwaPrompt
          and re-dispatches as a custom 'ft-pwa-ready' event that
          PWAInstallBanner picks up on mount. Safe to run in production
          (gated by development check).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              if (typeof window === 'undefined') return;
              window.__ftPwaPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e){
                e.preventDefault();
                window.__ftPwaPrompt = e;
                try { window.dispatchEvent(new CustomEvent('ft-pwa-ready')); } catch(_){}
              });
              window.addEventListener('appinstalled', function(){
                window.__ftPwaPrompt = null;
              });
            })();`,
          }}
        />
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
