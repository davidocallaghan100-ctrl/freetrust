export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET  /api/upload/test — environment + bucket health check
// POST /api/upload/test — accepts a file, reports every step of the upload
//
// Nothing is persisted. This endpoint exists purely to diagnose upload
// failures by isolating each layer of the flow: env vars, auth, request
// parsing, admin client, bucket presence, upload, public URL resolution.

interface DiagnosticStep {
  step: string
  ok: boolean
  detail?: string
  duration_ms?: number
}

export async function GET() {
  const steps: DiagnosticStep[] = []
  const env: Record<string, boolean> = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  const allEnvOk = Object.values(env).every(Boolean)
  steps.push({
    step: 'env_vars',
    ok: allEnvOk,
    detail: allEnvOk ? 'all required env vars present' : `missing: ${Object.entries(env).filter(([, v]) => !v).map(([k]) => k).join(', ')}`,
  })

  if (!allEnvOk) {
    return NextResponse.json({ ok: false, env, steps }, { status: 500 })
  }

  // Try to build admin client
  let admin
  try {
    admin = createAdminClient()
    steps.push({ step: 'admin_client', ok: true })
  } catch (err) {
    steps.push({ step: 'admin_client', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ ok: false, env, steps }, { status: 500 })
  }

  // Check bucket exists
  const t0 = Date.now()
  try {
    const { data: buckets, error } = await admin.storage.listBuckets()
    const duration = Date.now() - t0
    if (error) {
      steps.push({ step: 'list_buckets', ok: false, detail: error.message, duration_ms: duration })
    } else {
      const feedMedia = buckets?.find(b => b.id === 'feed-media')
      steps.push({
        step: 'list_buckets',
        ok: true,
        detail: `${buckets?.length ?? 0} buckets found` + (feedMedia ? `; feed-media exists (public=${feedMedia.public})` : '; feed-media MISSING'),
        duration_ms: duration,
      })
      if (!feedMedia) {
        steps.push({
          step: 'feed_media_bucket',
          ok: false,
          detail: 'The feed-media bucket does not exist. Run supabase/migrations/20260412_feed_media_bucket.sql in the Supabase SQL editor.',
        })
      } else if (!feedMedia.public) {
        steps.push({
          step: 'feed_media_bucket',
          ok: false,
          detail: 'feed-media bucket exists but is NOT public. Set it to public in the Supabase dashboard or re-run the migration.',
        })
      } else {
        steps.push({ step: 'feed_media_bucket', ok: true, detail: 'exists and is public' })
      }
    }
  } catch (err) {
    steps.push({ step: 'list_buckets', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  const allOk = steps.every(s => s.ok)
  return NextResponse.json({ ok: allOk, env, steps }, { status: allOk ? 200 : 500 })
}

export async function POST(req: NextRequest) {
  const steps: DiagnosticStep[] = []
  const start = Date.now()

  console.log('[upload/test] POST received')

  // Step 1: env check
  const envOk = !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  steps.push({
    step: 'env_vars',
    ok: envOk,
    detail: envOk ? 'ok' : 'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing',
  })
  if (!envOk) return NextResponse.json({ ok: false, steps }, { status: 500 })

  // Step 2: auth
  let userId: string | null = null
  try {
    const authClient = await createClient()
    const { data: { user }, error } = await authClient.auth.getUser()
    if (error || !user) {
      steps.push({ step: 'auth', ok: false, detail: error?.message || 'no user session' })
      return NextResponse.json({ ok: false, steps }, { status: 401 })
    }
    userId = user.id
    steps.push({ step: 'auth', ok: true, detail: `user=${user.id}` })
  } catch (err) {
    steps.push({ step: 'auth', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ ok: false, steps }, { status: 500 })
  }

  // Step 3: parse form data
  let file: File | null = null
  try {
    const fd = await req.formData()
    const raw = fd.get('file')
    if (!raw || typeof raw === 'string') {
      steps.push({ step: 'form_data', ok: false, detail: 'no file field' })
      return NextResponse.json({ ok: false, steps }, { status: 400 })
    }
    file = raw as File
    steps.push({
      step: 'form_data',
      ok: true,
      detail: `file="${file.name}" type="${file.type}" size=${file.size}`,
    })
  } catch (err) {
    steps.push({ step: 'form_data', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ ok: false, steps }, { status: 400 })
  }

  // Step 4: admin client
  let admin
  try {
    admin = createAdminClient()
    steps.push({ step: 'admin_client', ok: true })
  } catch (err) {
    steps.push({ step: 'admin_client', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ ok: false, steps }, { status: 500 })
  }

  // Step 5: list buckets
  try {
    const { data: buckets, error } = await admin.storage.listBuckets()
    if (error) {
      steps.push({ step: 'list_buckets', ok: false, detail: error.message })
    } else {
      const fm = buckets?.find(b => b.id === 'feed-media')
      steps.push({
        step: 'list_buckets',
        ok: !!fm,
        detail: fm ? `feed-media present (public=${fm.public})` : `feed-media MISSING; buckets=${buckets?.map(b => b.id).join(',')}`,
      })
    }
  } catch (err) {
    steps.push({ step: 'list_buckets', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // Step 6: read the file into a buffer
  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
    steps.push({ step: 'read_buffer', ok: true, detail: `${buffer.byteLength} bytes` })
  } catch (err) {
    steps.push({ step: 'read_buffer', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ ok: false, steps }, { status: 500 })
  }

  // Step 7: attempt the upload (to a diagnostic path)
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const testPath = `test/${userId}/${Date.now()}.${ext}`
  const t0 = Date.now()
  try {
    const { error } = await admin.storage
      .from('feed-media')
      .upload(testPath, buffer, { contentType: file.type, upsert: true })
    const duration = Date.now() - t0
    if (error) {
      steps.push({ step: 'upload', ok: false, detail: error.message, duration_ms: duration })
    } else {
      steps.push({ step: 'upload', ok: true, detail: testPath, duration_ms: duration })
    }
  } catch (err) {
    steps.push({ step: 'upload', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // Step 8: resolve public URL
  try {
    const { data: urlData } = admin.storage.from('feed-media').getPublicUrl(testPath)
    steps.push({ step: 'public_url', ok: !!urlData?.publicUrl, detail: urlData?.publicUrl ?? 'empty' })
  } catch (err) {
    steps.push({ step: 'public_url', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // Step 9: clean up the test file (best-effort)
  try {
    await admin.storage.from('feed-media').remove([testPath])
    steps.push({ step: 'cleanup', ok: true })
  } catch (err) {
    steps.push({ step: 'cleanup', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  const allOk = steps.every(s => s.ok)
  console.log('[upload/test] complete in', Date.now() - start, 'ms, allOk=', allOk)
  return NextResponse.json({ ok: allOk, steps, total_ms: Date.now() - start }, { status: allOk ? 200 : 500 })
}
