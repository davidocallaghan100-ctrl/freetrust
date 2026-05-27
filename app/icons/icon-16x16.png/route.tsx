import { buildIcon } from '@/lib/pwa/icon-builder'

export const runtime = 'nodejs'
export async function GET() {
  return buildIcon(16)
}
