import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Shared icon responder used by all sized icon routes.
// The source assets are generated from the current FreeTrust mobile app logo:
// a luminous white trust-knot mark on emerald green + dark sky-blue.
export async function buildIcon(size: number) {
  const iconPath = path.join(process.cwd(), 'public', 'icons', `icon-${size}x${size}.png`)
  const icon = await readFile(iconPath)

  return new Response(icon, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
