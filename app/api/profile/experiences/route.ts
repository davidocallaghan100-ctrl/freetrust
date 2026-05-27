export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function cleanText(value: unknown, max: number, required = false) {
  if (typeof value !== 'string') return required ? '' : null
  const trimmed = value.trim()
  if (!trimmed) return required ? '' : null
  return trimmed.slice(0, max)
}

function cleanDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null
}

function shapeExperience(body: Record<string, unknown>) {
  const title = cleanText(body.title, 120, true)
  const isCurrent = Boolean(body.is_current)
  return {
    title,
    company: cleanText(body.company, 120),
    location: cleanText(body.location, 120),
    start_date: cleanDate(body.start_date),
    end_date: isCurrent ? null : cleanDate(body.end_date),
    is_current: isCurrent,
    description: cleanText(body.description, 1000),
    display_order: Number.isFinite(Number(body.display_order)) ? Number(body.display_order) : 0,
  }
}

function normaliseExperience(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      return {
        id: cleanText(item.id, 80) ?? crypto.randomUUID(),
        role: cleanText(item.role ?? item.title, 120),
        organization: cleanText(item.organization ?? item.company, 120),
        period: cleanText(item.period, 80),
        description: cleanText(item.description, 1000),
      }
    })
    .filter(entry => entry.role || entry.organization || entry.description)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const requestedProfileId = searchParams.get('profileId')?.trim() || null

    let profileId = requestedProfileId
    if (!profileId) {
      const { data: { user } } = await supabase.auth.getUser()
      profileId = user?.id ?? null
    }
    if (!profileId) {
      return NextResponse.json({ experiences: [] })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('professional_experience')
      .eq('id', profileId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/profile/experiences]', error)
      return NextResponse.json({ error: error.message, experiences: [] }, { status: 500 })
    }

    return NextResponse.json({ experiences: normaliseExperience((data as { professional_experience?: unknown } | null)?.professional_experience) })
  } catch (err) {
    console.error('[GET /api/profile/experiences] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error', experiences: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const next = shapeExperience(body)
    if (!next.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('professional_experience')
      .eq('id', user.id)
      .single()

    const experience = {
      id: crypto.randomUUID(),
      role: next.title,
      organization: next.company,
      period: [next.start_date, next.is_current ? 'present' : next.end_date].filter(Boolean).join('–'),
      description: next.description,
    }

    const merged = [...normaliseExperience((existingProfile as { professional_experience?: unknown } | null)?.professional_experience), experience].slice(0, 12)
    const { data, error } = await supabase
      .from('profiles')
      .update({ professional_experience: merged, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('professional_experience')
      .single()

    if (error) {
      console.error('[POST /api/profile/experiences]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ experience, experiences: normaliseExperience((data as { professional_experience?: unknown } | null)?.professional_experience) })
  } catch (err) {
    console.error('[POST /api/profile/experiences] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const id = cleanText(body.id, 80, true)
    const next = shapeExperience(body)
    if (!id) return NextResponse.json({ error: 'Experience id is required' }, { status: 400 })
    if (!next.title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('professional_experience')
      .eq('id', user.id)
      .single()

    const existing = normaliseExperience((existingProfile as { professional_experience?: unknown } | null)?.professional_experience)
    const replacement = {
      id,
      role: next.title,
      organization: next.company,
      period: [next.start_date, next.is_current ? 'present' : next.end_date].filter(Boolean).join('–'),
      description: next.description,
    }
    const merged = existing.map(entry => entry.id === id ? replacement : entry)

    const { data, error } = await supabase
      .from('profiles')
      .update({ professional_experience: merged, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('professional_experience')
      .single()

    if (error) {
      console.error('[PATCH /api/profile/experiences]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ experience: replacement, experiences: normaliseExperience((data as { professional_experience?: unknown } | null)?.professional_experience) })
  } catch (err) {
    console.error('[PATCH /api/profile/experiences] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
