import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import Nav from "@/components/Nav";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import SearchBar from "@/components/SearchBar";

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

const BASE_URL = 'https://freetrust.vercel.app'

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
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'FreeTrust' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreeTrust – Trust-Based Social Commerce',
    description: 'The platform where trust is the currency.',
    images: ['/og-default.png'],
    creator: '@freetrust',
  },
  alternates: { canonical: BASE_URL },
  icons: {
    icon: '/favicon.ico',
  },
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
        {/* Top bar — 58px fixed */}
        <Nav />

        {/* Search bar — below top nav, fixed */}
        <SearchBar />

        {/* Body: sidebar + main content */}
        <div style={{ display: 'flex' }}>
          {/* Left sidebar — desktop only (hidden on mobile via CSS) */}
          <Sidebar />

          {/* Main content area */}
          <main className="ft-page-content">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav — shown only on mobile via CSS */}
        <BottomNav />

        {/* Floating + button — desktop only, bottom right */}
        <style>{`
          @media (max-width: 768px) { .ft-fab { display: none !important; } }
        `}</style>
        <Link
          href="/create"
          className="ft-fab"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(56,189,248,0.45)',
            zIndex: 90,
            lineHeight: 1,
          }}
          aria-label="Create"
        >
          +
        </Link>
      </body>
    </html>
  );
}
