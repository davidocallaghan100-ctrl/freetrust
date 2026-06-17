'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import SocialLinks from '@/components/social/SocialLinks'
import MessageDrawer from '@/components/profile/MessageDrawer'
import SellerOTIFBadge from '@/components/marketplace/SellerOTIFBadge'
import {
  GRASSROOTS_CATEGORIES_BY_SLUG,
  AVAILABILITY_BY_VALUE,
  GRASSROOTS_GREEN,
} from '@/lib/grassroots/categories'
import type { User } from '@supabase/supabase-js'
import ActivityFeed, { type ActivityItem as CreatedItem } from '@/components/profile/ActivityFeed'
import PostCard, { type FeedPost } from '@/components/PostCard'
import { trackEventOnce } from '@/lib/analytics'

interface Profile {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  cover_position_x?: number | null
  cover_position_y?: number | null
  cover_rotation?: number | null
  cover_scale?: number | null
  location?: string | null
  website?: string | null
  trust_balance?: number | null
  follower_count?: number | null
  following_count?: number | null
  created_at?: string | null
  // Hobbies text[] — added by 20260414000000_profiles_hobbies.sql.
  // Shown on the public profile as pill chips (only when non-empty).
  hobbies?: string[] | null
  // Social link fields (20260413_profiles_social_links.sql)
  linkedin_url?:  string | null
  instagram_url?: string | null
  twitter_url?:   string | null
  github_url?:    string | null
  tiktok_url?:    string | null
  youtube_url?:   string | null
  website_url?:   string | null
  // Stripe Connect onboarding flags — either one being true counts
  // as "onboarded" for the paid-listing gate. stripe_onboarded is
  // the legacy name, stripe_onboarding_complete is the canonical
  // name post 20260416000003_escrow_columns.sql. A DB trigger keeps
  // them in sync.
  stripe_account_id?:          string | null
  stripe_onboarded?:           boolean | null
  stripe_onboarding_complete?: boolean | null
  // VAT / accounting fields (20260419000006_seller_accounting.sql)
  vat_registered?: boolean | null
  vat_number?:     string | null
  is_verified?: boolean | null
  verified_at?: string | null
  verification_status?: string | null
  profile_verification_status?: string | null
  profile_identity_verified_at?: string | null
  verification_submitted_at?: string | null
  verification_details?: { note?: string | null; [key: string]: unknown } | null
  professional_headline?: string | null
  professional_experience?: ProfessionalExperienceEntry[] | null
}

interface ProfessionalExperienceEntry {
  role?: string | null
  organization?: string | null
  period?: string | null
  description?: string | null
}

// Map of preset hobby label → emoji icon. Kept in sync with the
// HOBBIES list in app/onboarding/page.tsx. Custom hobbies (anything
// not in this map) render as a text pill with no icon.
const HOBBY_ICONS: Record<string, string> = {
  'Music':            '🎵',
  'Art':              '🎨',
  'Fitness':          '🏃',
  'Reading':          '📚',
  'Cooking':          '🍳',
  'Gardening':        '🌱',
  'Travel':           '✈️',
  'Gaming':           '🎮',
  'Animals':          '🐾',
  'Tech':             '💻',
  'Theatre':          '🎭',
  'Photography':      '📸',
  'Outdoors':         '🏄',
  'Wellness':         '🧘',
  'Volunteering':     '🤝',
  'Entrepreneurship': '💼',
}

interface ActivityItem {
  id: string
  type: 'post' | 'article' | 'service' | 'product' | 'event' | 'community' | 'review' | 'milestone'
  title: string
  subtitle?: string
  href?: string
  created_at: string
  meta?: string
}

interface ServiceListing {
  id: string
  title: string
  description?: string | null
  price: number
  currency?: string | null
  service_mode?: string | null
  tags?: string[] | null
  avg_rating?: number | null
  review_count?: number | null
  created_at: string
}

interface ProductListing {
  id: string
  title: string
  description?: string | null
  price: number | null
  currency?: string | null
  product_type?: string | null
  cover_image?: string | null
  images?: string[] | null
  stock_qty?: number | null
  avg_rating?: number | null
  review_count?: number | null
  created_at: string
}

interface GrassrootsListing {
  id: string
  title: string
  description: string | null
  category: string
  listing_type: 'offering' | 'seeking'
  rate: number | null
  rate_type: 'hourly' | 'daily' | 'fixed' | 'negotiable' | null
  currency_code: string | null
  rate_eur: number | null
  availability: 'immediate' | 'this_week' | 'this_month' | 'flexible'
  photos: string[] | null
  city: string | null
  location_label: string | null
  trust_tokens_accepted: boolean
  created_at: string
}

interface ConnectionProfile {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  location?: string | null
}

type ProfileTab = 'overview' | 'trust' | 'services' | 'products' | 'grassroots' | 'posts' | 'activity' | 'following' | 'followers'

type CoverSettings = {
  positionX: number
  positionY: number
  rotation: number
  scale: number
}

const DEFAULT_COVER_SETTINGS: CoverSettings = {
  positionX: 50,
  positionY: 50,
  rotation: 0,
  scale: 1,
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function normalizeRotation(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 0
  const roundedToQuarterTurn = Math.round(numeric / 90) * 90
  return ((roundedToQuarterTurn % 360) + 360) % 360
}

function getCoverSettingsFromProfile(profile: Profile | null | undefined): CoverSettings {
  return {
    positionX: clampNumber(profile?.cover_position_x, 0, 100, DEFAULT_COVER_SETTINGS.positionX),
    positionY: clampNumber(profile?.cover_position_y, 0, 100, DEFAULT_COVER_SETTINGS.positionY),
    rotation: normalizeRotation(profile?.cover_rotation),
    scale: clampNumber(profile?.cover_scale, 1, 2, DEFAULT_COVER_SETTINGS.scale),
  }
}

function getCoverImageStyle(settings: CoverSettings) {
  const rotation = normalizeRotation(settings.rotation)
  const needsQuarterTurnCompensation = rotation === 90 || rotation === 270
  const renderScale = clampNumber(settings.scale, 1, 2, 1) * (needsQuarterTurnCompensation ? 1.35 : 1)
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    objectPosition: `${clampNumber(settings.positionX, 0, 100, 50)}% ${clampNumber(settings.positionY, 0, 100, 50)}%`,
    transform: `rotate(${rotation}deg) scale(${renderScale})`,
    transformOrigin: 'center center',
    transition: 'transform 0.2s ease, object-position 0.2s ease',
  }
}

function getTrustLevel(balance: number) {
  if (balance >= 5000) return { label: 'FreeTrust Ambassador', icon: '👑', color: '#f59e0b', nextAt: null,  next: 'Max level reached' }
  if (balance >= 1000) return { label: 'Community Leader',    icon: '🏆', color: '#a78bfa', nextAt: 5000, next: 'Ambassador at ₮5000' }
  if (balance >= 500)  return { label: 'Active Member',       icon: '✅', color: '#34d399', nextAt: 1000, next: 'Leader at ₮1000' }
  if (balance >= 100)  return { label: 'Trusted Member',      icon: '⭐', color: '#38bdf8', nextAt: 500,  next: 'Active at ₮500' }
  return                      { label: 'New Member',          icon: '🌱', color: '#94a3b8', nextAt: 100,  next: 'Trusted at ₮100' }
}

function isProfileVerified(profile: Profile | null | undefined) {
  return profile?.profile_verification_status === 'verified'
}

function verificationLabel(profile: Profile | null | undefined) {
  if (isProfileVerified(profile)) return 'Verified profile'
  if (profile?.verification_status === 'submitted') return 'Verification submitted'
  return 'Not verified yet'
}

function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Profile details verified by FreeTrust"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 5,
        padding: compact ? '1px 6px' : '0.18rem 0.65rem',
        borderRadius: 999,
        background: 'rgba(52,211,153,0.12)',
        border: '1px solid rgba(52,211,153,0.35)',
        color: '#34d399',
        fontSize: compact ? '0.68rem' : '0.76rem',
        fontWeight: 800,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      ✓{!compact && ' Verified'}
    </span>
  )
}

function normaliseExperience(raw: unknown): ProfessionalExperienceEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(entry => {
      const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      return {
        role: typeof item.role === 'string' ? item.role : '',
        organization: typeof item.organization === 'string' ? item.organization : '',
        period: typeof item.period === 'string' ? item.period : '',
        description: typeof item.description === 'string' ? item.description : '',
      }
    })
    .filter(entry => entry.role || entry.organization || entry.description)
}

function experienceToText(entries: ProfessionalExperienceEntry[] | null | undefined) {
  return normaliseExperience(entries).map(entry => {
    const title = [entry.role, entry.organization].filter(Boolean).join(' @ ')
    const period = entry.period ? ` (${entry.period})` : ''
    const description = entry.description ? ` — ${entry.description}` : ''
    return `${title}${period}${description}`.trim()
  }).join('\n')
}

function parseExperienceText(value: string): ProfessionalExperienceEntry[] {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map(line => {
      const [left, ...descriptionParts] = line.split(' — ')
      const description = descriptionParts.join(' — ').trim()
      const periodMatch = left.match(/\(([^)]+)\)\s*$/)
      const period = periodMatch?.[1]?.trim() ?? ''
      const withoutPeriod = periodMatch ? left.slice(0, periodMatch.index).trim() : left.trim()
      const [rolePart, ...orgParts] = withoutPeriod.split(' @ ')
      return {
        role: rolePart.trim(),
        organization: orgParts.join(' @ ').trim(),
        period,
        description,
      }
    })
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function calcCompleteness(profile: Profile | null, email: string | null): { pct: number; missing: string[] } {
  if (!profile) return { pct: 0, missing: ['Full name', 'Bio', 'Avatar', 'Location', 'Website'] }
  const checks = [
    { label: 'Full name', done: !!profile.full_name },
    { label: 'Bio', done: !!profile.bio },
    { label: 'Profile photo', done: !!profile.avatar_url },
    { label: 'Cover photo', done: !!profile.cover_url },
    { label: 'Location', done: !!profile.location },
    { label: 'Website', done: !!profile.website },
  ]
  const done = checks.filter(c => c.done).length
  const missing = checks.filter(c => !c.done).map(c => c.label)
  return { pct: Math.round((done / checks.length) * 100), missing }
}

const MEDIA_URLS_MARKER_RE = /\n?\n?\[\[FT_MEDIA_URLS:([A-Za-z0-9_-]+)\]\]/

function decodeBase64UrlJson<T>(encoded: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)
    const binary = window.atob(padded)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

function decodeMediaUrlsFromPostContent(text: string | null | undefined) {
  const encoded = text?.match(MEDIA_URLS_MARKER_RE)?.[1]
  if (!encoded) return [] as string[]
  const parsed = decodeBase64UrlJson<unknown>(encoded)
  if (!Array.isArray(parsed)) return [] as string[]
  return parsed.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)).slice(0, 10)
}

function getPhotoUrlsFromPost(post: FeedPost) {
  const fromMetadata = Array.isArray(post.metadata?.media_urls)
    ? post.metadata.media_urls.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value))
    : []
  const urls = [
    ...fromMetadata,
    ...decodeMediaUrlsFromPostContent(post.content),
    post.media_url,
  ].filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value))
  return Array.from(new Set(urls)).slice(0, 10)
}

export default function ProfilePage() {
  // IMPORTANT: createClient() must be called once per mount, not on every render.
  // Calling createBrowserClient on each render creates new auth listener instances
  // which can fire repeated onAuthStateChange events → state updates → re-renders
  // → more listeners → infinite loop. A ref ensures a single stable client.
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const searchParams = useSearchParams()
  const router = useRouter()
  const viewingId = searchParams.get('id') // null = own profile
  const lastInitIdRef = useRef<string | null | undefined>(undefined)
  const bonusAttemptedRef = useRef(false)

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  // Save-error state — previously handleSave's catch just called
  // console.error, so RLS denials / missing columns / trigger failures
  // were invisible to the user (they clicked Save and "nothing happened").
  // Surfaced as a red banner above the Save button when set.
  const [saveError, setSaveError] = useState<string | null>(null)
  const [trustBalance, setTrustBalance] = useState(0)
  const [buyingCount, setBuyingCount] = useState<number | null>(null)
  const [sellingCount, setSellingCount] = useState<number | null>(null)
  const [form, setForm] = useState({
    full_name: '', bio: '', location: '', website: '',
    linkedin_url: '', instagram_url: '', twitter_url: '', github_url: '',
    tiktok_url: '', youtube_url: '', website_url: '',
    professional_headline: '', professional_experience_text: '', verification_details_text: '',
  })
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverSettings, setCoverSettings] = useState<CoverSettings>(DEFAULT_COVER_SETTINGS)
  const [coverSettingsSaving, setCoverSettingsSaving] = useState(false)
  const [coverHover, setCoverHover] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [services, setServices] = useState<ServiceListing[]>([])
  const [showAllServices, setShowAllServices] = useState(false)
  const [products, setProducts] = useState<ProductListing[]>([])
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [grassroots, setGrassroots] = useState<GrassrootsListing[]>([])
  const [showAllGrassroots, setShowAllGrassroots] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
  const [followers, setFollowers] = useState<ConnectionProfile[]>([])
  const [following, setFollowing] = useState<ConnectionProfile[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [connectionsLoaded, setConnectionsLoaded] = useState(false)
  // Unified activity feed (jobs + listings + events + reviews)
  const [activityFeedItems, setActivityFeedItems] = useState<CreatedItem[]>([])
  const [activityFeedLoading, setActivityFeedLoading] = useState(false)
  const [activityFeedLoaded, setActivityFeedLoaded] = useState(false)
  const [profilePosts, setProfilePosts] = useState<FeedPost[]>([])
  const [profilePostsLoading, setProfilePostsLoading] = useState(false)
  const [profilePostsLoaded, setProfilePostsLoaded] = useState(false)
  const [profilePhotoGridPosts, setProfilePhotoGridPosts] = useState<FeedPost[]>([])
  const [profilePhotoGridLoading, setProfilePhotoGridLoading] = useState(false)
  const [profilePhotoGridLoaded, setProfilePhotoGridLoaded] = useState(false)
  const [bonusAwarded, setBonusAwarded] = useState(false)
  const [toast, setToast] = useState('')
  const [isOwnProfile, setIsOwnProfile] = useState(true)
  const [sessionRestoreSuspected, setSessionRestoreSuspected] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  // Message drawer — opens inline on top of the profile instead of
  // routing to /messages/[id]. The routing-based approach had a
  // persistent production issue where clicking Message would end
  // up on /messages (inbox) instead of the direct conversation.
  // Opening inline bypasses every routing-layer failure mode.
  const [drawerOpen, setDrawerOpen] = useState(false)
  // VAT settings state — own profile only
  const [vatRegistered, setVatRegistered] = useState(false)
  const [vatNumber, setVatNumber] = useState('')
  const [vatSaving, setVatSaving] = useState(false)
  const [vatSaved, setVatSaved] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  // Ref on the edit form's outer card so we can scroll it into view
  // when the user clicks Edit. Without this, the form renders ~830px
  // below the Edit button (below the cover photo, avatar block,
  // social links, completeness bar, and Trust Economy card) — on
  // any laptop viewport < 900px tall or any mobile viewport, the
  // form is off-screen when the button is clicked. The user sees
  // the button flip to "Cancel" but no form, so it looks broken.
  // See the scroll-into-view useEffect below.
  const editFormRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .is('deleted_at', null)
        .single()
      if (prof) {
        let loadedProfile = prof as Profile
        const { data: badge, error: badgeError } = await supabase
          .from('profile_verification_badges')
          .select('status, verified_at')
          .eq('user_id', userId)
          .maybeSingle()
        if (!badgeError && badge) {
          loadedProfile = {
            ...loadedProfile,
            profile_verification_status: (badge as { status?: string | null }).status ?? null,
            profile_identity_verified_at: (badge as { verified_at?: string | null }).verified_at ?? null,
          }
        }
        setProfile(loadedProfile)
        setCoverSettings(getCoverSettingsFromProfile(loadedProfile))
        setForm({
          full_name: loadedProfile.full_name ?? '',
          bio: loadedProfile.bio ?? '',
          location: loadedProfile.location ?? '',
          website: loadedProfile.website ?? '',
          linkedin_url:  loadedProfile.linkedin_url  ?? '',
          instagram_url: loadedProfile.instagram_url ?? '',
          twitter_url:   loadedProfile.twitter_url   ?? '',
          github_url:    loadedProfile.github_url    ?? '',
          tiktok_url:    loadedProfile.tiktok_url    ?? '',
          youtube_url:   loadedProfile.youtube_url   ?? '',
          website_url:   loadedProfile.website_url   ?? '',
          professional_headline: loadedProfile.professional_headline ?? '',
          professional_experience_text: experienceToText(loadedProfile.professional_experience),
          verification_details_text: loadedProfile.verification_details?.note ?? '',
        })
        setVatRegistered(!!(prof as Profile & { vat_registered?: boolean }).vat_registered)
        setVatNumber(String((prof as Profile & { vat_number?: string }).vat_number ?? ''))
      }
    } catch (err) {
      console.error('loadProfile error:', err)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrust = useCallback(async (userId?: string) => {
    try {
      if (userId) {
        // Another user's balance — read directly from trust_balances
        const { data } = await supabase
          .from('trust_balances')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle()
        setTrustBalance(data?.balance ?? 0)
      } else {
        // Own trust balance via API
        const res = await fetch('/api/trust')
        if (res.ok) {
          const data = await res.json() as { balance?: number }
          const bal = data.balance ?? 0
          setTrustBalance(bal)
          // If balance is still 0, the signup bonus may not have been awarded yet
          // (users who registered before the auth/callback fix). Claim it now.
          if (bal === 0 && !bonusAttemptedRef.current) {
            bonusAttemptedRef.current = true
            try {
              const bonusRes = await fetch('/api/auth/signup-bonus', { method: 'POST' })
              if (bonusRes.ok) {
                const bonusData = await bonusRes.json() as { balance?: number }
                if ((bonusData.balance ?? 0) > 0) setTrustBalance(bonusData.balance!)
              }
            } catch { /* non-critical */ }
          }
        }
      }
    } catch { /* silent */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadServices = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, title, description, price, currency, service_mode, tags, avg_rating, review_count, created_at')
        .eq('seller_id', userId)
        .eq('product_type', 'service')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setServices(data ?? [])
    } catch (err) {
      console.error('loadServices error:', err)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadProducts = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, title, description, price, currency, product_type, cover_image, images, stock_qty, avg_rating, review_count, created_at')
        .eq('seller_id', userId)
        .neq('product_type', 'service')
        .is('organisation_id', null)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setProducts((data ?? []) as ProductListing[])
    } catch (err) {
      console.error('loadProducts error:', err)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load this user's active grassroots listings. Cast to unknown[] then
  // GrassrootsListing[] because supabase-js generated types don't know
  // about grassroots_listings yet — same untyped-row pattern services use.
  const loadActivityFeed = useCallback(async (userId: string) => {
    if (activityFeedLoaded) return
    setActivityFeedLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}/activity?limit=30`)
      if (res.ok) {
        const data = await res.json() as { items?: CreatedItem[] }
        setActivityFeedItems(data.items ?? [])
        setActivityFeedLoaded(true)
      }
    } catch { /* non-critical */ } finally {
      setActivityFeedLoading(false)
    }
  }, [activityFeedLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfilePosts = useCallback(async (userId: string) => {
    if (profilePostsLoaded) return
    setProfilePostsLoading(true)
    try {
      const res = await fetch(`/api/feed/posts?authorId=${encodeURIComponent(userId)}&limit=12`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { posts?: FeedPost[] }
        setProfilePosts(data.posts ?? [])
        setProfilePostsLoaded(true)
      }
    } catch { /* non-critical */ } finally {
      setProfilePostsLoading(false)
    }
  }, [profilePostsLoaded])

  const loadProfilePhotoGrid = useCallback(async (userId: string) => {
    if (profilePhotoGridLoaded || profilePhotoGridLoading) return
    setProfilePhotoGridLoading(true)
    try {
      const res = await fetch(`/api/feed/posts?authorId=${encodeURIComponent(userId)}&filter=photos&limit=18`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { posts?: FeedPost[] }
        setProfilePhotoGridPosts((data.posts ?? []).filter(post => getPhotoUrlsFromPost(post).length > 0).slice(0, 18))
        setProfilePhotoGridLoaded(true)
      }
    } catch { /* non-critical */ } finally {
      setProfilePhotoGridLoading(false)
    }
  }, [profilePhotoGridLoaded, profilePhotoGridLoading])

  const loadConnections = useCallback(async (userId: string) => {
    if (connectionsLoaded || connectionsLoading) return
    setConnectionsLoading(true)
    try {
      const res = await fetch(`/api/connections?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { followers?: ConnectionProfile[]; following?: ConnectionProfile[] }
        setFollowers(data.followers ?? [])
        setFollowing(data.following ?? [])
        setFollowerCount(data.followers?.length ?? 0)
        setConnectionsLoaded(true)
      }
    } catch { /* non-critical */ } finally {
      setConnectionsLoading(false)
    }
  }, [connectionsLoaded, connectionsLoading])

  const loadGrassroots = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('grassroots_listings')
        .select('id, title, description, category, listing_type, rate, rate_type, currency_code, rate_eur, availability, photos, city, location_label, trust_tokens_accepted, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setGrassroots((data ?? []) as unknown as GrassrootsListing[])
    } catch (err) {
      console.error('loadGrassroots error:', err)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivity = useCallback(async (userId: string) => {
    setLoadingActivity(true)
    try {
      const items: ActivityItem[] = []

      // Feed posts
      const { data: posts } = await supabase
        .from('feed_posts')
        .select('id, content, type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (posts) {
        for (const p of posts) {
          items.push({
            id: `post-${p.id}`,
            type: 'post',
            title: (p.content as string | null)?.slice(0, 80) ?? 'Post',
            href: '/feed',
            created_at: p.created_at,
            meta: p.type,
          })
        }
      }

      // Articles
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (articles) {
        for (const a of articles) {
          items.push({
            id: `article-${a.id}`,
            type: 'article',
            title: a.title ?? 'Article',
            href: `/articles/${a.id}`,
            created_at: a.created_at,
          })
        }
      }

      // Services (product_type = 'service')
      const { data: serviceItems } = await supabase
        .from('listings')
        .select('id, title, created_at')
        .eq('seller_id', userId)
        .eq('product_type', 'service')
        .order('created_at', { ascending: false })
        .limit(2)
      if (serviceItems) {
        for (const s of serviceItems) {
          items.push({
            id: `service-${s.id}`,
            type: 'service',
            title: s.title ?? 'Service listing',
            href: `/services/${s.id}`,
            created_at: s.created_at,
          })
        }
      }

      // Products (product_type != 'service')
      const { data: productItems } = await supabase
        .from('listings')
        .select('id, title, created_at')
        .eq('seller_id', userId)
        .neq('product_type', 'service')
        .order('created_at', { ascending: false })
        .limit(2)
      if (productItems) {
        for (const p of productItems) {
          items.push({
            id: `product-${p.id}`,
            type: 'product',
            title: p.title ?? 'Product listing',
            href: `/services/${p.id}`,
            created_at: p.created_at,
          })
        }
      }

      // Events hosted
      const { data: events } = await supabase
        .from('events')
        .select('id, title, created_at')
        .eq('organiser_id', userId)
        .order('created_at', { ascending: false })
        .limit(2)
      if (events) {
        for (const e of events) {
          items.push({
            id: `event-${e.id}`,
            type: 'event',
            title: e.title ?? 'Event',
            href: `/events/${e.id}`,
            created_at: e.created_at,
          })
        }
      }

      // Communities joined
      const { data: memberships } = await supabase
        .from('community_members')
        .select('created_at, communities(id, name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (memberships) {
        for (const m of memberships) {
          const comm = (m.communities as unknown as { id: string; name: string } | null)
          items.push({
            id: `community-${m.created_at}`,
            type: 'community',
            title: `Joined ${comm?.name ?? 'community'}`,
            href: comm?.id ? `/community/${comm.id}` : '/community',
            created_at: m.created_at,
          })
        }
      }

      // Reviews received
      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (reviews) {
        for (const r of reviews) {
          items.push({
            id: `review-${r.id}`,
            type: 'review',
            title: `${r.rating}★ review received`,
            subtitle: (r.comment as string | null)?.slice(0, 60),
            created_at: r.created_at,
          })
        }
      }

      // Sort by date desc
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setActivity(items)
    } catch (err) {
      console.error('loadActivity error:', err)
    } finally {
      setLoadingActivity(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSupabaseCookie = () => (
    typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim().startsWith('sb-'))
  )

  // Safety net: if auth/profile loading is still stuck after 15 seconds, do
  // not drop signed-in users into the old anonymous "sign in" prompt. Mobile
  // browsers can be slow to restore Supabase cookies after OAuth redirects; if
  // we can see an sb-* cookie, show an explicit "restoring session" state with
  // retry controls instead of making the user think they must sign up again.
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasSupabaseCookie() && isOwnProfile) setSessionRestoreSuspected(true)
      setLoading(false)
    }, 15000)
    return () => clearTimeout(t)
  }, [isOwnProfile])

  useEffect(() => {
    if (lastInitIdRef.current === viewingId) {
      // Guard: the ref matched so we skip init, but if loading is still true
      // (e.g. component remounted and state reset) we must release it.
      setLoading(false)
      return
    }
    lastInitIdRef.current = viewingId
    setActiveTab('overview')
    setServices([])
    setProducts([])
    setGrassroots([])
    setActivity([])
    setProfilePosts([])
    setProfilePhotoGridPosts([])
    setFollowers([])
    setFollowing([])
    setActivityFeedItems([])
    setActivityFeedLoaded(false)
    setProfilePostsLoaded(false)
    setProfilePhotoGridLoaded(false)
    setProfilePhotoGridLoading(false)
    setConnectionsLoaded(false)

    const init = async () => {
      try {
        const getUserWithRetry = async () => {
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data: { user: currentUser }, error } = await supabase.auth.getUser()
            if (currentUser || error) return currentUser

            // Fallback through getSession() because immediately after an OAuth
            // redirect the browser cookie can exist before getUser() has a
            // network answer. If getSession() can decode a user, use it.
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) return session.user

            await new Promise(resolve => window.setTimeout(resolve, 500))
          }

          // Final fallback: ask the server to resolve the Supabase session from
          // request cookies. This covers OAuth/mobile cases where the server has
          // valid auth cookies but the browser client has not restored them yet.
          // Returning the server user prevents the own-profile page from showing
          // the anonymous "Sign in" state immediately after Google login.
          try {
            const res = await fetch('/api/profile', { cache: 'no-store' })
            if (res.ok) {
              const data = await res.json() as { user?: User | null; profile?: Profile | null }
              if (data.profile) {
                setProfile(data.profile)
                setCoverSettings(getCoverSettingsFromProfile(data.profile))
                setForm({
                  full_name: data.profile.full_name ?? '',
                  bio: data.profile.bio ?? '',
                  location: data.profile.location ?? '',
                  website: data.profile.website ?? '',
                  linkedin_url:  data.profile.linkedin_url  ?? '',
                  instagram_url: data.profile.instagram_url ?? '',
                  twitter_url:   data.profile.twitter_url   ?? '',
                  github_url:    data.profile.github_url    ?? '',
                  tiktok_url:    data.profile.tiktok_url    ?? '',
                  youtube_url:   data.profile.youtube_url   ?? '',
                  website_url:   data.profile.website_url   ?? '',
                  professional_headline: data.profile.professional_headline ?? '',
                  professional_experience_text: experienceToText(data.profile.professional_experience),
                  verification_details_text: data.profile.verification_details?.note ?? '',
                })
                setVatRegistered(!!data.profile.vat_registered)
                setVatNumber(String(data.profile.vat_number ?? ''))
              }
              if (data.user) return data.user
            }
          } catch { /* fall through to anonymous/recovery state */ }

          return null
        }

        const u = await getUserWithRetry()
        setUser(u)
        if (u) setSessionRestoreSuspected(false)

        if (viewingId && (!u || viewingId !== u.id)) {
          // Viewing someone else's profile
          setIsOwnProfile(false)
          await Promise.all([
            loadProfile(viewingId),
            loadTrust(viewingId),
          ])

          // Get real follower count and check if current user follows them
          const [countRes, followCheckRes] = await Promise.all([
            supabase
              .from('user_follows')
              .select('*', { count: 'exact', head: true })
              .eq('following_id', viewingId),
            u
              ? supabase
                  .from('user_follows')
                  .select('id')
                  .eq('follower_id', u.id)
                  .eq('following_id', viewingId)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ])
          setFollowerCount(countRes.count ?? 0)
          setIsFollowing(!!followCheckRes.data)
        } else if (u) {
          // Own profile
          setIsOwnProfile(true)
          await Promise.all([loadProfile(u.id), loadTrust()])

          // Real follower count from user_follows
          const { count } = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', u.id)
          setFollowerCount(count ?? 0)

          // Dual-role order counts
          const [buyRes, sellRes] = await Promise.all([
            supabase.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_id', u.id),
            supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', u.id),
          ])
          setBuyingCount(buyRes.count ?? 0)
          setSellingCount(sellRes.count ?? 0)
        } else if (!viewingId && !u && hasSupabaseCookie()) {
          // Own profile requested, auth cookie present, but user not restored.
          // Keep the UX in a recovery state instead of showing the anonymous
          // sign-in/signup prompt to someone who just signed in.
          setIsOwnProfile(true)
          setSessionRestoreSuspected(true)
        }
      } catch (err) {
        console.error('init error:', err)
        if (!viewingId && hasSupabaseCookie()) setSessionRestoreSuspected(true)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [viewingId]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayedProfileId = viewingId && (!user || viewingId !== user.id) ? viewingId : (user?.id ?? profile?.id ?? null)

  useEffect(() => {
    if (!displayedProfileId) return
    if (user?.id === displayedProfileId) return
    trackEventOnce(`profile-view-${displayedProfileId}`, {
      userId: displayedProfileId,
      eventType: 'profile_view',
      entityType: 'profile',
      entityId: displayedProfileId,
      metadata: { source: 'profile_page' },
    })
  }, [displayedProfileId, user?.id])

  useEffect(() => {
    if (!displayedProfileId) return
    if (activeTab === 'overview') void loadProfilePhotoGrid(displayedProfileId)
    if (activeTab === 'services' && services.length === 0) void loadServices(displayedProfileId)
    if (activeTab === 'products' && products.length === 0) void loadProducts(displayedProfileId)
    if (activeTab === 'grassroots' && grassroots.length === 0) void loadGrassroots(displayedProfileId)
    if (activeTab === 'posts') void loadProfilePosts(displayedProfileId)
    if (activeTab === 'activity' && activity.length === 0) void loadActivity(displayedProfileId)
    if ((activeTab === 'followers' || activeTab === 'following')) void loadConnections(displayedProfileId)
  }, [activeTab, displayedProfileId, services.length, products.length, grassroots.length, activity.length, loadServices, loadProducts, loadGrassroots, loadProfilePosts, loadProfilePhotoGrid, loadActivity, loadConnections])

  // Award ₮10 bonus when profile hits 100%
  useEffect(() => {
    const { pct } = calcCompleteness(profile, user?.email ?? null)
    if (pct === 100 && !bonusAwarded && user) {
      setBonusAwarded(true)
      ;(async () => {
        try {
          const r = await fetch('/api/trust/award', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 10, reason: 'Profile 100% complete' }),
          })
          if (r.ok) {
            showToast('🎉 +₮10 Trust awarded for completing your profile!')
            setTrustBalance(prev => prev + 10)
          }
        } catch { /* silent */ }
      })()
    }
  }, [profile, user, bonusAwarded])

  // Scroll the edit form into view when the user clicks Edit Profile.
  // Without this, the form renders ~830 px below the Edit button (cover
  // photo + profile header + social links + completeness bar + Trust
  // Economy card all sit above it) and users on any viewport smaller
  // than ~900 px see the button flip to "Cancel" but no form anywhere.
  // That was the reported "edit button not working" symptom.
  //
  // `block: 'start'` puts the top of the form near the top of the
  // viewport; the CSS `scrollMarginTop: 80px` on the ref element keeps
  // it clear of the fixed top nav. Behaviour: smooth scroll on user
  // action, not on initial mount.
  useEffect(() => {
    if (!editing) return
    // Defer one tick so the form has mounted before we scroll to it.
    // Without this, the ref can still be null on the frame the state
    // flip fires.
    const id = window.setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Auto-focus the first input so the user can start typing
      // immediately without an extra tap.
      const firstInput = editFormRef.current?.querySelector<HTMLInputElement>('input.profile-input')
      firstInput?.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(id)
  }, [editing])

  const handleSave = async () => {
    if (!user) {
      setSaveError('You are not signed in. Refresh the page and try again.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      // Route through API (server-side, admin client write) to avoid any RLS edge cases.
      // This also ensures all whitelisted fields — including social links — are saved.
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:     form.full_name     || null,
          bio:           form.bio           || null,
          location:      form.location      || null,
          website:       form.website       || null,
          linkedin_url:  form.linkedin_url  || null,
          instagram_url: form.instagram_url || null,
          twitter_url:   form.twitter_url   || null,
          github_url:    form.github_url    || null,
          tiktok_url:    form.tiktok_url    || null,
          youtube_url:   form.youtube_url   || null,
          website_url:   form.website_url   || null,
          professional_headline: form.professional_headline || null,
          professional_experience: parseExperienceText(form.professional_experience_text),
          ...(form.verification_details_text.trim()
            ? { verification_details: { note: form.verification_details_text.trim() } }
            : {}),
          cover_position_x: coverSettings.positionX,
          cover_position_y: coverSettings.positionY,
          cover_rotation:   coverSettings.rotation,
          cover_scale:      coverSettings.scale,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = (errData as { error?: string }).error ?? 'Save failed'
        console.error('[profile save] API error:', msg)
        setSaveError(msg)
        return
      }

      const { profile: updated } = await res.json() as { profile: Partial<Profile> }

      // Success — merge the server-returned row back into local state
      setProfile(prev => prev ? { ...prev, ...updated } : prev)
      setCoverSettings(getCoverSettingsFromProfile(updated as Profile))
      setForm({
        full_name:     (updated.full_name     ?? ''),
        bio:           (updated.bio           ?? ''),
        location:      (updated.location      ?? ''),
        website:       (updated.website       ?? ''),
        linkedin_url:  (updated.linkedin_url  ?? ''),
        instagram_url: (updated.instagram_url ?? ''),
        twitter_url:   (updated.twitter_url   ?? ''),
        github_url:    (updated.github_url    ?? ''),
        tiktok_url:    (updated.tiktok_url    ?? ''),
        youtube_url:   (updated.youtube_url   ?? ''),
        website_url:   (updated.website_url   ?? ''),
        professional_headline: updated.professional_headline ?? '',
        professional_experience_text: experienceToText(updated.professional_experience),
        verification_details_text: updated.verification_details?.note ?? form.verification_details_text,
      })
      setEditing(false)
      showToast('Profile saved!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[profile save] threw:', msg, err)
      setSaveError(`Unexpected error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleVatSave = async () => {
    if (!user) return
    setVatSaving(true)
    setVatSaved(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vat_registered: vatRegistered,
          vat_number: vatRegistered ? vatNumber.trim() || null : null,
        }),
      })
      if (res.ok) {
        setVatSaved(true)
        setTimeout(() => setVatSaved(false), 3000)
      }
    } catch (err) {
      console.error('[vat save]', err)
    } finally {
      setVatSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { url: string }
      setProfile(prev => ({ ...prev!, avatar_url: data.url }))
      showToast('Profile photo updated!')
    } catch (err) {
      console.error('avatar upload error:', err)
      showToast('Photo upload failed. Please try again.')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/cover', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { url: string }
      setCoverSettings(DEFAULT_COVER_SETTINGS)
      setProfile(prev => ({
        ...prev!,
        cover_url: data.url,
        cover_position_x: DEFAULT_COVER_SETTINGS.positionX,
        cover_position_y: DEFAULT_COVER_SETTINGS.positionY,
        cover_rotation: DEFAULT_COVER_SETTINGS.rotation,
        cover_scale: DEFAULT_COVER_SETTINGS.scale,
      }))
      showToast('Cover photo updated!')
    } catch (err) {
      console.error('cover upload error:', err)
      showToast('Cover upload failed. Please try again.')
    } finally {
      setCoverUploading(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  const handleCoverSettingsSave = async () => {
    if (!user) {
      showToast('Sign in to adjust your cover photo.')
      return
    }
    setCoverSettingsSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_position_x: coverSettings.positionX,
          cover_position_y: coverSettings.positionY,
          cover_rotation: coverSettings.rotation,
          cover_scale: coverSettings.scale,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Cover adjustment failed')
      }
      const { profile: updated } = await res.json() as { profile: Partial<Profile> }
      setProfile(prev => prev ? { ...prev, ...updated } : prev)
      setCoverSettings(getCoverSettingsFromProfile(updated as Profile))
      showToast('Cover photo fit saved!')
    } catch (err) {
      console.error('cover settings save error:', err)
      showToast('Cover adjustment failed. Please try again.')
    } finally {
      setCoverSettingsSaving(false)
    }
  }

  const handleFollow = async () => {
    if (!user || followLoading || !viewingId) return
    setFollowLoading(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: viewingId }),
      })
      if (res.ok) {
        setIsFollowing(true)
        setFollowerCount(prev => prev + 1)
      }
    } catch { /* silent */ } finally {
      setFollowLoading(false)
    }
  }

  // Open the inline message drawer with this profile as the
  // recipient. The drawer itself handles POST /api/conversations
  // (find-or-create) and the conversation UI — we never call
  // router.push from this handler, so there is zero chance of
  // ending up on /messages (the inbox) or anywhere else. The
  // profile URL stays visible behind the drawer.
  //
  // Only guard: redirect to /login if the viewer has no session.
  // Everything else (profile not loaded, recipient missing) is
  // handled inside the drawer's setup effect via an inline
  // error banner — no silent bailouts.
  const handleMessage = () => {
    console.log('[profile] handleMessage — opening drawer for', profile?.id ?? viewingId)
    if (!user) {
      console.warn('[profile] handleMessage: no authenticated user, redirecting to /login')
      router.push('/login')
      return
    }
    setDrawerOpen(true)
  }

  const handleUnfollow = async () => {
    if (!user || followLoading || !viewingId) return
    setFollowLoading(true)
    try {
      const res = await fetch('/api/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: viewingId }),
      })
      if (res.ok) {
        setIsFollowing(false)
        setFollowerCount(prev => Math.max(0, prev - 1))
      }
    } catch { /* silent */ } finally {
      setFollowLoading(false)
    }
  }

  const { pct: completeness, missing } = calcCompleteness(profile, user?.email ?? null)
  const trustLevel = getTrustLevel(trustBalance)
  const photoGridTiles = profilePhotoGridPosts
    .map(post => ({ post, urls: getPhotoUrlsFromPost(post) }))
    .filter(item => item.urls.length > 0)
    .slice(0, 18)

  const activityIcon: Record<string, string> = {
    post: '📝',
    article: '📰',
    service: '🛠',
    product: '📦',
    event: '📅',
    community: '🌍',
    review: '⭐',
    milestone: '🏆',
  }

  const profileTabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'trust', label: 'Trust' },
    { key: 'services', label: 'Services', count: services.length || undefined },
    { key: 'products', label: 'Products', count: products.length || undefined },
    { key: 'grassroots', label: 'Grassroots', count: grassroots.length || undefined },
    { key: 'posts', label: 'Posts', count: profilePosts.length || undefined },
    { key: 'activity', label: 'Activity' },
    { key: 'following', label: 'Following', count: following.length || profile?.following_count || undefined },
    { key: 'followers', label: 'Followers', count: followerCount || undefined },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user && isOwnProfile) {
    const maybeRestoringSession = sessionRestoreSuspected || hasSupabaseCookie()
    if (maybeRestoringSession) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#0f172a', color: '#f1f5f9', gap: '1rem', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>⏳</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Restoring your session…</h3>
          <p style={{ color: '#94a3b8', maxWidth: 460, margin: 0, lineHeight: 1.5 }}>
            You appear to have just signed in, but your browser has not finished restoring the session yet. Try reloading once — you do not need to sign up again.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
            <Link href="/login?redirect=/profile" style={{ background: 'transparent', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>Sign in again</Link>
          </div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#0f172a', color: '#f1f5f9', gap: '1rem', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Your session expired or didn&apos;t load</h3>
        <p style={{ color: '#94a3b8', maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
          Sign in again to view and edit your profile. If you just signed in, try reloading first — you do not need to create a new account.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => window.location.reload()} style={{ background: 'transparent', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
          <Link href="/login?redirect=/profile" style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>Sign in again</Link>
        </div>
      </div>
    )
  }

  if (!isOwnProfile && !profile && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#0f172a', color: '#f1f5f9', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>👤</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Profile not found</h3>
        <Link href="/members" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to Members</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .profile-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 1rem; margin-bottom: 0.875rem; }
        .profile-photo-grid-card { padding: 0; overflow: hidden; }
        .profile-photo-grid-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 0 0 0.5rem; }
        .profile-photo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; background: #020617; }
        .profile-photo-tile { position: relative; display: block; aspect-ratio: 3 / 4; overflow: hidden; background: #020617; }
        .profile-photo-grid-view { font-size: 12px; font-weight: 800; color: #cbd5e1; text-decoration: none; line-height: 1; }
        .profile-photo-grid-add { width: 30px; height: 30px; min-width: 30px; min-height: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid rgba(248,250,252,0.18); background: rgba(248,250,252,0.10); color: #f8fafc; font-size: 18px; font-weight: 850; line-height: 1; text-decoration: none; box-shadow: 0 8px 22px rgba(2,6,23,0.28); }
        .profile-input { width: 100%; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.18); border-radius: 8px; padding: 10px 12px; font-size: 16px; color: #f1f5f9; outline: none; font-family: inherit; box-sizing: border-box; }
        .profile-input:focus { border-color: rgba(56,189,248,0.4); }
        .profile-label { font-size: 12px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .cover-overlay { opacity: 0; transition: opacity 0.2s; }
        .cover-wrap:hover .cover-overlay { opacity: 1; }
        .profile-tab-scroll::-webkit-scrollbar { display: none; }
        .profile-avatar-frame { width: 132px; height: 132px; }
        .profile-avatar-frame > img,
        .profile-avatar-frame > div:first-child { width: 132px !important; height: 132px !important; }
        @media (max-width: 640px) {
          .profile-shell { padding-left: 16px !important; padding-right: 16px !important; }
          .profile-cover { height: 260px !important; margin-top: 0 !important; }
          .profile-avatar-overlap { top: -96px !important; }
          .profile-avatar-frame { width: 96px !important; height: 96px !important; }
          .profile-avatar-frame > img,
          .profile-avatar-frame > div:first-child { width: 96px !important; height: 96px !important; }
          .profile-action-row { justify-content: flex-start !important; padding-top: 0.85rem !important; }
          .profile-action-row > div { width: 100%; }
          .profile-action-row a,
          .profile-action-row button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
          .profile-photo-grid-card { margin-left: -16px; margin-right: -16px; border-left: 0 !important; border-right: 0 !important; border-radius: 0 !important; }
          .profile-meta-panel { padding-top: 2.2rem !important; }
          .profile-photo-grid-actions { padding: 0.1rem 16px 0.5rem; }
          .profile-photo-grid { gap: 3px; }
          .profile-photo-grid-view { font-size: 12px; color: #e2e8f0; }
          .profile-photo-grid-add { width: 28px; height: 28px; min-width: 28px; min-height: 28px; font-size: 17px; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 70, right: 20, background: '#1e293b', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '12px 20px', fontSize: '0.88rem', color: '#f1f5f9', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Low-trust nudge — own profile, trust below ₮10 */}
      {isOwnProfile && trustBalance < 10 && (
        <div style={{ background: 'linear-gradient(90deg,rgba(56,189,248,0.07),rgba(52,211,153,0.05))', borderBottom: '1px solid rgba(56,189,248,0.15)', padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem' }}>⚡</span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', flex: 1 }}>
            Your Trust score is <strong style={{ color: '#38bdf8' }}>₮{trustBalance}</strong>. Complete your profile and make your first connection to start building trust.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <Link href="/browse" style={{ fontSize: '0.75rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, padding: '0.3rem 0.7rem', color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>Connect →</Link>
          </div>
        </div>
      )}

      {/* Hidden file inputs — own profile only */}
      {isOwnProfile && (
        <>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleCoverUpload} />
        </>
      )}

      {/* Cover photo */}
      <div
        className={`${isOwnProfile ? 'cover-wrap ' : ''}profile-cover`}
        style={{ position: 'relative', height: '260px', marginTop: 0, cursor: isOwnProfile ? 'pointer' : 'default', overflow: 'hidden' }}
        onClick={() => isOwnProfile && !coverUploading && coverInputRef.current?.click()}
        onMouseEnter={() => isOwnProfile && setCoverHover(true)}
        onMouseLeave={() => isOwnProfile && setCoverHover(false)}
      >
        {profile?.cover_url ? (
          <img src={profile.cover_url} alt="cover" style={getCoverImageStyle(coverSettings)} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, rgba(56,189,248,0.15) 100%)' }} />
        )}
        {/* Upload overlay — own profile only */}
        {isOwnProfile && (
          <div
            className="cover-overlay"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(15,23,42,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            {coverUploading ? (
              <div style={{ width: 24, height: 24, border: '2px solid rgba(56,189,248,0.3)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <>📷 Change cover photo</>
            )}
          </div>
        )}
        {isOwnProfile && (
          <button
            type="button"
            aria-label="Adjust cover photo frame"
            title="Adjust cover photo frame"
            onClick={event => {
              event.stopPropagation()
              setSaveError(null)
              setEditing(true)
              window.setTimeout(() => editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            style={{
              position: 'absolute',
              right: 14,
              bottom: 14,
              zIndex: 5,
              width: 46,
              height: 46,
              minWidth: 46,
              minHeight: 46,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15,23,42,0.78)',
              border: '1px solid rgba(125,211,252,0.55)',
              borderRadius: 14,
              color: '#7dd3fc',
              fontSize: 22,
              cursor: 'pointer',
              boxShadow: '0 10px 28px rgba(2,6,23,0.45)',
              backdropFilter: 'blur(10px)',
              fontFamily: 'inherit',
            }}
          >
            🖼️
          </button>
        )}
      </div>

      {/* Profile header */}
      <div className="profile-shell" style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          {/* Avatar — overlaps cover */}
          <div
            className="profile-avatar-overlap"
            style={{ position: 'absolute', top: '-74px', left: 0, cursor: isOwnProfile ? 'pointer' : 'default' }}
            onMouseEnter={() => isOwnProfile && setAvatarHover(true)}
            onMouseLeave={() => isOwnProfile && setAvatarHover(false)}
            onClick={() => isOwnProfile && !avatarUploading && avatarInputRef.current?.click()}
            title={isOwnProfile ? 'Change profile photo' : undefined}
          >
            <div className="profile-avatar-frame" style={{ position: 'relative' }}>
              <Avatar
                url={profile?.avatar_url}
                name={profile?.full_name}
                email={isOwnProfile ? user?.email : undefined}
                size={132}
              />
              {/* Uploading — own profile only */}
              {isOwnProfile && avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(56,189,248,0.3)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}
              {/* Hover — own profile only */}
              {isOwnProfile && avatarHover && !avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  📷
                </div>
              )}
            </div>
          </div>

          {/* Edit button — own profile only */}
          <div className="profile-action-row" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem' }}>
            {isOwnProfile ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  // Clear any stale save error from the previous edit
                  // session so opening the form again starts clean.
                  setSaveError(null)
                  setEditing(!editing)
                }}
                style={{ background: editing ? 'rgba(148,163,184,0.1)' : 'rgba(56,189,248,0.1)', border: `1px solid ${editing ? 'rgba(148,163,184,0.2)' : 'rgba(56,189,248,0.3)'}`, borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: editing ? '#94a3b8' : '#38bdf8', cursor: 'pointer' }}
              >
                {editing ? 'Cancel' : '✏️ Edit Profile'}
              </button>
              <Link
                href="/profile/manage"
                style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', textDecoration: 'none' }}
              >
                ⚙️ Manage listings
              </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Follow button — shown to all visitors (logged in or not).
                    Unauthenticated visitors get a "Sign In to Follow" button
                    that redirects to /login with the full profile URL (including
                    ?id=) as the redirect param, so after login they land back on
                    this exact profile rather than their own. */}
                {user ? (
                  <button
                    onClick={isFollowing ? handleUnfollow : handleFollow}
                    disabled={followLoading}
                    style={{
                      background: isFollowing ? 'transparent' : 'linear-gradient(135deg,#38bdf8,#818cf8)',
                      border: isFollowing ? '1px solid rgba(148,163,184,0.3)' : 'none',
                      borderRadius: 8,
                      padding: '0.45rem 1.1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: isFollowing ? '#94a3b8' : '#0f172a',
                      cursor: followLoading ? 'default' : 'pointer',
                      opacity: followLoading ? 0.6 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {followLoading ? '…' : isFollowing ? 'Unfollow' : '+ Follow'}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/profile?id=${viewingId}`)}`)}
                    style={{
                      background: 'linear-gradient(135deg,#38bdf8,#818cf8)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '0.45rem 1.1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    + Follow
                  </button>
                )}
                {user && (
                  <button
                    onClick={handleMessage}
                    aria-label="Message this member"
                    style={{
                      display:      'inline-flex',
                      alignItems:   'center',
                      gap:          '0.4rem',
                      background:   'rgba(52,211,153,0.12)',
                      border:       '1px solid rgba(52,211,153,0.35)',
                      borderRadius: 8,
                      padding:      '0.45rem 1rem',
                      fontSize:     '0.82rem',
                      fontWeight:   700,
                      color:        '#34d399',
                      cursor:       'pointer',
                      fontFamily:   'inherit',
                      transition:   'all 0.15s',
                    }}
                  >
                    💬 Message
                  </button>
                )}
                <Link href="/members" style={{ fontSize: '0.82rem', color: '#64748b', textDecoration: 'none', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 8, padding: '0.45rem 1rem' }}>
                  ← Members
                </Link>
              </div>
            )}
          </div>

          {/* Name + meta — offset for avatar */}
          <div className="profile-meta-panel" style={{ paddingTop: '4.25rem' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.3rem' }}>
              <span>{profile?.full_name ?? user?.email ?? 'Member'}</span>
              {isProfileVerified(profile) && <VerifiedBadge />}
            </h1>
            {profile?.professional_headline && (
              <div style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.45rem' }}>
                {profile.professional_headline}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
              {profile?.location && <span>📍 {profile.location}</span>}
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                  🔗 {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span>🗓 Member since {new Date(profile?.created_at ?? user?.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.6rem' }}>
              <span><strong style={{ color: '#f1f5f9' }}>{followerCount}</strong> followers</span>
              <span><strong style={{ color: '#f1f5f9' }}>{profile?.following_count ?? 0}</strong> following</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `${trustLevel.color}18`, border: `1px solid ${trustLevel.color}40`, borderRadius: 999, padding: '0.15rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, color: trustLevel.color }}>
                {trustLevel.icon} {trustLevel.label}
              </span>
            </div>
            {/* Social Links — full row, all platforms with non-empty URLs.
                Renders nothing if the user has zero social links, so the
                spacing below the stats row collapses naturally. */}
            <SocialLinks
              links={{
                linkedin_url:  profile?.linkedin_url,
                instagram_url: profile?.instagram_url,
                twitter_url:   profile?.twitter_url,
                github_url:    profile?.github_url,
                tiktok_url:    profile?.tiktok_url,
                youtube_url:   profile?.youtube_url,
                website_url:   profile?.website_url,
              }}
              size="md"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, margin: '1rem 0 1.25rem' }}>
              {[
                { value: followerCount.toLocaleString(), label: 'Followers' },
                { value: (profile?.following_count ?? following.length ?? 0).toLocaleString(), label: 'Following' },
                { value: `₮${trustBalance.toLocaleString()}`, label: 'Trust' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '13px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ borderBottom: '1px solid #1e293b', marginBottom: 20, overflow: 'hidden' }}>
              <div className="profile-tab-scroll" style={{ display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', whiteSpace: 'nowrap' }}>
                {profileTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: '0 0 auto',
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: activeTab === tab.key ? 700 : 500,
                      color: activeTab === tab.key ? '#f1f5f9' : '#475569',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab.key ? '2px solid #38bdf8' : '2px solid transparent',
                      marginBottom: -1,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', background: activeTab === tab.key ? 'rgba(56,189,248,0.18)' : '#1e293b', color: activeTab === tab.key ? '#7dd3fc' : '#64748b' }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
        {(profilePhotoGridLoading || photoGridTiles.length > 0 || isOwnProfile) && (
          <div className="profile-card profile-photo-grid-card" style={{ padding: photoGridTiles.length > 0 ? 0 : '1rem' }}>
            <div className="profile-photo-grid-actions">
                {photoGridTiles.length > 0 && (
                  <Link href="#" className="profile-photo-grid-view" onClick={(event) => { event.preventDefault(); setActiveTab('posts') }}>
                    View posts
                  </Link>
                )}
                {isOwnProfile && (
                  <Link href="/create" className="profile-photo-grid-add" aria-label="Add photo post" title="Add photo post">
                    +
                  </Link>
                )}
            </div>
            {profilePhotoGridLoading ? (
              <div className="profile-photo-grid" style={{ padding: photoGridTiles.length > 0 ? 0 : '1rem 0 0' }}>
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="profile-photo-tile" style={{ background: 'linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.92))' }} />
                ))}
              </div>
            ) : photoGridTiles.length > 0 ? (
              <div className="profile-photo-grid">
                {photoGridTiles.map(({ post, urls }) => (
                  <Link key={post.id} href={`/feed/${post.id}`} aria-label="Open photo post" className="profile-photo-tile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[0]} alt={post.title ?? post.content?.slice(0, 80) ?? 'Photo post'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {urls.length > 1 && (
                      <span aria-label={`${urls.length} photos`} style={{ position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: 6, background: 'rgba(2,6,23,0.72)', border: '1px solid rgba(248,250,252,0.65)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc', fontSize: 12, fontWeight: 900, boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}>
                        ▣
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ) : isOwnProfile ? (
              <div style={{ padding: '2.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📸</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.35rem' }}>No photo posts yet</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 300, margin: '0 auto', lineHeight: 1.5 }}>Upload photo posts and they will appear here in a clean grid on your profile overview.</div>
              </div>
            ) : null}
          </div>
        )}

        {(isOwnProfile || isProfileVerified(profile) || profile?.verification_status === 'submitted') && (
          <div className="profile-card" style={{ border: `1px solid ${isProfileVerified(profile) ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.18)'}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.35rem' }}>{isProfileVerified(profile) ? '✅' : profile?.verification_status === 'submitted' ? '🛡️' : '🔎'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 3 }}>
                  <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.95rem' }}>{verificationLabel(profile)}</div>
                  {isProfileVerified(profile) && <VerifiedBadge compact />}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.55 }}>
                  {isProfileVerified(profile)
                    ? `FreeTrust has reviewed this member's identity${profile?.profile_identity_verified_at ? ` on ${new Date(profile.profile_identity_verified_at).toLocaleDateString('en-IE')}` : ''}.`
                    : profile?.verification_status === 'submitted'
                      ? 'Verification details have been submitted for FreeTrust review. A badge is shown only after review.'
                      : 'Submit professional and identity details from Edit Profile to request review.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Performance (OTIF) — shown for any seller profile */}
        {(viewingId || user?.id) && (
          <div className="profile-card">
            <SellerOTIFBadge sellerId={viewingId || user?.id || ''} />
          </div>
        )}

        {/* Dual Role Summary — own profile only, shows buying + selling counts side by side */}
        {isOwnProfile && (buyingCount !== null || sellingCount !== null) && (
          <div className="profile-card">
            <h3 style={{ margin: '0 0 1rem', fontWeight: 700, fontSize: '0.95rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Activity
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)',
                borderRadius: 12, padding: '1rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🛒</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>
                  {buyingCount ?? 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>Orders Placed</div>
              </div>
              <div style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)',
                borderRadius: 12, padding: '1rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🏪</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
                  {sellingCount ?? 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>Orders Sold</div>
              </div>
            </div>
          </div>
        )}

        {/* Edit form or About */}
        {editing ? (
          <div
            ref={editFormRef}
            className="profile-card"
            // scrollMarginTop clears the fixed top nav when the scroll
            // effect above fires — without this the form's title lands
            // UNDER the navbar and the user thinks the form still
            // hasn't appeared.
            style={{ scrollMarginTop: '80px' }}
          >
            <h3 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1rem' }}>Edit Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ border: '1px solid rgba(56,189,248,0.18)', borderRadius: 14, padding: '0.85rem', background: 'rgba(56,189,248,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9' }}>🖼 Cover photo fit</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.45, marginTop: 2 }}>
                      Rotate, zoom, and reposition the cover so the important part sits perfectly in the banner.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    style={{ flexShrink: 0, minHeight: 40, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.28)', borderRadius: 9, padding: '0.45rem 0.7rem', fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', cursor: coverUploading ? 'default' : 'pointer', opacity: coverUploading ? 0.65 : 1, fontFamily: 'inherit' }}
                  >
                    {coverUploading ? 'Uploading…' : 'Change photo'}
                  </button>
                </div>

                <div style={{ position: 'relative', height: 138, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.18)', background: '#020617', marginBottom: '0.85rem' }}>
                  {profile?.cover_url ? (
                    <img src={profile.cover_url} alt="Cover preview" style={getCoverImageStyle(coverSettings)} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, rgba(56,189,248,0.15) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                      Add a cover photo first
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div>
                    <label className="profile-label" htmlFor="cover-y">Vertical focus</label>
                    <input
                      id="cover-y"
                      type="range"
                      min="0"
                      max="100"
                      value={coverSettings.positionY}
                      onChange={e => setCoverSettings(s => ({ ...s, positionY: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#38bdf8' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}><span>Top</span><span>Bottom</span></div>
                  </div>
                  <div>
                    <label className="profile-label" htmlFor="cover-x">Horizontal focus</label>
                    <input
                      id="cover-x"
                      type="range"
                      min="0"
                      max="100"
                      value={coverSettings.positionX}
                      onChange={e => setCoverSettings(s => ({ ...s, positionX: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#38bdf8' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}><span>Left</span><span>Right</span></div>
                  </div>
                  <div>
                    <label className="profile-label" htmlFor="cover-scale">Zoom</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        aria-label="Zoom cover photo out"
                        onClick={() => setCoverSettings(s => ({ ...s, scale: clampNumber(s.scale - 0.1, 1, 2, 1) }))}
                        style={{ minHeight: 42, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 9, color: '#cbd5e1', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        −
                      </button>
                      <input
                        id="cover-scale"
                        type="range"
                        min="1"
                        max="2"
                        step="0.05"
                        value={coverSettings.scale}
                        onChange={e => setCoverSettings(s => ({ ...s, scale: Number(e.target.value) }))}
                        style={{ width: '100%', accentColor: '#38bdf8' }}
                      />
                      <button
                        type="button"
                        aria-label="Zoom cover photo in"
                        onClick={() => setCoverSettings(s => ({ ...s, scale: clampNumber(s.scale + 0.1, 1, 2, 1) }))}
                        style={{ minHeight: 42, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 9, color: '#7dd3fc', fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}><span>Zoom out</span><span>{Math.round(coverSettings.scale * 100)}%</span><span>Zoom in</span></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setCoverSettings(s => ({ ...s, rotation: normalizeRotation(s.rotation - 90) }))}
                      style={{ minHeight: 42, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 9, color: '#cbd5e1', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ↶ Rotate
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverSettings(s => ({ ...s, rotation: normalizeRotation(s.rotation + 90) }))}
                      style={{ minHeight: 42, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 9, color: '#cbd5e1', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Rotate ↷
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverSettings(DEFAULT_COVER_SETTINGS)}
                      style={{ minHeight: 42, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 9, color: '#fca5a5', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Reset
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleCoverSettingsSave}
                    disabled={coverSettingsSaving || !profile?.cover_url}
                    style={{ minHeight: 44, background: 'linear-gradient(135deg,#38bdf8,#818cf8)', border: 'none', borderRadius: 10, padding: '0.65rem', fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', cursor: coverSettingsSaving || !profile?.cover_url ? 'default' : 'pointer', opacity: coverSettingsSaving || !profile?.cover_url ? 0.6 : 1, fontFamily: 'inherit' }}
                  >
                    {coverSettingsSaving ? 'Saving cover fit…' : 'Save cover fit'}
                  </button>
                </div>
              </div>
              {[
                { label: 'Full Name', key: 'full_name', placeholder: 'Your name', type: 'text' },
                { label: 'Bio', key: 'bio', placeholder: 'Tell the community about yourself', type: 'text' },
                { label: 'Location', key: 'location', placeholder: 'City, Country', type: 'text' },
                { label: 'Website', key: 'website', placeholder: 'https://yoursite.com', type: 'url' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="profile-label">{label}</label>
                  <input
                    className="profile-input"
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: '0.85rem' }}>
                <label className="profile-label" style={{ marginBottom: '0.75rem', display: 'block' }}>💼 Professional profile</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <input
                    className="profile-input"
                    type="text"
                    placeholder="Headline, e.g. Founder · Product strategist · Community builder"
                    value={form.professional_headline}
                    onChange={e => setForm(f => ({ ...f, professional_headline: e.target.value }))}
                  />
                  <textarea
                    className="profile-input"
                    placeholder={'Experience — one per line\nRole @ Organisation (Dates) — Short description'}
                    value={form.professional_experience_text}
                    onChange={e => setForm(f => ({ ...f, professional_experience_text: e.target.value }))}
                    rows={5}
                    style={{ resize: 'vertical', minHeight: 120, lineHeight: 1.5 }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
                    Example: <span style={{ color: '#94a3b8' }}>Founder @ Example Studio (2021–present) — Building trusted community products.</span>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: '0.85rem' }}>
                <label className="profile-label" style={{ marginBottom: '0.75rem', display: 'block' }}>🛡️ Profile verification request</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ background: isProfileVerified(profile) ? 'rgba(52,211,153,0.08)' : 'rgba(56,189,248,0.06)', border: `1px solid ${isProfileVerified(profile) ? 'rgba(52,211,153,0.22)' : 'rgba(56,189,248,0.18)'}`, borderRadius: 10, padding: '0.7rem 0.8rem', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    <strong style={{ color: isProfileVerified(profile) ? '#34d399' : '#38bdf8' }}>{verificationLabel(profile)}.</strong>{' '}
                    Verified badges are granted only after FreeTrust review; saving this form cannot self-verify your profile.
                  </div>
                  <textarea
                    className="profile-input"
                    placeholder="Add links or notes FreeTrust can review: professional website, public social profiles, credentials, business registry, or other proof."
                    value={form.verification_details_text}
                    onChange={e => setForm(f => ({ ...f, verification_details_text: e.target.value }))}
                    rows={4}
                    style={{ resize: 'vertical', minHeight: 105, lineHeight: 1.5 }}
                  />
                </div>
              </div>
              {/* Social links */}
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: '0.75rem' }}>
                <label className="profile-label" style={{ marginBottom: '0.75rem', display: 'block' }}>🔗 Social Links</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {[
                    { key: 'linkedin_url',  placeholder: 'https://linkedin.com/in/…',  icon: '💼' },
                    { key: 'instagram_url', placeholder: 'https://instagram.com/…',    icon: '📸' },
                    { key: 'twitter_url',   placeholder: 'https://twitter.com/…',      icon: '🐦' },
                    { key: 'github_url',    placeholder: 'https://github.com/…',       icon: '🐙' },
                    { key: 'tiktok_url',    placeholder: 'https://tiktok.com/@…',      icon: '🎵' },
                    { key: 'youtube_url',   placeholder: 'https://youtube.com/@…',     icon: '▶️' },
                    { key: 'website_url',   placeholder: 'https://yoursite.com',       icon: '🌐' },
                  ].map(({ key, placeholder, icon }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                      <input
                        className="profile-input"
                        type="url"
                        placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {saveError && (
                <div
                  role="alert"
                  style={{
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.3)',
                    borderRadius: 8,
                    padding: '0.7rem 0.85rem',
                    fontSize: '0.82rem',
                    color: '#fca5a5',
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    wordBreak: 'break-word',
                  }}
                >
                  <span style={{ flexShrink: 0 }}>⚠️</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{saveError}</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.7rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : profile?.bio ? (
          <div className="profile-card">
            <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>About</h3>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, fontSize: '0.9rem' }}>{profile.bio}</p>
          </div>
        ) : null}

        {!editing && normaliseExperience(profile?.professional_experience).length > 0 && (
          <div className="profile-card">
            <h3 style={{ marginBottom: '0.9rem', fontWeight: 700, fontSize: '1rem' }}>Professional Experience</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {normaliseExperience(profile?.professional_experience).map((entry, index) => (
                <div key={`${entry.role}-${entry.organization}-${index}`} style={{ borderLeft: '2px solid rgba(56,189,248,0.35)', paddingLeft: '0.85rem' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.35 }}>
                    {entry.role || 'Professional role'}{entry.organization ? <span style={{ color: '#94a3b8', fontWeight: 700 }}> @ {entry.organization}</span> : null}
                  </div>
                  {entry.period && <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginTop: 2 }}>{entry.period}</div>}
                  {entry.description && <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, marginTop: 5 }}>{entry.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hobbies — pill chips. Only shown if the user has at least one
            hobby set. Presets (Music, Art, etc.) render with an emoji
            icon from HOBBY_ICONS; custom free-text hobbies render as a
            plain text pill. */}
        {!editing && Array.isArray(profile?.hobbies) && profile.hobbies.length > 0 && (
          <div className="profile-card">
            <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>Hobbies</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {profile.hobbies.map(h => {
                const icon = HOBBY_ICONS[h]
                return (
                  <span
                    key={h}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: 999,
                      background: 'rgba(56,189,248,0.08)',
                      border: '1px solid rgba(56,189,248,0.22)',
                      color: '#7dd3fc',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    {icon && <span>{icon}</span>}
                    <span>{h}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

          </>
        )}

        {activeTab === 'trust' && (
          <>
            {/* Profile Completeness Bar */}
            {completeness < 100 && (
              <div className="profile-card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>Profile completeness</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>{completeness}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, marginBottom: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ width: `${completeness}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Complete your profile to earn <strong style={{ color: '#38bdf8' }}>₮10 bonus</strong>. Missing:&nbsp;
                  {missing.map((m, i) => (
                    <span key={m}>
                      <span style={{ color: '#94a3b8' }}>{m}</span>
                      {i < missing.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {completeness === 100 && (
              <div className="profile-card" style={{ marginBottom: '1.25rem', border: '1px solid rgba(56,189,248,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Profile 100% complete!</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>You earned ₮10 Trust for completing your profile.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Trust Economy */}
            <div className="profile-card">
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', letterSpacing: '0.06em' }}>TRUST ECONOMY</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Balance</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8' }}>₮{trustBalance.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Level</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: trustLevel.color }}>{trustLevel.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#475569' }}>{trustLevel.next}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.4rem' }}>Progress</div>
                  {trustLevel.nextAt !== null && (
                    <div style={{ height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((trustBalance / trustLevel.nextAt) * 100, 100)}%`, height: '100%', background: `linear-gradient(90deg,#38bdf8,${trustLevel.color})`, borderRadius: 3 }} />
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>{trustBalance}{trustLevel.nextAt !== null ? `/${trustLevel.nextAt}` : ' MAX'}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Services Section */}
        {activeTab === 'services' && (
          <div className="profile-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>SERVICES ({services.length})</div>
              {isOwnProfile && (
                <Link href="/seller/gigs/create" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
                  + Add Service
                </Link>
              )}
            </div>
            {services.length === 0 ? (
              <div style={{ padding: '2.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🛠</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>No services listed yet</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{isOwnProfile ? 'Add your first service to show it on your profile.' : 'Services from this member will appear here.'}</div>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(showAllServices ? services : services.slice(0, 4)).map(svc => (
                <Link
                  key={svc.id}
                  href={`/services/${svc.id}`}
                  style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', textDecoration: 'none', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '0.85rem 1rem', transition: 'border-color 0.15s' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.3rem' }}>
                      {svc.title}
                    </div>
                    {svc.description && (
                      <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {svc.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {svc.service_mode && (
                        <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
                          {svc.service_mode === 'online' ? '🌐 Online' : svc.service_mode === 'in-person' ? '📍 In-person' : '🔄 Hybrid'}
                        </span>
                      )}
                      <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>⭐ {svc.avg_rating && (svc.review_count ?? 0) > 0 ? Number(svc.avg_rating).toFixed(1) : '5.0'} ({svc.review_count ?? 0})</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34d399' }}>
                      €{Number(svc.price).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            )}
            {services.length > 4 && (
              <button
                onClick={() => setShowAllServices(s => !s)}
                style={{ marginTop: '0.75rem', width: '100%', background: 'transparent', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.5rem', fontSize: '0.82rem', color: '#38bdf8', cursor: 'pointer' }}
              >
                {showAllServices ? 'Show less' : `Show all ${services.length} services`}
              </button>
            )}
          </div>
        )}

        {/* Products Section */}
        {activeTab === 'products' && (
          <div className="profile-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>PRODUCTS ({products.length})</div>
              {isOwnProfile && (
                <Link href="/products/new" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
                  + Add Product
                </Link>
              )}
            </div>
            {products.length === 0 ? (
              <div style={{ padding: '2.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📦</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>No products listed yet</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{isOwnProfile ? 'Add your first product to show it on your profile.' : 'Products from this member will appear here.'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(showAllProducts ? products : products.slice(0, 4)).map(product => {
                  const cover = product.cover_image ?? (Array.isArray(product.images) ? product.images[0] : null)
                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', textDecoration: 'none', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '0.85rem 1rem', transition: 'border-color 0.15s' }}
                    >
                      {cover ? (
                        <img src={cover} alt={product.title} style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: '#1e293b' }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: 12, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', color: '#7dd3fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>📦</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {product.title}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right', fontSize: '1rem', fontWeight: 800, color: '#34d399', whiteSpace: 'nowrap' }}>
                            €{Number(product.price ?? 0).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        {product.description && (
                          <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '0.35rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {product.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {product.product_type && (
                            <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.1rem 0.45rem' }}>
                              {product.product_type === 'digital' ? '💾 Digital' : '📦 Physical'}
                            </span>
                          )}
                          {product.product_type === 'physical' && (
                            <span style={{ fontSize: '0.68rem', color: product.stock_qty == null || product.stock_qty > 0 ? '#34d399' : '#f87171' }}>
                              {product.stock_qty == null ? 'In stock' : product.stock_qty > 0 ? `${product.stock_qty} in stock` : 'Out of stock'}
                            </span>
                          )}
                          <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>⭐ {product.avg_rating && (product.review_count ?? 0) > 0 ? Number(product.avg_rating).toFixed(1) : 'New'} ({product.review_count ?? 0})</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
            {products.length > 4 && (
              <button
                onClick={() => setShowAllProducts(s => !s)}
                style={{ marginTop: '0.75rem', width: '100%', background: 'transparent', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.5rem', fontSize: '0.82rem', color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {showAllProducts ? 'Show less' : `Show all ${products.length} products`}
              </button>
            )}
          </div>
        )}

        {/* Grassroots Section — same shape as Services so the visual rhythm
            stays consistent. Only renders when the user has at least one
            active listing. Green accent matches the rest of the
            grassroots section. */}
        {activeTab === 'grassroots' && (
          <div className="profile-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>
                🌱 GRASSROOTS ({grassroots.length})
              </div>
              {isOwnProfile && (
                <Link
                  href="/grassroots/new"
                  style={{
                    fontSize: '0.75rem',
                    color: GRASSROOTS_GREEN.primary,
                    textDecoration: 'none',
                    border: `1px solid ${GRASSROOTS_GREEN.borderSoft}`,
                    borderRadius: 6,
                    padding: '0.25rem 0.6rem',
                  }}
                >
                  + Post Work
                </Link>
              )}
            </div>
            {grassroots.length === 0 ? (
              <div style={{ padding: '2.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌱</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>No grassroots listings yet</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{isOwnProfile ? 'Post grassroots work to show it on your profile.' : 'Grassroots listings from this member will appear here.'}</div>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(showAllGrassroots ? grassroots : grassroots.slice(0, 4)).map(g => {
                const cat = GRASSROOTS_CATEGORIES_BY_SLUG[g.category]
                const avail = AVAILABILITY_BY_VALUE[g.availability]
                const cover = g.photos?.[0] ?? null
                return (
                  <Link
                    key={g.id}
                    href={`/grassroots/${g.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      textDecoration: 'none',
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.1)',
                      borderRadius: 10,
                      padding: '0.85rem 1rem',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = GRASSROOTS_GREEN.borderSoft)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)')}
                  >
                    {/* Thumbnail */}
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={g.title}
                        style={{
                          width: 48, height: 48, borderRadius: 8,
                          objectFit: 'cover', flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}33, ${GRASSROOTS_GREEN.primaryDim}66)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}>
                        {cat?.emoji ?? '🌱'}
                      </div>
                    )}

                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.3rem' }}>
                        {g.title}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {cat && (
                          <span style={{
                            fontSize: '0.68rem',
                            color: GRASSROOTS_GREEN.primary,
                            background: GRASSROOTS_GREEN.tint,
                            border: `1px solid ${GRASSROOTS_GREEN.borderSoft}`,
                            borderRadius: 4,
                            padding: '0.1rem 0.4rem',
                          }}>
                            {cat.emoji} {cat.label.split(' & ')[0]}
                          </span>
                        )}
                        {avail && (
                          <span style={{
                            fontSize: '0.68rem',
                            color: avail.color,
                            background: avail.bg,
                            border: `1px solid ${avail.border}`,
                            borderRadius: 4,
                            padding: '0.1rem 0.4rem',
                          }}>
                            {avail.label}
                          </span>
                        )}
                        {g.trust_tokens_accepted && (
                          <span style={{
                            fontSize: '0.68rem',
                            color: '#38bdf8',
                            background: 'rgba(56,189,248,0.08)',
                            border: '1px solid rgba(56,189,248,0.2)',
                            borderRadius: 4,
                            padding: '0.1rem 0.4rem',
                            fontWeight: 700,
                          }}>
                            ₮
                          </span>
                        )}
                        {(g.location_label || g.city) && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            📍 {g.location_label ?? g.city}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rate */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      {g.rate != null && g.rate_type !== 'negotiable' ? (
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: GRASSROOTS_GREEN.primary }}>
                          €{Number(g.rate_eur ?? g.rate).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: GRASSROOTS_GREEN.primary, fontWeight: 700 }}>
                          💬
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
            )}
            {grassroots.length > 4 && (
              <button
                onClick={() => setShowAllGrassroots(s => !s)}
                style={{
                  marginTop: '0.75rem',
                  width: '100%',
                  background: 'transparent',
                  border: `1px solid ${GRASSROOTS_GREEN.borderSoft}`,
                  borderRadius: 8,
                  padding: '0.5rem',
                  fontSize: '0.82rem',
                  color: GRASSROOTS_GREEN.primary,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {showAllGrassroots ? 'Show less' : `Show all ${grassroots.length} listings`}
              </button>
            )}
          </div>
        )}

        {/* Activity Section */}
        {activeTab === 'activity' && (
          <div className="profile-card">
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 14 }}>
              Recent activity
            </div>
              {loadingActivity ? (
                <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Loading activity…</div>
              ) : activity.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.88rem', textAlign: 'center', padding: '1rem 0' }}>
                  No activity yet — start posting, listing services, or joining communities!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activity.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}>{activityIcon[item.type] ?? '•'}</span>
                      <div style={{ flex: 1 }}>
                        {item.href ? (
                          <Link href={item.href} style={{ color: '#f1f5f9', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500 }}>
                            {item.title}
                          </Link>
                        ) : (
                          <span style={{ color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 500 }}>{item.title}</span>
                        )}
                        {item.subtitle && <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>{item.subtitle}</div>}
                      </div>
                      <span style={{ color: '#475569', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* Posts tab — real social feed posts by this member */}
        {activeTab === 'posts' && (
          <div className="profile-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Posts from {profile?.full_name ?? 'this member'}
              </div>
              {isOwnProfile && (
                <Link href="/create" style={{ fontSize: 12, fontWeight: 700, color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '5px 10px', textDecoration: 'none' }}>
                  + Post
                </Link>
              )}
            </div>
            {profilePostsLoading ? (
              <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Loading posts…</div>
            ) : profilePosts.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.4rem' }}>No posts yet</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Social posts from this member will appear here.</div>
                {isOwnProfile && (
                  <Link href="/create" style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8, padding: '0.45rem 1rem', textDecoration: 'none' }}>
                    Create your first post
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ margin: '0 -0.75rem' }}>
                {profilePosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id}
                    onDelete={postId => setProfilePosts(prev => prev.filter(p => p.id !== postId))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'followers' || activeTab === 'following') && (
          <div className="profile-card">
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 14 }}>
              {activeTab === 'followers'
                ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}`
                : `${profile?.following_count ?? following.length} following`}
            </div>
            {connectionsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 72, borderRadius: 16, background: '#0f172a', border: '1px solid #1e293b' }} />)}
              </div>
            ) : (activeTab === 'followers' ? followers : following).length === 0 ? (
              <div style={{ padding: '2.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{activeTab === 'followers' ? '👥' : '➡️'}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>
                  {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>
                  {activeTab === 'followers' ? 'Followers will appear here as the community grows.' : 'Members this profile follows will appear here.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(activeTab === 'followers' ? followers : following).map(person => (
                  <Link key={person.id} href={`/profile?id=${person.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', textDecoration: 'none' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#1e293b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {person.avatar_url
                        ? <img src={person.avatar_url} alt={person.full_name ?? 'Member'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: '#64748b', fontWeight: 800 }}>{(person.full_name ?? 'M').slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.full_name ?? 'Member'}</div>
                      {person.location && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {person.location}</div>}
                      {person.bio && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{person.bio}</div>}
                    </div>
                    <span style={{ color: '#38bdf8', fontSize: 18, flexShrink: 0 }}>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seller Tools — own profile only */}
        {activeTab === 'overview' && isOwnProfile && (
          <div className="profile-card">
            <h3 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1rem' }}>🏪 Seller Tools</h3>
            {/* Accounting link */}
            <Link
              href="/accounting"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.07)',
                border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10,
                textDecoration: 'none', marginBottom: '1rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>📊 My Accounting</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>Sales records, invoices & CSV exports</div>
              </div>
              <span style={{ color: '#10b981', fontSize: '1rem' }}>→</span>
            </Link>
            {/* VAT settings */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tax & VAT</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <div
                  onClick={() => setVatRegistered(v => !v)}
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: vatRegistered ? '#10b981' : '#334155',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3, left: vatRegistered ? 21 : 3,
                    transition: 'left 0.2s',
                  }} />
                </div>
                <span style={{ fontSize: '0.875rem', color: '#f1f5f9' }}>I am VAT registered</span>
              </label>
              {vatRegistered && (
                <input
                  type="text"
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                  placeholder="VAT Number (e.g. IE1234567T)"
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', background: '#0f172a',
                    border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8,
                    color: '#f1f5f9', fontSize: '0.875rem', outline: 'none',
                    boxSizing: 'border-box', marginBottom: '0.75rem',
                  }}
                />
              )}
              <button
                onClick={handleVatSave}
                disabled={vatSaving}
                style={{
                  padding: '0.5rem 1rem', background: vatSaved ? '#10b981' : '#1e293b',
                  color: vatSaved ? '#0f172a' : '#f1f5f9',
                  border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8,
                  fontWeight: 700, cursor: vatSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.825rem', transition: 'all 0.2s',
                }}
              >
                {vatSaving ? 'Saving…' : vatSaved ? '✅ Saved!' : 'Save VAT Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Account info — own profile only */}
        {activeTab === 'overview' && isOwnProfile && user && (
          <div className="profile-card">
            <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>Account</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem', color: '#64748b' }}>
              <span>📧 {user.email}</span>
              <span>🗓️ Joined {new Date(user.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
              <span>✅ Email {user.email_confirmed_at ? 'verified' : 'not verified'}</span>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/settings" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '0.35rem 0.75rem' }}>
                ⚙️ Settings
              </Link>
              <Link href="/wallet" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '0.35rem 0.75rem' }}>
                💎 Wallet
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Inline message drawer — rendered last so it layers over
          the profile content. Routing-free: clicking the Message
          button sets drawerOpen, the drawer calls POST
          /api/conversations and GET /api/messages/:id itself,
          and the profile URL never changes. */}
      {!isOwnProfile && profile && (
        <MessageDrawer
          open={drawerOpen}
          recipient={{
            id:         profile.id,
            full_name:  profile.full_name ?? null,
            avatar_url: profile.avatar_url ?? null,
          }}
          currentUserId={user?.id ?? null}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}
