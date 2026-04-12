import { buildIcon } from '@/lib/pwa/icon-builder'

export const runtime = 'edge'
export async function GET() {
  return buildIcon(16)
}
