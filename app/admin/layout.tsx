import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFreeTrustAdminEmail } from '@/lib/admin/emails'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || !isFreeTrustAdminEmail(user.email)) {
    redirect('/')
  }

  return <>{children}</>
}
