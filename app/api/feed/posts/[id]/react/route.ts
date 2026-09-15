export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/push/sendPushNotification'

const VALID = new Set(['trust', 'love', 'insightful', 'collab'])

async function canReactAsOrganisation(admin: ReturnType<typeof createAdminClient>, userId: string, organisationId: string) {
  const { data: membership } = await admin
    .from('organisation_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organisation_id', organisationId)
    .in('role', ['owner', 'admin'])
    .maybeSingle()

  if (membership) return true

  const { data: created } = await admin
    .from('organisations')
    .select('id')
    .eq('id', organisationId)
    .eq('creator_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  return Boolean(created)
}

type CrossTableReference = {
  itemType: 'article' | 'service'
  itemId: string
}

type CrossTableTarget = CrossTableReference & {
  ownerId: string
  canonicalUrl: string
}

function parseCrossTableReference(postId: string): CrossTableReference | null {
  if (postId.startsWith('article-')) return { itemType: 'article', itemId: postId.slice('article-'.length) }
  if (postId.startsWith('service-')) return { itemType: 'service', itemId: postId.slice('service-'.length) }
  return null
}

async function resolveCrossTableTarget(
  admin: ReturnType<typeof createAdminClient>,
  reference: CrossTableReference,
): Promise<CrossTableTarget | null> {
  if (reference.itemType === 'article') {
    const { data } = await admin
      .from('articles')
      .select('id, author_id, slug')
      .eq('id', reference.itemId)
      .eq('status', 'published')
      .maybeSingle()

    if (!data?.author_id || !data.slug) return null
    return {
      ...reference,
      ownerId: data.author_id,
      canonicalUrl: `/articles/${data.slug}`,
    }
  }

  const { data } = await admin
    .from('listings')
    .select('id, seller_id')
    .eq('id', reference.itemId)
    .eq('product_type', 'service')
    .eq('status', 'active')
    .maybeSingle()

  if (!data?.seller_id) return null
  return {
    ...reference,
    ownerId: data.seller_id,
    canonicalUrl: `/services/${data.id}`,
  }
}

async function toggleCrossTableReaction(
  admin: ReturnType<typeof createAdminClient>,
  target: CrossTableTarget,
  userId: string,
  type: string,
  postedAsOrganisationId: string | null,
) {
  let existingQuery = admin
    .from('feed_item_reactions')
    .select('id, reaction_type')
    .eq('item_type', target.itemType)
    .eq('item_id', target.itemId)
    .eq('user_id', userId)

  existingQuery = postedAsOrganisationId
    ? existingQuery.eq('posted_as_organisation_id', postedAsOrganisationId)
    : existingQuery.is('posted_as_organisation_id', null)

  const { data: existing, error: existingError } = await existingQuery.maybeSingle()
  if (existingError) throw existingError

  let userReaction: string | null = null
  if (existing) {
    if (existing.reaction_type === type) {
      const { error } = await admin.from('feed_item_reactions').delete().eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await admin
        .from('feed_item_reactions')
        .update({ reaction_type: type })
        .eq('id', existing.id)
      if (error) throw error
      userReaction = type
    }
  } else {
    const { error } = await admin
      .from('feed_item_reactions')
      .insert({
        item_type: target.itemType,
        item_id: target.itemId,
        user_id: userId,
        reaction_type: type,
        posted_as_organisation_id: postedAsOrganisationId,
      })
    if (error) throw error
    userReaction = type
  }

  const { data: rows, error: countsError } = await admin
    .from('feed_item_reactions')
    .select('reaction_type')
    .eq('item_type', target.itemType)
    .eq('item_id', target.itemId)
  if (countsError) throw countsError

  const counts: Record<string, number> = { trust: 0, love: 0, insightful: 0, collab: 0 }
  for (const row of rows ?? []) {
    const reactionType = (row as { reaction_type: string }).reaction_type
    if (reactionType in counts) counts[reactionType]++
  }

  return {
    user_reaction: userReaction,
    counts,
    total: counts.trust + counts.love + counts.insightful + counts.collab,
    changed: !existing || existing.reaction_type !== type,
  }
}

// POST /api/feed/posts/[id]/react { type }
// - If user has no reaction → insert
// - If user has the same reaction → delete (toggle off)
// - If user has a different reaction → update
// Returns the new per-type counts and the user's current reaction.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { type?: string; posted_as_organisation_id?: string | null }
    const type = (body.type ?? '').trim().toLowerCase()
    if (!VALID.has(type)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    const admin = createAdminClient()
    const postedAsOrganisationId = typeof body.posted_as_organisation_id === 'string' && body.posted_as_organisation_id.trim()
      ? body.posted_as_organisation_id.trim()
      : null

    if (postedAsOrganisationId) {
      const allowed = await canReactAsOrganisation(admin, user.id, postedAsOrganisationId)
      if (!allowed) {
        return NextResponse.json({ error: 'You are not allowed to react as this page' }, { status: 403 })
      }
    }

    // Articles and services are composed into the newsfeed with synthetic
    // IDs (article-<uuid> / service-<uuid>). They cannot use feed_reactions,
    // whose post_id is correctly constrained to feed_posts(id).
    const crossTableReference = parseCrossTableReference(postId)
    if (crossTableReference) {
      const target = await resolveCrossTableTarget(admin, crossTableReference)
      if (!target) {
        return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })
      }

      const result = await toggleCrossTableReaction(admin, target, user.id, type, postedAsOrganisationId)
      if (result.changed && result.user_reaction && target.ownerId !== user.id) {
        let reactorName = 'Someone'
        if (postedAsOrganisationId) {
          const { data: org } = await admin
            .from('organisations')
            .select('name')
            .eq('id', postedAsOrganisationId)
            .maybeSingle()
          reactorName = org?.name ?? 'A page'
        } else {
          const { data: reactor } = await admin
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          reactorName = reactor?.full_name ?? 'Someone'
        }
        sendEmail({
          type: 'new_reaction',
          userId: target.ownerId,
          payload: { reactorName, reactionType: type, postId, postUrl: target.canonicalUrl },
        }).catch(() => {})
        sendPushNotification({
          userId: target.ownerId,
          title: `${reactorName} reacted to your ${target.itemType}`,
          message: `They gave it a "${type}" reaction`,
          url: target.canonicalUrl,
        }).catch(() => {})
      }

      return NextResponse.json(result)
    }

    // Check existing reaction
    let existingQuery = admin
      .from('feed_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', user.id)

    existingQuery = postedAsOrganisationId
      ? existingQuery.eq('posted_as_organisation_id', postedAsOrganisationId)
      : existingQuery.is('posted_as_organisation_id', null)

    const { data: existing } = await existingQuery
      .maybeSingle()

    let userReaction: string | null = null

    if (existing) {
      if (existing.reaction_type === type) {
        // Toggle off
        await admin.from('feed_reactions').delete().eq('id', existing.id)
        userReaction = null
      } else {
        // Change reaction type
        await admin
          .from('feed_reactions')
          .update({ reaction_type: type })
          .eq('id', existing.id)
        userReaction = type
      }
    } else {
      const { error: insertErr } = await admin
        .from('feed_reactions')
        .insert({ post_id: postId, user_id: user.id, reaction_type: type, posted_as_organisation_id: postedAsOrganisationId })
      if (insertErr) {
        // If table doesn't exist yet, return a clear error
        if (insertErr.code === '42P01') {
          return NextResponse.json({ error: 'Reactions not set up — run the feed_reactions migration' }, { status: 500 })
        }
        console.error('[react] insert error:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
      userReaction = type

      // Notify the post author on a new reaction (fire-and-forget,
      // preference-checked, skips self-reactions). Only fires on the
      // initial insert path — not on switch-type updates.
      const { data: postData } = await admin
        .from('feed_posts')
        .select('user_id')
        .eq('id', postId)
        .maybeSingle()
      if (postData?.user_id && postData.user_id !== user.id) {
        let reactorName = 'Someone'
        if (postedAsOrganisationId) {
          const { data: org } = await admin
            .from('organisations')
            .select('name')
            .eq('id', postedAsOrganisationId)
            .maybeSingle()
          reactorName = org?.name ?? 'A page'
        } else {
          const { data: reactor } = await admin
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          reactorName = reactor?.full_name ?? 'Someone'
        }
        sendEmail({
          type: 'new_reaction',
          userId: postData.user_id,
          payload: { reactorName, reactionType: type, postId },
        }).catch(() => {})
        sendPushNotification({
          userId: postData.user_id,
          title: `${reactorName} reacted to your post`,
          message: `They gave it a "${type}" reaction`,
          url: `/feed/${postId}`,
        }).catch(() => {})
      }
    }

    // Compute fresh counts per type
    const { data: rows } = await admin
      .from('feed_reactions')
      .select('reaction_type')
      .eq('post_id', postId)

    const counts: Record<string, number> = { trust: 0, love: 0, insightful: 0, collab: 0 }
    for (const r of rows ?? []) {
      const t = (r as { reaction_type: string }).reaction_type
      if (t in counts) counts[t]++
    }
    const total = counts.trust + counts.love + counts.insightful + counts.collab

    return NextResponse.json({ user_reaction: userReaction, counts, total })
  } catch (err) {
    console.error('[POST /api/feed/posts/[id]/react] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
