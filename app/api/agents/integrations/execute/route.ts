export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composioErrorResponse, executeMemberComposioAgentTool } from '@/lib/integrations/composioServer'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null) as {
      toolSlug?: unknown
      arguments?: unknown
    } | null
    const toolSlug = typeof body?.toolSlug === 'string' ? body.toolSlug.trim() : ''
    const args = body?.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments)
      ? body.arguments as Record<string, unknown>
      : null

    if (!toolSlug || !/^[A-Z0-9_]{2,120}$/.test(toolSlug)) return NextResponse.json({ success: false, error: 'invalid_tool' }, { status: 400 })
    if (!args) return NextResponse.json({ success: false, error: 'arguments_required' }, { status: 400 })

    const result = await executeMemberComposioAgentTool(user.id, toolSlug, args)
    return NextResponse.json({
      success: true,
      tool: result.run,
      data: result.data,
    })
  } catch (error) {
    const response = composioErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
