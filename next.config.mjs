import nextPwa from 'next-pwa'

const withPWA = nextPwa({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Cache key pages for offline use. Runtime caching applies the first
  // time a user visits each page; subsequent visits work offline.
  runtimeCaching: [
    {
      // NEVER cache API routes — they have to hit the origin every time
      // so backfills, preference updates, new member signups, wallet
      // balance changes etc. are always fresh. Must be the first rule
      // so it matches before anything else.
      urlPattern: ({ url }) => {
        try {
          return new URL(url, 'http://x').pathname.startsWith('/api/')
        } catch {
          return false
        }
      },
      handler: 'NetworkOnly',
      method: 'GET',
    },
    {
      // Map tile requests must NEVER be intercepted by the service worker.
      // MapLibre GL JS fetches tiles from CartoDB (*.cartocdn.com) and the style
      // JSON from basemaps.cartocdn.com. If the SW caches or blocks these, the
      // map canvas stays black. This NetworkOnly rule must come BEFORE the
      // generic image caching rule below.
      urlPattern: /^https:\/\/[^/]*\.cartocdn\.com\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-images',
        expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 256, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // Core navigation targets — cache the HTML so the shell loads offline
      urlPattern: ({ url }) => {
        const pathname = new URL(url, 'http://x').pathname
        return ['/', '/feed', '/wallet', '/profile'].some(p => pathname === p || pathname.startsWith(`${p}/`))
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 32, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Body size limit — documented safety net for the HTTP 413 mobile
  // upload bug. NOTE: this `api.bodyParser` config only applies to
  // Pages Router routes under /pages/api/**. All our upload endpoints
  // are App Router route handlers (app/api/upload/media/route.ts etc),
  // which read the body via the Web Request API and do NOT consult this
  // config. More importantly, Vercel itself enforces a 4.5 MB request
  // body limit on Hobby plans at the edge, before any Next.js code runs
  // — so this setting cannot actually lift the real ceiling on our
  // deploy. The reliable fix is client-side image compression in
  // lib/image-compression.ts, which shrinks camera photos to ~2 MB
  // before they're sent. Keeping this block here as an intent marker
  // so future devs know we deliberately target ≤10 MB uploads.
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google OAuth avatars
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com', // Amazon product images
      },
    ],
  },

  // Hide Next.js version fingerprint
  poweredByHeader: false,

  async redirects() {
    return [
      {
        source: '/founder',
        destination: '/invest',
        permanent: true,
      },
      {
        source: '/founder/success',
        destination: '/invest/success',
        permanent: true,
      },
      {
        source: '/founder/:path*',
        destination: '/invest/:path*',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Block clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Legacy XSS filter
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer leakage control
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unnecessary browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
          // HSTS — force HTTPS for 2 years
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Content Security Policy — allows MapLibre GL JS, CartoDB dark-matter tiles, Supabase, etc.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // blob: in script-src is required for MapLibre GL JS web worker inline scripts
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
              // Allow all https images + blob — tile PNGs/WebP come from various CDN subdomains
              "img-src 'self' data: blob: https:",
              // blob: in connect-src needed for MapLibre tile worker blob URLs;
              // CartoDB hosts the dark-matter style JSON + vector/raster tiles
              "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.cartocdn.com https://basemaps.cartocdn.com https://unpkg.com",
              // Both worker-src and child-src needed for MapLibre GL web workers across browsers
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "frame-src 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withPWA(nextConfig)
