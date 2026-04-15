// Server component wrapper for the members directory.
// ────────────────────────────────────────────────────
// The interactive grid lives in components/members/MembersDirectoryClient.tsx
// because it uses React state, fetches, and event handlers. This file
// is the server-side entry point that:
//
//   1. Exports the route segment config — `dynamic = 'force-dynamic'`
//      and `revalidate = 0` — so Next.js never pre-renders the page
//      to static HTML and never serves a stale snapshot. Both
//      exports MUST live on a server component file; placing them on
//      a 'use client' page produces "Invalid revalidate value" at
//      build time.
//
//   2. Exports a static metadata block so the directory has an
//      accurate <title> + description for SEO and link previews
//      without depending on the client component to set them.
//
//   3. Mounts <MembersDirectoryClient /> for the actual UI.

import type { Metadata } from 'next'
import MembersDirectoryClient from '@/components/members/MembersDirectoryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Members Directory',
  description:
    'Browse every member of the FreeTrust community — freelancers, small businesses, community organisers, and nonprofits across Ireland and beyond.',
  alternates: { canonical: `${BASE_URL}/members` },
  openGraph: {
    title: 'FreeTrust Members Directory',
    description:
      'Connect with trusted founding members of the FreeTrust community.',
    url: `${BASE_URL}/members`,
    siteName: 'FreeTrust',
    type: 'website',
  },
}

export default function MembersDirectoryPage() {
  return <MembersDirectoryClient />
}
