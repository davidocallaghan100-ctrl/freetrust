export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/build/conversations — list the current user's Build conversations, newest first.
// Each conversation includes a lightweight `preview` (footprint + roof type
// + first material swatch) derived from its most recent design_spec, if any
// — used by the "Saved Designs" section to show a quick visual hint without
// re-fetching/parsing the full conversation transcript.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('build_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/build/conversations]', error)
      return NextResponse.json({ error: 'Could not load conversations' }, { status: 500 })
    }

    const conversations = data ?? []

    // One extra query to build a conversation_id -> latest design_spec
    // lookup, rather than N+1 queries per conversation.
    let previewByConvo: Record<string, { footprint_m: string; roof: string; swatch: string | null }> = {}
    if (conversations.length > 0) {
      const { data: specRows } = await supabase
        .from('build_messages')
        .select('conversation_id, design_spec, created_at')
        .in('conversation_id', conversations.map(c => c.id))
        .not('design_spec', 'is', null)
        .order('created_at', { ascending: false })

      previewByConvo = (specRows ?? []).reduce((acc, row) => {
        if (acc[row.conversation_id]) return acc // already have the latest (rows are newest-first)
        const spec = row.design_spec as { footprint?: { width_m?: number; depth_m?: number }; roof?: { type?: string }; materials_palette?: { color_hex?: string }[] } | null
        if (!spec) return acc
        acc[row.conversation_id] = {
          footprint_m: spec.footprint ? `${spec.footprint.width_m ?? '?'}×${spec.footprint.depth_m ?? '?'}m` : '',
          roof: spec.roof?.type ?? '',
          swatch: spec.materials_palette?.[0]?.color_hex ?? null,
        }
        return acc
      }, {} as Record<string, { footprint_m: string; roof: string; swatch: string | null }>)
    }

    return NextResponse.json({
      conversations: conversations.map(c => ({ ...c, preview: previewByConvo[c.id] ?? null })),
    })
  } catch (err) {
    console.error('[GET /api/build/conversations] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// POST /api/build/conversations — create a new (empty) conversation.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { title?: string }
    const title = body.title?.trim().slice(0, 120) || 'Untitled design'

    const { data, error } = await supabase
      .from('build_conversations')
      .insert({ user_id: user.id, title })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      console.error('[POST /api/build/conversations]', error)
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 })
    }

    return NextResponse.json({ conversation: data })
  } catch (err) {
    console.error('[POST /api/build/conversations] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
