export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PubAction =
  | { action: 'createActivity'; pub_id: string; title: string; description?: string | null; activity_type?: string; scheduled_at: string; max_attendees?: number; is_open_to_all?: boolean }
  | { action: 'joinActivity'; activity_id: string }
  | { action: 'sendInvites'; to_user_ids: string[]; pub_id: string; activity_id?: string | null; message?: string | null }
  | { action: 'updateInvite'; invite_id: string; status: 'accepted' | 'declined' }

async function currentUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function fetchAllRows<T = any>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

export async function GET() {
  try {
    const userId = await currentUserId()
    const admin = createAdminClient()

    const [pubs, activities] = await Promise.all([
      fetchAllRows(() => admin.from('pubs').select('*').order('name')),
      fetchAllRows(() => admin.from('pub_activities').select('*, pub:pubs(*), attendees:pub_activity_attendees(*)').gt('scheduled_at', new Date().toISOString()).eq('status', 'active').order('scheduled_at', { ascending: true })),
    ])

    const creatorIds = Array.from(new Set(activities.map((row) => row.created_by).filter(Boolean)))
    const [creatorProfilesRes, creatorBalancesRes] = creatorIds.length ? await Promise.all([
      admin.from('profiles').select('id, first_name, last_name, full_name, avatar_url, trust_balance').in('id', creatorIds),
      admin.from('trust_balances').select('user_id, balance').in('user_id', creatorIds),
    ]) : [{ data: [] }, { data: [] }]
    const creatorProfiles = new Map((creatorProfilesRes.data ?? []).map((p: any) => [p.id, p]))
    const creatorBalances = new Map((creatorBalancesRes.data ?? []).map((row: any) => [String(row.user_id), Number(row.balance ?? 0)]))

    let invites: any[] = []
    let friends: any[] = []
    let friendIds: string[] = []

    if (userId) {
      const [invitesRes, followingRows, followersRows] = await Promise.all([
        admin.from('pub_invites').select('*, pub:pubs(*), activity:pub_activities(*)').eq('to_user_id', userId).eq('status', 'pending').order('created_at', { ascending: false }),
        admin.from('user_follows').select('following_id, profiles!following_id(id, first_name, last_name, full_name, avatar_url, trust_balance)').eq('follower_id', userId),
        admin.from('user_follows').select('follower_id').eq('following_id', userId),
      ])
      if (invitesRes.error) throw invitesRes.error
      const senderIds = Array.from(new Set((invitesRes.data ?? []).map((row) => row.from_user_id).filter(Boolean)))
      const [senderProfilesRes, senderBalancesRes] = senderIds.length ? await Promise.all([
        admin.from('profiles').select('id, first_name, last_name, full_name, avatar_url, trust_balance').in('id', senderIds),
        admin.from('trust_balances').select('user_id, balance').in('user_id', senderIds),
      ]) : [{ data: [] }, { data: [] }]
      const senderProfiles = new Map((senderProfilesRes.data ?? []).map((p: any) => [p.id, p]))
      const senderBalances = new Map((senderBalancesRes.data ?? []).map((row: any) => [String(row.user_id), Number(row.balance ?? 0)]))
      invites = (invitesRes.data ?? []).map((row) => ({ ...row, sender: senderProfiles.get(row.from_user_id) ?? null, senderTrust: senderBalances.get(row.from_user_id) ?? Number(senderProfiles.get(row.from_user_id)?.trust_balance ?? 0) }))

      const followerSet = new Set((followersRows.data ?? []).map((row: any) => row.follower_id))
      const mutual = (followingRows.data ?? []).filter((row: any) => followerSet.has(row.following_id)).map((row: any) => row.profiles).filter(Boolean)
      friendIds = mutual.map((p: any) => p.id)
      const balancesRes = friendIds.length ? await admin.from('trust_balances').select('user_id, balance').in('user_id', friendIds) : { data: [] }
      const balanceById = new Map((balancesRes.data ?? []).map((row: any) => [String(row.user_id), Number(row.balance ?? 0)]))
      friends = mutual.map((p: any) => ({ ...p, trust_score: balanceById.get(p.id) ?? Number(p.trust_balance ?? 0) })).filter((p: any) => p.trust_score >= 30)
    }

    return NextResponse.json({
      userId,
      pubs,
      activities: activities.map((row) => ({ ...row, creator: creatorProfiles.get(row.created_by) ?? null, creatorTrust: creatorBalances.get(row.created_by) ?? Number(creatorProfiles.get(row.created_by)?.trust_balance ?? 0) })),
      invites,
      friendIds,
      friends,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
  } catch (err) {
    console.error('[GET /api/experience-pubs]', err)
    return NextResponse.json({ error: 'Could not load Experience Pubs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as PubAction
    const admin = createAdminClient()

    if (body.action === 'createActivity') {
      const { data, error } = await admin.from('pub_activities').insert({ pub_id: body.pub_id, created_by: userId, title: body.title.trim(), description: body.description?.trim() || null, activity_type: body.activity_type ?? 'casual_pints', scheduled_at: body.scheduled_at, max_attendees: Math.min(50, Math.max(2, Number(body.max_attendees ?? 20))), is_open_to_all: body.is_open_to_all ?? true, status: 'active' }).select('id').single()
      if (error) throw error
      await admin.from('pub_activity_attendees').insert({ activity_id: data.id, user_id: userId, status: 'going' })
      return NextResponse.json({ id: data.id })
    }

    if (body.action === 'joinActivity') {
      const { error } = await admin.from('pub_activity_attendees').upsert({ activity_id: body.activity_id, user_id: userId, status: 'going' }, { onConflict: 'activity_id,user_id' })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'sendInvites') {
      const rows = body.to_user_ids.map((toUserId) => ({ from_user_id: userId, to_user_id: toUserId, activity_id: body.activity_id || null, pub_id: body.pub_id, message: body.message ?? null, status: 'pending' }))
      const { error } = await admin.from('pub_invites').insert(rows)
      if (error) throw error
      return NextResponse.json({ ok: true, count: rows.length })
    }

    if (body.action === 'updateInvite') {
      const { data: invite, error: inviteError } = await admin.from('pub_invites').select('id, to_user_id, activity_id').eq('id', body.invite_id).single()
      if (inviteError) throw inviteError
      if (invite.to_user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { error } = await admin.from('pub_invites').update({ status: body.status }).eq('id', body.invite_id)
      if (error) throw error
      if (body.status === 'accepted' && invite.activity_id) await admin.from('pub_activity_attendees').upsert({ activity_id: invite.activity_id, user_id: userId, status: 'going' }, { onConflict: 'activity_id,user_id' })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[POST /api/experience-pubs]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update Experience Pubs' }, { status: 500 })
  }
}
