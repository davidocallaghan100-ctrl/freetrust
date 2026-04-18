export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSequenceForIcp } from '@/lib/outbound/sequences'

// POST /api/outbound/enroll
// Enrolls a lead into the outbound email sequence for their ICP.
// Idempotent — if lead already enrolled, returns 409.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, first_name, last_name, business_name, icp_category, source, notes } = body

    if (!email || !icp_category) {
      return NextResponse.json({ error: 'email and icp_category are required' }, { status: 400 })
    }

    // Validate ICP has a sequence
    const sequence = getSequenceForIcp(icp_category)
    if (!sequence) {
      return NextResponse.json({ error: `Unknown ICP category: ${icp_category}` }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check for existing lead
    const { data: existing } = await admin
      .from('outbound_leads')
      .select('id, status, sequence_step')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { message: 'Lead already enrolled', lead: existing },
        { status: 409 }
      )
    }

    // Insert new lead with status 'enrolled'
    const { data: lead, error } = await admin
      .from('outbound_leads')
      .insert({
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        business_name: business_name || null,
        icp_category,
        source: source || 'manual',
        status: 'enrolled',
        sequence_step: 0,
        enrolled_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      // Handle duplicate email race condition
      if (error.code === '23505') {
        return NextResponse.json({ message: 'Lead already enrolled' }, { status: 409 })
      }
      console.error('[/api/outbound/enroll] DB error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead }, { status: 201 })
  } catch (err) {
    console.error('[/api/outbound/enroll] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
