export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

// POST /api/profile/verification — submit current profile for manual review.
// Important: this intentionally never grants verified status. Public badges are
// keyed to is_verified / verified_at, which normal users cannot set here.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const method = cleanText(body?.method, 80) ?? 'profile_details'
    const notes = cleanText(body?.notes, 1000)
    const headline = cleanText(body?.professional_headline, 160)

    if (!notes && !headline) {
      return NextResponse.json({ error: 'Verification notes or headline required' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        verification_status: 'submitted',
        verification_details: {
          method,
          note: notes,
          submitted_via: 'profile_verification_endpoint',
          updated_at: new Date().toISOString(),
        },
        verification_submitted_at: new Date().toISOString(),
        ...(headline !== null ? { professional_headline: headline } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) {
      console.error('[POST /api/profile/verification]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[POST /api/profile/verification] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
