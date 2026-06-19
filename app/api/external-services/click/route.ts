import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => null) as { serviceId?: string } | null
  if (!body?.serviceId) {
    return NextResponse.json({ error: 'Missing service id' }, { status: 400 })
  }

  const { data: current, error: readError } = await supabase
    .from('external_service_listings')
    .select('click_count')
    .eq('id', body.serviceId)
    .single()

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

  const { error: updateError } = await supabase
    .from('external_service_listings')
    .update({ click_count: Number(current?.click_count ?? 0) + 1 })
    .eq('id', body.serviceId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
