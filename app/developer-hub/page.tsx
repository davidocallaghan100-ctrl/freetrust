import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DeveloperHubClient from './DeveloperHubClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Developer & AI Agent Hub',
  description: 'Manage FreeTrust developer apps, read-only API keys, and marketplace API access.',
  robots: { index: false, follow: false },
}

export default async function DeveloperHubPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?redirect=%2Fdeveloper-hub')
  return <DeveloperHubClient />
}
