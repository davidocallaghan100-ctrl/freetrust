import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

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

export const metadata: Metadata = {
  title: "FreeTrust – Trust-Based Social Commerce",
  description: "FreeTrust is the platform where trust is the currency. Buy, sell, connect, and grow with verified community members.",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: '#0f172a', minHeight: '100vh', color: '#f1f5f9' }}
      >
        {/* Top bar — sticky, full width */}
        <Nav />

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
      </body>
    </html>
  );
}
