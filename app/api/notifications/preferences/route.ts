export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications/preferences — get user notification preferences
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet — return defaults
        return NextResponse.json({
          preferences: {
            messages: true,
            orders: true,
            trust: true,
            reviews: true,
            gig_liked: true,
            system: true,
            email_digest: false,
          }
        })
      }
      if (error.code === 'PGRST116') {
        // No row — return defaults
        return NextResponse.json({
          preferences: {
            messages: true,
            orders: true,
            trust: true,
            reviews: true,
            gig_liked: true,
            system: true,
            email_digest: false,
          }
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ preferences: data })
  } catch (err) {
    console.error('GET /api/notifications/preferences error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/notifications/preferences — upsert notification preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      messages,
      orders,
      trust,
      reviews,
      gig_liked,
      system,
      email_digest,
    } = body

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        messages: messages ?? true,
        orders: orders ?? true,
        trust: trust ?? true,
        reviews: reviews ?? true,
        gig_liked: gig_liked ?? true,
        system: system ?? true,
        email_digest: email_digest ?? false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PUT /api/notifications/preferences error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
