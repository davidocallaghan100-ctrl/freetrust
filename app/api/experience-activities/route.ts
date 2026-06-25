export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActivityAction =
  | { action: 'createActivity'; activity?: ActivityInput }
  | { action: 'updateActivity'; activity_id: string; activity?: ActivityInput }
  | { action: 'joinActivity'; activity_id: string }
  | { action: 'leaveActivity'; activity_id: string }
  | { action: 'cancelActivity'; activity_id: string }
  | { action: 'sendInvites'; to_user_ids: string[]; activity_id: string; message?: string | null }
  | { action: 'updateInvite'; invite_id: string; status: 'accepted' | 'declined' }
  | { action: 'addComment'; activity_id: string; content: string }

type ActivityInput = {
  title?: string
  description?: string | null
  activity_type?: string
  category_id?: string | null
  venue_id?: string | null
  location_name?: string | null
  location_lat?: number | null
  location_lng?: number | null
  scheduled_at?: string
  duration_minutes?: number
  skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'all'
  max_attendees?: number
  min_attendees?: number
  cost_per_person?: number
  equipment_provided?: boolean
  equipment_notes?: string | null
  is_recurring?: boolean
  recurrence_rule?: string | null
  is_open_to_all?: boolean
}

async function currentUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function cleanActivity(input: ActivityInput, userId?: string) {
  const scheduled = input.scheduled_at ? new Date(input.scheduled_at) : null
  if (!input.title?.trim()) throw new Error('Activity title is required')
  if (!input.activity_type?.trim()) throw new Error('Activity type is required')
  if (!scheduled || Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) throw new Error('Choose a future date and time')
  const max = Math.min(100, Math.max(2, Number(input.max_attendees ?? 20)))
  const min = Math.min(max, Math.max(2, Number(input.min_attendees ?? 2)))
  return {
    ...(userId ? { created_by: userId } : {}),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    activity_type: input.activity_type.trim(),
    category_id: input.category_id || null,
    venue_id: input.venue_id || null,
    location_name: input.location_name?.trim() || null,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    scheduled_at: scheduled.toISOString(),
    duration_minutes: Math.max(30, Number(input.duration_minutes ?? 60)),
    skill_level: input.skill_level ?? 'all',
    max_attendees: max,
    min_attendees: min,
    cost_per_person: Math.max(0, Number(input.cost_per_person ?? 0)),
    equipment_provided: Boolean(input.equipment_provided),
    equipment_notes: input.equipment_provided ? input.equipment_notes?.trim() || null : null,
    is_recurring: Boolean(input.is_recurring),
    recurrence_rule: input.is_recurring ? input.recurrence_rule || 'weekly' : null,
    is_open_to_all: input.is_open_to_all ?? true,
    status: 'active',
  }
}

async function attachProfiles(admin: ReturnType<typeof createAdminClient>, rows: any[], inviteRows: any[] = []) {
  const creatorIds = rows.map((row) => row.created_by).filter(Boolean)
  const commentUserIds = rows.flatMap((row) => (row.comments ?? []).map((comment: any) => comment.user_id).filter(Boolean))
  const attendeeUserIds = rows.flatMap((row) => (row.attendees ?? []).map((attendee: any) => attendee.user_id).filter(Boolean))
  const senderIds = inviteRows.map((row) => row.from_user_id).filter(Boolean)
  const allIds = Array.from(new Set([...creatorIds, ...commentUserIds, ...attendeeUserIds, ...senderIds]))
  if (!allIds.length) return { rows, inviteRows, profiles: new Map(), balances: new Map() }
  const [profilesRes, balancesRes] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, full_name, avatar_url, trust_balance, created_at').in('id', allIds),
    admin.from('trust_balances').select('user_id, balance').in('user_id', allIds),
  ])
  const profiles = new Map((profilesRes.data ?? []).map((profile: any) => [profile.id, profile]))
  const balances = new Map((balancesRes.data ?? []).map((row: any) => [String(row.user_id), Number(row.balance ?? 0)]))
  const withPeople = rows.map((row) => ({
    ...row,
    creator: profiles.get(row.created_by) ?? null,
    creatorTrust: balances.get(row.created_by) ?? Number(profiles.get(row.created_by)?.trust_balance ?? 0),
    attendees: (row.attendees ?? []).map((attendee: any) => ({ ...attendee, profile: profiles.get(attendee.user_id) ?? null, trust_score: balances.get(attendee.user_id) ?? Number(profiles.get(attendee.user_id)?.trust_balance ?? 0) })),
    comments: (row.comments ?? []).map((comment: any) => ({ ...comment, profile: profiles.get(comment.user_id) ?? null })),
  }))
  const withSenders = inviteRows.map((row) => ({
    ...row,
    sender: profiles.get(row.from_user_id) ?? null,
    senderTrust: balances.get(row.from_user_id) ?? Number(profiles.get(row.from_user_id)?.trust_balance ?? 0),
  }))
  return { rows: withPeople, inviteRows: withSenders, profiles, balances }
}

export async function GET() {
  try {
    const userId = await currentUserId()
    const admin = createAdminClient()
    const now = new Date().toISOString()

    const [venuesRes, categoriesRes, activitiesRes] = await Promise.all([
      admin.from('activity_venues').select('*').order('name'),
      admin.from('activity_categories').select('*').order('sort_order'),
      admin.from('community_activities').select('*, venue:activity_venues(*), category:activity_categories(*), attendees:community_activity_attendees(*), comments:community_activity_comments(*)').gt('scheduled_at', now).eq('status', 'active').order('scheduled_at', { ascending: true }),
    ])
    if (venuesRes.error) throw venuesRes.error
    if (categoriesRes.error) throw categoriesRes.error
    if (activitiesRes.error) throw activitiesRes.error

    let invites: any[] = []
    let hosting: any[] = []
    let attending: any[] = []
    let friends: any[] = []
    let friendIds: string[] = []

    if (userId) {
      const [invitesRes, hostingRes, attendingRes, followingRows, followersRows] = await Promise.all([
        admin.from('community_activity_invites').select('*, activity:community_activities(*, venue:activity_venues(*), category:activity_categories(*))').eq('to_user_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
        admin.from('community_activities').select('*, venue:activity_venues(*), category:activity_categories(*), attendees:community_activity_attendees(*)').eq('created_by', userId).eq('status', 'active').order('scheduled_at', { ascending: true }),
        admin.from('community_activity_attendees').select('*, activity:community_activities(*, venue:activity_venues(*), category:activity_categories(*))').eq('user_id', userId),
        admin.from('user_follows').select('following_id, profiles!following_id(id, first_name, last_name, full_name, avatar_url, trust_balance)').eq('follower_id', userId),
        admin.from('user_follows').select('follower_id').eq('following_id', userId),
      ])
      if (invitesRes.error) throw invitesRes.error
      if (hostingRes.error) throw hostingRes.error
      if (attendingRes.error) throw attendingRes.error
      invites = invitesRes.data ?? []
      hosting = hostingRes.data ?? []
      attending = attendingRes.data ?? []

      const followerSet = new Set((followersRows.data ?? []).map((row: any) => row.follower_id))
      const mutual = (followingRows.data ?? []).filter((row: any) => followerSet.has(row.following_id)).map((row: any) => row.profiles).filter(Boolean)
      friendIds = mutual.map((profile: any) => profile.id)
      const balancesRes = friendIds.length ? await admin.from('trust_balances').select('user_id, balance').in('user_id', friendIds) : { data: [] }
      const balanceById = new Map((balancesRes.data ?? []).map((row: any) => [String(row.user_id), Number(row.balance ?? 0)]))
      friends = mutual.map((profile: any) => ({ ...profile, trust_score: balanceById.get(profile.id) ?? Number(profile.trust_balance ?? 0) })).filter((profile: any) => profile.trust_score >= 30)
    }

    const people = await attachProfiles(admin, [...(activitiesRes.data ?? []), ...hosting], invites)
    const activityCount = (activitiesRes.data ?? []).length

    return NextResponse.json({
      userId,
      venues: venuesRes.data ?? [],
      categories: categoriesRes.data ?? [],
      activities: people.rows.slice(0, activityCount),
      invites: people.inviteRows,
      hosting: people.rows.slice(activityCount),
      attending,
      friendIds,
      friends,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
  } catch (err) {
    console.error('[GET /api/experience-activities]', err)
    return NextResponse.json({ error: 'Could not load Experience Activities' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as ActivityAction
    const admin = createAdminClient()

    if (body.action === 'createActivity') {
      const row = cleanActivity((body as any).activity ?? (body as any), userId)
      const { data, error } = await admin.from('community_activities').insert(row).select('id').single()
      if (error) throw error
      await admin.from('community_activity_attendees').insert({ activity_id: data.id, user_id: userId, status: 'going' })
      return NextResponse.json({ id: data.id })
    }

    if (body.action === 'updateActivity') {
      const { data: existing, error: existingError } = await admin.from('community_activities').select('created_by').eq('id', body.activity_id).single()
      if (existingError) throw existingError
      if (existing.created_by !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const row = cleanActivity((body as any).activity ?? (body as any))
      const { error } = await admin.from('community_activities').update(row).eq('id', body.activity_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'joinActivity') {
      const { data: activity, error: activityError } = await admin.from('community_activities').select('id, max_attendees').eq('id', body.activity_id).eq('status', 'active').single()
      if (activityError) throw activityError
      const { count, error: countError } = await admin.from('community_activity_attendees').select('id', { count: 'exact', head: true }).eq('activity_id', body.activity_id).eq('status', 'going')
      if (countError) throw countError
      const status = Number(count ?? 0) >= Number(activity.max_attendees ?? 20) ? 'waitlist' : 'going'
      const { error } = await admin.from('community_activity_attendees').upsert({ activity_id: body.activity_id, user_id: userId, status }, { onConflict: 'activity_id,user_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, status })
    }

    if (body.action === 'leaveActivity') {
      const { error } = await admin.from('community_activity_attendees').delete().eq('activity_id', body.activity_id).eq('user_id', userId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'cancelActivity') {
      const { data: activity, error: activityError } = await admin.from('community_activities').select('created_by').eq('id', body.activity_id).single()
      if (activityError) throw activityError
      if (activity.created_by !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { error } = await admin.from('community_activities').update({ status: 'cancelled' }).eq('id', body.activity_id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'sendInvites') {
      const rows = Array.from(new Set(body.to_user_ids)).map((toUserId) => ({ from_user_id: userId, to_user_id: toUserId, activity_id: body.activity_id, message: body.message?.trim() || null, status: 'pending' }))
      const { error } = await admin.from('community_activity_invites').upsert(rows, { onConflict: 'from_user_id,to_user_id,activity_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, count: rows.length })
    }

    if (body.action === 'updateInvite') {
      const { data: invite, error: inviteError } = await admin.from('community_activity_invites').select('id, to_user_id, activity_id').eq('id', body.invite_id).single()
      if (inviteError) throw inviteError
      if (invite.to_user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { error } = await admin.from('community_activity_invites').update({ status: body.status }).eq('id', body.invite_id)
      if (error) throw error
      if (body.status === 'accepted') await admin.from('community_activity_attendees').upsert({ activity_id: invite.activity_id, user_id: userId, status: 'going' }, { onConflict: 'activity_id,user_id' })
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'addComment') {
      const content = body.content.trim()
      if (!content) return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
      const { error } = await admin.from('community_activity_comments').insert({ activity_id: body.activity_id, user_id: userId, content })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[POST /api/experience-activities]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update Experience Activities' }, { status: 500 })
  }
}
