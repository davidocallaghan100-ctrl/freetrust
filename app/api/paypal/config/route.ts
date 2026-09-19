import { NextResponse } from 'next/server'
import { getPayPalEnvironment, isPayPalAvailable } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

export async function GET() {
  const enabled = isPayPalAvailable()
  return NextResponse.json({
    enabled,
    environment: enabled ? getPayPalEnvironment() : null,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
