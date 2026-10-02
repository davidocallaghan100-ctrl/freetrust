export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioProvider, type ComposioProvider } from '@/lib/integrations/composioCatalog'
import {
  composioErrorResponse,
  connectMemberComposioIntegration,
  disconnectMemberComposioIntegration,
  getMemberComposioIntegrations,
} from '@/lib/integrations/composioServer'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const providers = await getMemberComposioIntegrations(user.id)
    return NextResponse.json({ success: true, configured: Boolean(process.env.COMPOSIO_API_KEY), providers })
  } catch (error) {
    const response = composioErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null) as { action?: unknown; provider?: unknown } | null
    const action = typeof body?.action === 'string' ? body.action : ''
    const provider = typeof body?.provider === 'string' ? body.provider as ComposioProvider : null
    if (!provider || !getComposioProvider(provider)) {
      return NextResponse.json({ success: false, error: 'unsupported_provider' }, { status: 400 })
    }

    if (action === 'connect') {
      const result = await connectMemberComposioIntegration(user.id, provider)
      return NextResponse.json({ success: true, ...result })
    }
    if (action === 'disconnect') {
      const result = await disconnectMemberComposioIntegration(user.id, provider)
      return NextResponse.json({ success: true, ...result })
    }
    return NextResponse.json({ success: false, error: 'unsupported_action' }, { status: 400 })
  } catch (error) {
    const response = composioErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
