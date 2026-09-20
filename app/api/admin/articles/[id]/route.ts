export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFreeTrustAdmin } from '@/lib/admin/access'

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

function normaliseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 10)
}

function parsePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Invalid request body' as const }
  }

  const input = payload as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body : ''
  const status = input.status === 'draft' || input.status === 'published' ? input.status : 'published'

  if (title.length < 3) return { error: 'Title must be at least 3 characters' as const }
  if (!body.trim()) return { error: 'Body is required' as const }

  const featuredImageUrl = input.featured_image_url
  if (featuredImageUrl != null && typeof featuredImageUrl !== 'string') {
    return { error: 'Featured image URL must be a string' as const }
  }

  return {
    data: {
      title,
      excerpt: typeof input.excerpt === 'string' ? input.excerpt.trim() || null : null,
      body,
      featured_image_url: typeof featuredImageUrl === 'string' ? featuredImageUrl.trim() || null : null,
      status,
      category: typeof input.category === 'string' ? input.category.trim() || null : null,
      tags: normaliseTags(input.tags),
      read_time_minutes: estimateReadTime(body),
    },
  }
}

type RouteContext = { params: { id: string } }

// GET /api/admin/articles/:id — read any article for the approved admin editor.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  try {
    const admin = createAdminClient()
    const { data: article, error } = await admin
      .from('articles')
      .select('*, profiles!author_id(id, full_name, avatar_url, bio)')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/admin/articles/:id]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

    return NextResponse.json({ article })
  } catch (error) {
    console.error('[GET /api/admin/articles/:id] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/articles/:id — update article content without changing ownership.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  try {
    const parsed = parsePayload(await request.json())
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const admin = createAdminClient()
    const { data: article, error } = await admin
      .from('articles')
      .update(parsed.data)
      .eq('id', params.id)
      .select('*, profiles!author_id(id, full_name, avatar_url, bio)')
      .single()

    if (error) {
      console.error('[PATCH /api/admin/articles/:id]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error('[PATCH /api/admin/articles/:id] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
