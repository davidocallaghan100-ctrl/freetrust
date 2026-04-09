export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') // 'buyer' | 'seller' | null (both)
    const status = searchParams.get('status')

    let query = supabase
      .from('orders')
      .select(`
        *,
        buyer:buyer_id(id, email, raw_user_meta_data),
        seller:seller_id(id, email, raw_user_meta_data)
      `)
      .order('created_at', { ascending: false })

    if (role === 'buyer') {
      query = query.eq('buyer_id', user.id)
    } else if (role === 'seller') {
      query = query.eq('seller_id', user.id)
    } else {
      // Return both buying and selling orders
      query = query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) {
      // If table doesn't exist yet, return empty
      if (error.code === '42P01') {
        return NextResponse.json({ orders: [] })
      }
      console.error('[Orders GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (err) {
    console.error('[Orders GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
