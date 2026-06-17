import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripFreetrustReferralParams } from '@/lib/skimlinks'

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

  const body = await req.json().catch(() => null) as {
    productId?: string
    userId?: string | null
    category?: string
    title?: string
    retailerName?: string
    retailerUrl?: string
    affiliateLinkGenerated?: boolean
    clickSource?: 'grid' | 'modal' | 'basket' | 'find_online'
    searchQuery?: string
  } | null

  if (!body?.productId || !body.title || !body.retailerName || !body.retailerUrl) {
    return NextResponse.json({ error: 'Missing product click details' }, { status: 400 })
  }

  const { data: current, error: readError } = await supabase
    .from('external_product_listings')
    .select('click_count')
    .eq('id', body.productId)
    .single()

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('external_product_listings')
    .update({ click_count: Number(current?.click_count ?? 0) + 1 })
    .eq('id', body.productId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const cleanRetailerUrl = stripFreetrustReferralParams(body.retailerUrl)

  const { error: insertError } = await supabase
    .from('external_product_clicks')
    .insert({
      user_id: body.userId || null,
      search_query: body.searchQuery || `category:${body.category || 'external'}`,
      product_title: body.title,
      retailer_name: body.retailerName,
      product_url: cleanRetailerUrl,
      affiliate_link_generated: Boolean(body.affiliateLinkGenerated),
      click_source: body.clickSource || 'grid',
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
