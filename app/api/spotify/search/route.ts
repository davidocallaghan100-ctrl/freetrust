export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePreviewUrl, type PreviewSource } from '@/lib/music/itunes-preview'

type SpotifyTrack = {
  id: string
  name: string
  artists: string
  album: string | null
  image: string | null
  url: string
  uri: string
  durationMs: number
  previewUrl: string | null
  previewSource: PreviewSource
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[spotify/search] token request failed:', res.status, text.slice(0, 300))
    return null
  }

  const data = await res.json() as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000,
  }
  return cachedToken.value
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 2) {
      return NextResponse.json({ tracks: [], configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) })
    }

    const token = await getSpotifyToken()
    if (!token) {
      return NextResponse.json({
        tracks: [],
        configured: false,
        error: 'Spotify track search is not configured yet. Paste a Spotify track URL instead.',
      })
    }

    const params = new URLSearchParams({ q, type: 'track', limit: '8', market: 'IE' })
    const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[spotify/search] search failed:', res.status, text.slice(0, 300))
      return NextResponse.json({ tracks: [], configured: true, error: 'Spotify search failed' }, { status: 502 })
    }

    const data = await res.json() as {
      tracks?: { items?: Array<{
        id: string
        name: string
        uri: string
        duration_ms: number
        external_urls?: { spotify?: string }
        preview_url?: string | null
        artists?: Array<{ name?: string }>
        album?: { name?: string; images?: Array<{ url?: string; width?: number; height?: number }> }
      }> }
    }

    const tracks: SpotifyTrack[] = await Promise.all((data.tracks?.items ?? []).map(async track => {
      const images = track.album?.images ?? []
      const image = images.find(img => (img.width ?? 0) >= 300)?.url ?? images[0]?.url ?? null
      const artists = (track.artists ?? []).map(a => a.name).filter(Boolean).join(', ') || 'Unknown artist'
      const resolved = await resolvePreviewUrl(track.preview_url, track.name, artists)
      return {
        id: track.id,
        name: track.name,
        artists,
        album: track.album?.name ?? null,
        image,
        url: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
        uri: track.uri,
        durationMs: track.duration_ms,
        previewUrl: resolved.previewUrl,
        previewSource: resolved.previewSource,
      }
    }))

    return NextResponse.json({ tracks, configured: true }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[spotify/search]', message)
    return NextResponse.json({ tracks: [], configured: false, error: 'Spotify search failed' }, { status: 500 })
  }
}
