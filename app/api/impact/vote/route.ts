export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  // Return vote tallies for current quarter
  try {
    const supabase = await createClient()
    const now = new Date()
    const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`

    const { data } = await supabase
      .from('impact_cause_votes')
      .select('cause_id')
      .eq('quarter', quarter)

    const tallies: Record<string, number> = {}
    for (const row of data ?? []) {
      tallies[row.cause_id] = (tallies[row.cause_id] ?? 0) + 1
    }

    // Get current user's vote if logged in
    const { data: { user } } = await supabase.auth.getUser()
    let myVote: string | null = null
    if (user) {
      const { data: myRow } = await supabase
        .from('impact_cause_votes')
        .select('cause_id')
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .maybeSingle()
      myVote = myRow?.cause_id ?? null
    }

    return NextResponse.json({ tallies, myVote, quarter })
  } catch (err) {
    console.error('[GET /api/impact/vote]', err)
    return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cause_id } = await req.json()
    if (!cause_id) return NextResponse.json({ error: 'Missing cause_id' }, { status: 400 })

    const now = new Date()
    const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`

    const { error } = await supabase.from('impact_cause_votes').insert({
      user_id: user.id,
      cause_id,
      quarter,
    })

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Already voted this quarter' }, { status: 409 })
    }
    if (error) throw error

    return NextResponse.json({ ok: true, quarter })
  } catch (err) {
    console.error('[POST /api/impact/vote]', err)
    return NextResponse.json({ error: 'Vote failed' }, { status: 500 })
  }
}
