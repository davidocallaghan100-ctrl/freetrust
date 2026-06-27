import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FREETRUST_ADMIN_EMAILS, isFreeTrustAdminEmail } from '@/lib/admin/emails'

export const FREETRUST_ADMIN_EMAIL = FREETRUST_ADMIN_EMAILS[0]

export async function requireFreeTrustAdmin(): Promise<
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || !isFreeTrustAdminEmail(user.email)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, user }
}
