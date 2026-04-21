export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Configure VAPID — only when keys are available (skipped in dev without keys)
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:hello@freetrust.co',
    vapidPublicKey,
    vapidPrivateKey
  )
}

export async function POST(req: NextRequest) {
  // Internal only — verify shared secret
  const authHeader = req.headers.get('x-internal-secret')
  if (authHeader !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const body = await req.json()
  const { user_id, title, message, url } = body

  if (!user_id || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch user's push subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', user_id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: 'https://freetrust.co/icon.png',
    badge: 'https://freetrust.co/icon.png',
    data: { url },
  })

  let sent = 0
  const staleEndpoints: string[] = []

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      )
      sent++
    } catch (err: unknown) {
      // 410 Gone = subscription expired, clean up
      const pushErr = err as { statusCode?: number }
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        staleEndpoints.push(sub.endpoint)
      }
    }
  }))

  // Remove stale subscriptions
  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete()
      .eq('user_id', user_id)
      .in('endpoint', staleEndpoints)
  }

  return NextResponse.json({ sent })
}
