import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/stripe/connect — stub: return Stripe Connect onboarding URL
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Implement real Stripe Connect onboarding
    // This is a placeholder URL
    return NextResponse.json({ url: 'https://stripe.com/connect' })
  } catch (err) {
    console.error('[GET /api/stripe/connect] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
