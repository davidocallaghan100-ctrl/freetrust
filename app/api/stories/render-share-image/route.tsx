export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

// satori (the renderer behind next/og's ImageResponse) only supports
// PNG/JPEG/GIF/SVG images and throws "Image size cannot be determined" for
// anything else (notably WEBP — which is exactly what a lot of FreeTrust
// avatar/org-logo uploads use). A HEAD request against the real
// content-type is more reliable than trusting the file extension, and lets
// us skip unsupported images gracefully (falling back to an initials
// avatar / no cover image) instead of 500ing the whole share flow.
const SATORI_SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'])

// Post content/title can carry FreeTrust's internal composer markers (e.g.
// embedded Spotify track data, multi-photo URL lists, text-overlay specs —
// see the same regexes duplicated in components/PostCard.tsx and
// app/feed/[id]/page.tsx). Strip them here too so a shared post's rendered
// image never shows raw `[[FT_SPOTIFY:...]]`-style marker text.
const MEDIA_URLS_MARKER_RE = /\n?\n?\[\[FT_MEDIA_URLS:([A-Za-z0-9_-]+)\]\]/
const SPOTIFY_MARKER_RE = /\n?\n?\[\[FT_SPOTIFY:([A-Za-z0-9_-]+)\]\]/
const TEXT_OVERLAY_MARKER_RE = /\n?\n?\[\[FT_TEXT_OVERLAY:([A-Za-z0-9_-]+)\]\]/

function stripInternalMarkers(text: string | null | undefined): string {
  return text?.replace(MEDIA_URLS_MARKER_RE, '').replace(SPOTIFY_MARKER_RE, '').replace(TEXT_OVERLAY_MARKER_RE, '').trimEnd() ?? ''
}


async function isSatoriRenderableImage(url: string | null | undefined): Promise<boolean> {
  if (!url) return false
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) return false
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    return SATORI_SUPPORTED_IMAGE_TYPES.has(contentType)
  } catch {
    return false
  }
}

// GET /api/stories/render-share-image?post_id=<uuid>
// Renders a branded 1080x1920 story-format PNG for a feed post, for use by
// the "Share to Instagram Stories" flow in components/PostCard.tsx. Any
// authenticated user who can see the post may render an image for it —
// mirrors the visibility rule used by share_post_as_story() (no ownership
// check on the original post, since sharing doesn't require authoring it).
//
// The client fetches this with credentials (cookies) for the iOS
// clipboard-write + generic-download paths. For the Android Instagram
// intent path, the client instead uploads the resulting blob to the public
// `stories` storage bucket first and passes THAT public URL to the intent —
// the Instagram app fetches interactive_asset_uri without any session
// cookies, so it must be a publicly reachable URL, not this authed route.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const postId = req.nextUrl.searchParams.get('post_id')
    if (!postId) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    const { data: post, error: postError } = await supabase
      .from('feed_posts')
      .select('id, type, title, content, media_url, media_type, posted_as_organisation_id, user_id')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    let authorName = 'FreeTrust member'
    let authorAvatarUrl: string | null = null

    if (post.posted_as_organisation_id) {
      const { data: org } = await supabase
        .from('organisations')
        .select('name, logo_url')
        .eq('id', post.posted_as_organisation_id)
        .single()
      if (org) {
        authorName = org.name
        authorAvatarUrl = org.logo_url
      }
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', post.user_id)
        .single()
      if (profile) {
        authorName = profile.full_name || authorName
        authorAvatarUrl = profile.avatar_url
      }
    }

    const rawText: string = stripInternalMarkers(post.title || post.content)
    const displayText = rawText.length > 220 ? `${rawText.slice(0, 220)}…` : rawText
    const isPhotoOrVideo = (post.media_type === 'image' || post.media_type === 'video') && !!post.media_url
    const candidateCoverImage = isPhotoOrVideo && post.media_type === 'image' ? post.media_url : null

    // Probe both candidate images in parallel and drop any satori can't
    // render, rather than letting a WEBP/AVIF upload crash the whole route.
    const [coverImageOk, avatarImageOk] = await Promise.all([
      isSatoriRenderableImage(candidateCoverImage),
      isSatoriRenderableImage(authorAvatarUrl),
    ])
    const coverImage = coverImageOk ? candidateCoverImage : null
    const renderableAvatarUrl = avatarImageOk ? authorAvatarUrl : null

    const image = new ImageResponse(
      (
        <div
          style={{
            width: '1080px',
            height: '1920px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(160deg, #020617 0%, #0f172a 55%, #082f49 100%)',
            padding: '90px 80px',
            fontFamily: 'sans-serif',
            color: '#f8fafc',
            position: 'relative',
          }}
        >
          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #38bdf8, #22d3ee)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '34px',
                fontWeight: 900,
                color: '#020617',
              }}
            >
              F
            </div>
            <div style={{ fontSize: '38px', fontWeight: 900, letterSpacing: '0.01em' }}>FreeTrust</div>
          </div>

          {/* Optional cover image */}
          {coverImage ? (
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '760px',
                borderRadius: '32px',
                overflow: 'hidden',
                border: '2px solid rgba(56,189,248,0.35)',
                marginTop: '40px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : null}

          {/* Post excerpt */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '28px',
              marginTop: coverImage ? '48px' : '0px',
              flex: 1,
              justifyContent: coverImage ? 'flex-start' : 'center',
            }}
          >
            <div
              style={{
                fontSize: displayText.length > 140 ? '46px' : '58px',
                fontWeight: 800,
                lineHeight: 1.35,
                color: '#f8fafc',
              }}
            >
              {displayText || 'Shared from FreeTrust'}
            </div>
          </div>

          {/* Author + footer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {renderableAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={renderableAvatarUrl}
                  alt=""
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(56,189,248,0.5)' }}
                />
              ) : (
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'rgba(56,189,248,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '30px',
                    fontWeight: 800,
                    color: '#38bdf8',
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: '34px', fontWeight: 700, color: '#e2e8f0' }}>{authorName}</div>
            </div>
            <div style={{ fontSize: '28px', color: '#94a3b8', fontWeight: 600 }}>See the full post on FreeTrust — the Trust Community Economy</div>
          </div>
        </div>
      ),
      { width: 1080, height: 1920 }
    )

    return image
  } catch (err) {
    console.error('[GET /api/stories/render-share-image]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
