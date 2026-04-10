export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const LISTINGS = [
  {
    title: 'Bosch GSB 18V-55 Impact Drill',
    description: 'High-performance cordless impact drill in excellent condition. Comes with two 18V batteries, charger, and a full bit set in a carry case. Perfect for DIY projects, flat-pack assembly, and masonry work. Batteries hold charge well. Protective case included.',
    category: 'Tools',
    price_per_day: 8,
    price_per_week: 35,
    deposit: 50,
    location: 'Dublin 8',
    images: ['https://picsum.photos/seed/drill123/600/400'],
    available_from: '2026-04-10',
    available_to: '2026-12-31',
  },
  {
    title: 'Sony A7III Mirrorless Camera',
    description: 'Full-frame Sony A7III with 28-70mm kit lens. Ideal for events, weddings, portraits, or travel photography. In mint condition — rarely used. Comes with extra battery, 64GB SD card, and padded carry bag. Perfect for weekend shoots.',
    category: 'Electronics',
    price_per_day: 35,
    price_per_week: 160,
    deposit: 300,
    location: 'Cork City',
    images: ['https://picsum.photos/seed/camera456/600/400'],
    available_from: '2026-04-15',
    available_to: '2026-11-30',
  },
  {
    title: 'Electric Cargo Bike (Urban Arrow)',
    description: 'Urban Arrow family cargo e-bike with front cargo box. Fits two kids or large loads. Perfect for grocery runs, school trips, or event transport without a car. Pedal-assist up to 25km/h. Includes rain cover, child seat insert, and lock.',
    category: 'Vehicles',
    price_per_day: 25,
    price_per_week: 110,
    deposit: 100,
    location: 'Galway City',
    images: ['https://picsum.photos/seed/cargobike/600/400'],
    available_from: '2026-04-11',
    available_to: '2026-10-31',
  },
  {
    title: 'Three-Man Camping Tent (Vango Blade 300)',
    description: 'Lightweight three-season tent weighing only 1.9kg. Quick pitch design — up in 5 minutes. Used twice. Comes with ground sheet, pegs, and carry bag. Great for festivals, hillwalking trips, or family camping at campsites around Ireland.',
    category: 'Equipment',
    price_per_day: 12,
    price_per_week: 50,
    deposit: 40,
    location: 'Wicklow Town',
    images: ['https://picsum.photos/seed/tent789/600/400'],
    available_from: '2026-04-20',
    available_to: '2026-09-30',
  },
  {
    title: 'Karcher K5 Pressure Washer',
    description: 'Powerful 145 bar pressure washer with 10m hose. Excellent for cleaning driveways, patios, garden furniture, and cars. Full working condition. Includes patio cleaning attachment and vario spray lance. Perfect for a spring clean.',
    category: 'Tools',
    price_per_day: 18,
    price_per_week: 70,
    deposit: 60,
    location: 'Dublin 12',
    images: ['https://picsum.photos/seed/pressure/600/400'],
    available_from: '2026-04-12',
    available_to: '2026-11-01',
  },
  {
    title: 'Formal Suit (Dark Navy, 40R)',
    description: 'Dark navy two-piece formal suit, size 40 regular. From a premium tailor — worn once at a wedding. Dry cleaned and in perfect condition. Great for interviews, functions, graduations, and black tie events. Includes matching tie and pocket square.',
    category: 'Clothing',
    price_per_day: 25,
    price_per_week: 80,
    deposit: 50,
    location: 'Limerick City',
    images: ['https://picsum.photos/seed/formalsuit/600/400'],
    available_from: '2026-04-10',
    available_to: '2026-12-31',
  },
  {
    title: 'Kayak with Paddle & Life Jacket',
    description: 'Sit-on-top recreational kayak, 9ft, suitable for flat water, rivers, and sheltered coastal water. Stable and easy to handle for beginners. Comes with a two-part paddle, adult life jacket, and dry bag. Roof rack straps available for collection.',
    category: 'Equipment',
    price_per_day: 30,
    price_per_week: 120,
    deposit: 80,
    location: 'Galway Bay area',
    images: ['https://picsum.photos/seed/kayak999/600/400'],
    available_from: '2026-05-01',
    available_to: '2026-09-15',
  },
  {
    title: 'JBL Eon One Pro PA Speaker System',
    description: 'Professional 1000W all-in-one PA speaker with built-in 4-channel mixer, Bluetooth, and 10-hour battery. Ideal for outdoor events, house parties, markets, and small gigs. Clear, powerful sound. Full setup takes 5 minutes. Cable bag included.',
    category: 'Electronics',
    price_per_day: 40,
    price_per_week: 170,
    deposit: 150,
    location: 'Cork City',
    images: ['https://picsum.photos/seed/speaker111/600/400'],
    available_from: '2026-04-10',
    available_to: '2026-12-31',
  },
  {
    title: 'Dry Storage Unit (10m²) — Dublin',
    description: 'Clean, dry, ground-floor storage unit suitable for furniture, boxes, seasonal items, bikes, or small business stock. Secure building with 24/7 access. No moisture issues. Located near the M50. Minimum 2-day booking.',
    category: 'Space',
    price_per_day: 8,
    price_per_week: 40,
    deposit: 0,
    location: 'Dublin 22',
    images: ['https://picsum.photos/seed/storage222/600/400'],
    available_from: '2026-04-13',
    available_to: null,
  },
  {
    title: 'Brother Sewing Machine (FS40S)',
    description: 'Beginner-friendly sewing machine with 40 built-in stitch patterns, automatic needle threader, and LED light. In full working order. Great for clothing repairs, alterations, curtains, and craft projects. Manual and accessories box included.',
    category: 'Electronics',
    price_per_day: 10,
    price_per_week: 40,
    deposit: 30,
    location: 'Cork Suburbs',
    images: ['https://picsum.photos/seed/sewing333/600/400'],
    available_from: '2026-04-10',
    available_to: '2026-12-31',
  },
  {
    title: 'Makita DHS660Z Circular Saw (18V)',
    description: 'Cordless 18V circular saw with 165mm blade. Ideal for timber cutting, sheet material, and renovation work. Includes saw blade, dust extraction adapter, and guide rail. Battery not included — bring your own Makita 18V, or borrow with deposit.',
    category: 'Tools',
    price_per_day: 15,
    price_per_week: 60,
    deposit: 80,
    location: 'Dublin 15',
    images: ['https://picsum.photos/seed/circsaw/600/400'],
    available_from: '2026-04-14',
    available_to: '2026-12-31',
  },
  {
    title: 'Roof Tent (Free Borrow — Community Share)',
    description: 'Folding roof tent that fits most 4x4s and SUVs. Quick mount system. Two-person capacity with built-in foam mattress. Great for festivals or weekend adventures. Available to FreeTrust community members — just cover return transport costs.',
    category: 'Equipment',
    price_per_day: 0,
    price_per_week: 0,
    deposit: 50,
    location: 'Galway',
    images: ['https://picsum.photos/seed/rooftent/600/400'],
    available_from: '2026-05-01',
    available_to: '2026-08-31',
  },
]

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createServiceClient(serviceUrl, serviceKey)

    const rows = LISTINGS.map(l => ({
      ...l,
      user_id: user.id,
      status: 'active',
    }))

    const { data, error } = await admin.from('rent_share_listings').insert(rows).select('id, title')
    if (error) {
      console.error('[seed-rent-share]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ seeded: data?.length ?? 0, listings: data })
  } catch (err) {
    console.error('[seed-rent-share]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
