export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, count, error } = await supabase
      .from('organisation_followers')
      .select(
        'user_id, created_at, profile:profiles!user_id(id, full_name, avatar_url, username, trust_balance)',
        { count: 'exact' }
      )
      .eq('organisation_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[GET /api/organisations/[id]/followers]', error)
      return NextResponse.json({ followers: [], count: 0 })
    }

    const followers = (data ?? [])
      .map((r: Record<string, unknown>) => r.profile)
      .filter(Boolean)

    return NextResponse.json({ followers, count: count ?? 0 })
  } catch (err) {
    console.error('[GET /api/organisations/[id]/followers] unexpected:', err)
    return NextResponse.json({ followers: [], count: 0 })
  }
}
