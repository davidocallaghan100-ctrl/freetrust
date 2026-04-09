export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

// POST /api/communities/[slug]/join — join a community
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get community
    const { data: community, error: commErr } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .single()

    if (commErr || !community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    // Check already a member
    const { data: existingMember } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 })
    }

    // Free community: join directly
    if (!community.is_paid || community.price_monthly === 0) {
      const { error: joinError } = await supabase.from('community_members').insert({
        community_id: community.id,
        user_id: user.id,
        role: 'member',
        tier: 'free',
      })

      if (joinError) {
        console.error('[POST join]', joinError)
        return NextResponse.json({ error: joinError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // Paid community: create Stripe subscription checkout
    if (!stripe) {
      return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const platformFeeRate = 0.05 // 5% FreeTrust fee
    const amountInCents = Math.round(community.price_monthly * 100)
    const platformFee = Math.round(amountInCents * platformFeeRate)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: profile?.email ?? user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `${community.name} — Membership`,
              metadata: { community_id: community.id, community_slug: slug },
            },
            unit_amount: amountInCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'community_membership',
        community_id: community.id,
        community_slug: slug,
        user_id: user.id,
        platform_fee_rate: String(platformFeeRate),
      },
      subscription_data: {
        metadata: {
          community_id: community.id,
          user_id: user.id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/community/${slug}?joined=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/community/${slug}`,
    })

    // Platform fee is recorded by the Stripe webhook (checkout.session.completed)
    // after payment is confirmed — not here to avoid recording before payment succeeds.

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (err) {
    console.error('[POST /api/communities/[slug]/join]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/communities/[slug]/join — leave community
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: community } = await supabase
      .from('communities')
      .select('id, owner_id')
      .eq('slug', slug)
      .single()

    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Owners cannot leave their own community
    if (community.owner_id === user.id) {
      return NextResponse.json({ error: 'Owners cannot leave their own community. Transfer ownership or delete the community first.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', community.id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/communities/[slug]/join]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
