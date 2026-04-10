import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CurrencyProvider } from "@/context/CurrencyContext";
import AppShell from "@/components/AppShell";

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

// Absolute URL to the Next.js-generated OG image (app/opengraph-image.tsx).
// Must be absolute so WhatsApp, Instagram, and other crawlers can fetch it.
const OG_IMAGE = `${BASE_URL}/opengraph-image`

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'FreeTrust – Trust-Based Social Commerce',
    template: '%s | FreeTrust',
  },
  description: 'FreeTrust is the platform where trust is the currency. Buy, sell, and connect with verified community members. Earn Trust points on every transaction.',
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
    description: 'The platform where trust is the currency. Buy, sell, and connect with verified community members.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'FreeTrust – Trust-Based Social Commerce' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreeTrust – Trust-Based Social Commerce',
    description: 'The platform where trust is the currency. Buy, sell, and connect with verified community members.',
    images: [OG_IMAGE],
    creator: '@freetrust',
  },
  alternates: { canonical: BASE_URL },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        </CurrencyProvider>
      </body>
    </html>
  );
}
