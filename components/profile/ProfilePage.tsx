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

interface Profile {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  cover_url?: string | null
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

function getTrustLevel(balance: number) {
  if (balance >= 5000) return { label: 'FreeTrust Ambassador', icon: '👑', color: '#f59e0b', nextAt: null,  next: 'Max level reached' }
  if (balance >= 1000) return { label: 'Community Leader',    icon: '🏆', color: '#a78bfa', nextAt: 5000, next: 'Ambassador at ₮5000' }
  if (balance >= 500)  return { label: 'Verified Member',     icon: '✅', color: '#34d399', nextAt: 1000, next: 'Leader at ₮1000' }
  if (balance >= 100)  return { label: 'Trusted Member',      icon: '⭐', color: '#38bdf8', nextAt: 500,  next: 'Verified at ₮500' }
  return                      { label: 'New Member',          icon: '🌱', color: '#94a3b8', nextAt: 100,  next: 'Trusted at ₮100' }
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
  })
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverHover, setCoverHover] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [services, setServices] = useState<ServiceListing[]>([])
  const [showAllServices, setShowAllServices] = useState(false)
  const [grassroots, setGrassroots] = useState<GrassrootsListing[]>([])
  const [showAllGrassroots, setShowAllGrassroots] = useState(false)
  const [bonusAwarded, setBonusAwarded] = useState(false)
  const [toast, setToast] = useState('')
  const [isOwnProfile, setIsOwnProfile] = useState(true)
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
        .single()
      if (prof) {
        setProfile(prof)
        setForm({
          full_name: prof.full_name ?? '',
          bio: prof.bio ?? '',
          location: prof.location ?? '',
          website: prof.website ?? '',
          linkedin_url:  (prof as Profile & { linkedin_url?: string }).linkedin_url  ?? '',
          instagram_url: (prof as Profile & { instagram_url?: string }).instagram_url ?? '',
          twitter_url:   (prof as Profile & { twitter_url?: string }).twitter_url   ?? '',
          github_url:    (prof as Profile & { github_url?: string }).github_url    ?? '',
          tiktok_url:    (prof as Profile & { tiktok_url?: string }).tiktok_url    ?? '',
          youtube_url:   (prof as Profile & { youtube_url?: string }).youtube_url   ?? '',
          website_url:   (prof as Profile & { website_url?: string }).website_url   ?? '',
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

  // Load this user's active grassroots listings. Cast to unknown[] then
  // GrassrootsListing[] because supabase-js generated types don't know
  // about grassroots_listings yet — same untyped-row pattern services use.
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

  // Safety net: if loading hasn't resolved within 8 seconds, force it false.
  // Guards against supabase.auth.getUser() hanging on slow/offline connections
  // and against the lastInitIdRef early-return on component remount.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (lastInitIdRef.current === viewingId) {
      // Guard: the ref matched so we skip init, but if loading is still true
      // (e.g. component remounted and state reset) we must release it.
      setLoading(false)
      return
    }
    lastInitIdRef.current = viewingId

    const init = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)

        if (viewingId && (!u || viewingId !== u.id)) {
          // Viewing someone else's profile
          setIsOwnProfile(false)
          await Promise.all([
            loadProfile(viewingId),
            loadTrust(viewingId),
            loadActivity(viewingId),
            loadServices(viewingId),
            loadGrassroots(viewingId),
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
          await Promise.all([loadProfile(u.id), loadTrust(), loadActivity(u.id), loadServices(u.id), loadGrassroots(u.id)])

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
        }
        // If neither branch ran (no viewingId, no user) loading is released in finally
      } catch (err) {
        console.error('init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [viewingId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setProfile(prev => ({ ...prev!, cover_url: data.url }))
      showToast('Cover photo updated!')
    } catch (err) {
      console.error('cover upload error:', err)
      showToast('Cover upload failed. Please try again.')
    } finally {
      setCoverUploading(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user && isOwnProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#0f172a', color: '#f1f5f9', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sign in to view your profile</h3>
        <Link href="/login" style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>Sign In</Link>
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
        .profile-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.25rem; }
        .profile-input { width: 100%; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.18); border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #f1f5f9; outline: none; font-family: inherit; box-sizing: border-box; }
        .profile-input:focus { border-color: rgba(56,189,248,0.4); }
        .profile-label { font-size: 12px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .cover-overlay { opacity: 0; transition: opacity 0.2s; }
        .cover-wrap:hover .cover-overlay { opacity: 1; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 70, right: 20, background: '#1e293b', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '12px 20px', fontSize: '0.88rem', color: '#f1f5f9', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Connect Stripe banner — own profile, no Stripe Connect yet.
          Paid listings require an onboarded Stripe account; this
          surfaces the ask up-front so sellers don't discover the
          412 gate only when they try to publish. Hidden once either
          stripe_onboarded or stripe_onboarding_complete flips true
          (the two columns are kept in sync by a DB trigger). */}
      {isOwnProfile && user && profile && !(profile.stripe_onboarded || profile.stripe_onboarding_complete) && (
        <div style={{ background: 'linear-gradient(90deg,rgba(251,191,36,0.08),rgba(251,146,60,0.05))', borderBottom: '1px solid rgba(251,191,36,0.2)', padding: '0.7rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.1rem' }}>💳</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>
              Connect Stripe to sell on FreeTrust
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
              You need a connected Stripe account to publish a paid listing or receive payouts. Takes ~2 minutes.
            </div>
          </div>
          <Link
            href="/wallet?connect=true"
            style={{
              background:    'linear-gradient(135deg,#fbbf24,#f59e0b)',
              color:         '#0f172a',
              border:        'none',
              borderRadius:  8,
              padding:       '0.5rem 1rem',
              fontSize:      '0.82rem',
              fontWeight:    800,
              textDecoration:'none',
              flexShrink:    0,
            }}
          >
            Connect Stripe →
          </Link>
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
        className={isOwnProfile ? 'cover-wrap' : ''}
        style={{ position: 'relative', height: '220px', cursor: isOwnProfile ? 'pointer' : 'default', overflow: 'hidden' }}
        onClick={() => isOwnProfile && !coverUploading && coverInputRef.current?.click()}
        onMouseEnter={() => isOwnProfile && setCoverHover(true)}
        onMouseLeave={() => isOwnProfile && setCoverHover(false)}
      >
        {profile?.cover_url ? (
          <img src={profile.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
      </div>

      {/* Profile header */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          {/* Avatar — overlaps cover */}
          <div
            style={{ position: 'absolute', top: '-52px', left: 0, cursor: isOwnProfile ? 'pointer' : 'default' }}
            onMouseEnter={() => isOwnProfile && setAvatarHover(true)}
            onMouseLeave={() => isOwnProfile && setAvatarHover(false)}
            onClick={() => isOwnProfile && !avatarUploading && avatarInputRef.current?.click()}
            title={isOwnProfile ? 'Change profile photo' : undefined}
          >
            <div style={{ position: 'relative', width: 96, height: 96 }}>
              <Avatar
                url={profile?.avatar_url}
                name={profile?.full_name}
                email={isOwnProfile ? user?.email : undefined}
                size={96}
              />
              {/* Ring */}
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '3px solid #0f172a', pointerEvents: 'none' }} />
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem' }}>
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
                {user && (
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
          <div style={{ paddingTop: '2.5rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.3rem' }}>
              {profile?.full_name ?? user?.email ?? 'Member'}
            </h1>
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
          </div>
        </div>

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

        {/* Services Section */}
        {services.length > 0 && (
          <div className="profile-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>SERVICES ({services.length})</div>
              <Link href="/seller/gigs/create" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
                + Add Service
              </Link>
            </div>
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
                      {svc.avg_rating && svc.review_count ? (
                        <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>⭐ {Number(svc.avg_rating).toFixed(1)} ({svc.review_count})</span>
                      ) : null}
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

        {/* Grassroots Section — same shape as Services so the visual rhythm
            stays consistent. Only renders when the user has at least one
            active listing. Green accent matches the rest of the
            grassroots section. */}
        {grassroots.length > 0 && (
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
        <div className="profile-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', letterSpacing: '0.06em' }}>RECENT ACTIVITY</div>
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

        {/* Seller Tools — own profile only */}
        {isOwnProfile && (
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
        {isOwnProfile && user && (
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
