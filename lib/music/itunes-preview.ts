type ItunesSearchResult = {
  resultCount?: number
  results?: Array<{
    wrapperType?: string
    kind?: string
    artistName?: string
    trackName?: string
    previewUrl?: string
  }>
}

export type PreviewSource = 'spotify' | 'itunes' | null

const previewCache = new Map<string, string | null>()

function normaliseForMatch(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function splitArtists(artists: string) {
  return artists
    .split(/,|&|\band\b|feat\.?|ft\.?/i)
    .map(normaliseForMatch)
    .filter(Boolean)
}

function isConfidentMatch(trackName: string, artists: string, candidate: NonNullable<ItunesSearchResult['results']>[number]) {
  const expectedTitle = normaliseForMatch(trackName)
  const candidateTitle = normaliseForMatch(candidate.trackName)
  if (!expectedTitle || !candidateTitle || expectedTitle !== candidateTitle) return false

  const expectedArtists = splitArtists(artists)
  const candidateArtist = normaliseForMatch(candidate.artistName)
  if (!candidateArtist || expectedArtists.length === 0) return false

  return expectedArtists.some(artist => artist === candidateArtist || candidateArtist.includes(artist) || artist.includes(candidateArtist))
}

export async function findItunesPreviewUrl(trackName: string, artists: string, country = 'IE') {
  const cacheKey = `${country}:${normaliseForMatch(trackName)}:${normaliseForMatch(artists)}`
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey) ?? null

  try {
    const params = new URLSearchParams({
      term: `${trackName} ${artists}`,
      media: 'music',
      entity: 'song',
      limit: '5',
      country,
    })
    const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`iTunes search failed with ${res.status}`)
    const data = await res.json() as ItunesSearchResult
    const match = (data.results ?? []).find(item => (
      item.kind === 'song'
      && typeof item.previewUrl === 'string'
      && /^https?:\/\//i.test(item.previewUrl)
      && isConfidentMatch(trackName, artists, item)
    ))
    const previewUrl = match?.previewUrl ?? null
    previewCache.set(cacheKey, previewUrl)
    return previewUrl
  } catch (err) {
    console.warn('[itunes-preview] lookup failed:', err instanceof Error ? err.message : String(err))
    previewCache.set(cacheKey, null)
    return null
  }
}

export async function resolvePreviewUrl(spotifyPreviewUrl: string | null | undefined, trackName: string, artists: string) {
  if (typeof spotifyPreviewUrl === 'string' && spotifyPreviewUrl.startsWith('http')) {
    return { previewUrl: spotifyPreviewUrl, previewSource: 'spotify' as PreviewSource }
  }
  const fallback = await findItunesPreviewUrl(trackName, artists)
  return { previewUrl: fallback, previewSource: fallback ? 'itunes' as PreviewSource : null }
}
