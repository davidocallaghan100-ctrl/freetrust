import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = supabaseUrl && serviceRoleKey
  ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null

export async function POST(req: NextRequest) {
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => null) as {
    serviceListingId?: string
    providerName?: string
    providerUrl?: string | null
    category?: string
    enquiryMessage?: string
    source?: 'external' | 'community' | 'awin'
  } | null

  const message = body?.enquiryMessage?.trim() || ''
  if (!body?.serviceListingId || !body.providerName || !body.category || !message) {
    return NextResponse.json({ error: 'Missing enquiry details' }, { status: 400 })
  }

  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { error: insertError } = await admin
    .from('service_enquiry_leads')
    .insert({
      user_id: user?.id || null,
      service_listing_id: body.serviceListingId,
      provider_name: body.providerName,
      provider_url: body.providerUrl || null,
      category: body.category,
      enquiry_message: message,
      source: body.source || 'external',
      status: 'submitted',
    })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const { data: current, error: readError } = await admin
    .from('external_service_listings')
    .select('lead_count')
    .eq('id', body.serviceListingId)
    .single()

  if (!readError) {
    await admin
      .from('external_service_listings')
      .update({ lead_count: Number(current?.lead_count ?? 0) + 1 })
      .eq('id', body.serviceListingId)
  }

  return NextResponse.json({ success: true })
}
