import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project_id, amount } = await req.json()
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (!project_id) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })
    }

    // Check sufficient trust
    const { data: balData } = await supabase
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const currentBalance = balData?.balance ?? 0
    if (currentBalance < amount) {
      return NextResponse.json({ error: 'Insufficient trust balance' }, { status: 400 })
    }

    // Deduct from trust via ledger
    const { error: trustErr } = await supabase.rpc('issue_trust', {
      p_user_id: user.id,
      p_amount: -Math.floor(amount),
      p_type: 'impact_donation',
      p_ref: null,
      p_desc: `₮${amount} donated to impact project`,
    })
    if (trustErr) throw trustErr

    // Record in impact_donations
    const { error: donateErr } = await supabase.from('impact_donations').insert({
      user_id: user.id,
      project_id,
      amount,
    })
    if (donateErr) throw donateErr

    // Update project raised + backers
    const { data: proj } = await supabase
      .from('impact_projects')
      .select('raised, backers')
      .eq('id', project_id)
      .maybeSingle()

    if (proj) {
      await supabase
        .from('impact_projects')
        .update({
          raised: Number(proj.raised) + amount,
          backers: (proj.backers ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project_id)
    }

    // Send notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'impact',
      title: '🌱 Donation confirmed!',
      body: `₮${amount} donated to impact. Every ₮10 = 1 tree planted.`,
      link: '/impact',
    })

    return NextResponse.json({
      ok: true,
      new_balance: currentBalance - amount,
      trees_equivalent: Math.floor(amount / 10),
    })
  } catch (err) {
    console.error('[POST /api/impact/donate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
