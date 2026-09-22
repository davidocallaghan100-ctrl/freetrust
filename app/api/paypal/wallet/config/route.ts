import { NextResponse } from 'next/server'
import { getPayPalEnvironment, isPayPalWalletAvailable } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    enabled: isPayPalWalletAvailable(),
    environment: getPayPalEnvironment(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
