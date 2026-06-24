export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { GifResult } from '@/lib/gifs'

const FALLBACK_GIFS: Array<GifResult & { tags: string[] }> = [
  { id: '3oEjHAUOqG3lSS0f1C', title: 'Funny laugh', url: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif', previewUrl: 'https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/3oEjHAUOqG3lSS0f1C', tags: ['funny', 'laugh', 'lol', 'haha'] },
  { id: 'l0HlvtIPzPdt2usKs', title: 'Sure Jan', url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', previewUrl: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/l0HlvtIPzPdt2usKs', tags: ['funny', 'side eye', 'sure', 'reaction'] },
  { id: '26n6Gx9moCgs1pUuk', title: 'Happy dance', url: 'https://media.giphy.com/media/26n6Gx9moCgs1pUuk/giphy.gif', previewUrl: 'https://media.giphy.com/media/26n6Gx9moCgs1pUuk/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/26n6Gx9moCgs1pUuk', tags: ['happy', 'dance', 'celebrate', 'funny'] },
  { id: 'xT9IgG50Fb7Mi0prBC', title: 'Mind blown', url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', previewUrl: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/xT9IgG50Fb7Mi0prBC', tags: ['wow', 'mind blown', 'reaction', 'funny'] },
  { id: '5GoVLqeAOo6PK', title: 'Excited', url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', previewUrl: 'https://media.giphy.com/media/5GoVLqeAOo6PK/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/5GoVLqeAOo6PK', tags: ['excited', 'yes', 'celebrate', 'funny'] },
  { id: 'artj92V8o75VPL7AeQ', title: 'This is fine', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/artj92V8o75VPL7AeQ', tags: ['funny', 'fine', 'chaos', 'reaction'] },
  { id: '11ISwbgCxEzMyY', title: 'Applause', url: 'https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif', previewUrl: 'https://media.giphy.com/media/11ISwbgCxEzMyY/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/11ISwbgCxEzMyY', tags: ['clap', 'applause', 'bravo', 'reaction'] },
  { id: '3o7abldj0b3rxrZUxW', title: 'Nope', url: 'https://media.giphy.com/media/3o7abldj0b3rxrZUxW/giphy.gif', previewUrl: 'https://media.giphy.com/media/3o7abldj0b3rxrZUxW/200w.gif', width: 480, height: 270, source: 'curated', pageUrl: 'https://giphy.com/gifs/3o7abldj0b3rxrZUxW', tags: ['nope', 'no', 'reaction', 'funny'] },
]

function fallbackResults(query: string, limit: number): GifResult[] {
  const q = query.toLowerCase().trim()
  const ranked = q
    ? FALLBACK_GIFS.filter(gif => `${gif.title} ${gif.tags.join(' ')}`.toLowerCase().includes(q))
    : FALLBACK_GIFS
  const pool = ranked.length > 0 ? ranked : FALLBACK_GIFS
  return pool.slice(0, limit).map(({ tags: _tags, ...gif }) => gif)
}

function imageDim(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function mapGiphyItem(item: any): GifResult | null {
  const images = item?.images ?? {}
  const full = images.original ?? images.downsized_large ?? images.fixed_height
  const preview = images.fixed_width_small ?? images.fixed_width ?? images.downsized ?? full
  const url = typeof full?.url === 'string' ? full.url : null
  const previewUrl = typeof preview?.url === 'string' ? preview.url : url
  if (!item?.id || !url || !previewUrl) return null
  return {
    id: String(item.id),
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'GIF',
    url,
    previewUrl,
    width: imageDim(full?.width),
    height: imageDim(full?.height),
    source: 'giphy',
    pageUrl: typeof item.url === 'string' ? item.url : null,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().slice(0, 80)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 16) || 16, 4), 24)
  const key = process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY

  if (key) {
    try {
      const endpoint = q ? 'search' : 'trending'
      const url = new URL(`https://api.giphy.com/v1/gifs/${endpoint}`)
      url.searchParams.set('api_key', key)
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('rating', 'pg-13')
      if (q) url.searchParams.set('q', q)
      const res = await fetch(url, { next: { revalidate: 300 } })
      if (res.ok) {
        const data = await res.json() as { data?: any[] }
        const gifs = (data.data ?? []).map(mapGiphyItem).filter((gif): gif is GifResult => Boolean(gif))
        if (gifs.length > 0) return NextResponse.json({ gifs, provider: 'giphy' })
      }
    } catch (err) {
      console.warn('[api/gifs] giphy fallback:', err)
    }
  }

  return NextResponse.json({ gifs: fallbackResults(q, limit), provider: 'curated' })
}
