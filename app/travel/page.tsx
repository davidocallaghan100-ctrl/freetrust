'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { buildCountryOptions } from '@/lib/countries'

type SearchType = 'flights' | 'accommodation' | 'both'
type ResultTab = 'accommodation' | 'flights'
type TravelSearchOverrides = { searchType?: SearchType; destinationCity?: string; destinationCountry?: string }

type TravelBooking = {
  id: string
  booking_type: 'flight' | 'accommodation' | 'bundle'
  destination_country: string | null
  destination_city: string | null
  property_name: string | null
  airline: string | null
  price_eur: number | null
  currency: string | null
  check_in: string | null
  check_out: string | null
  departure_date: string | null
  return_date: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
  affiliate_url: string | null
  trust_coins_earned: number | null
  created_at: string
}

type HotelCard = {
  id: string
  name: string
  city: string
  stars: number
  reviewScore: number | null
  priceEur: number | null
  thumbnail: string | null
  affiliateUrl: string
  raw: Record<string, unknown>
}

type FlightCard = {
  id: string
  airline: string
  logo: string | null
  from: string
  to: string
  departTime: string
  arriveTime: string
  duration: string
  stops: number | null
  priceEur: number | null
  affiliateUrl: string
  raw: Record<string, unknown>
}

const ACCENT = '#38bdf8'
const TEAL = '#00c2cb'
const BG = '#0f172a'
const CARD = '#1e293b'
const CARD_2 = '#111827'
const BORDER = '#334155'
const MUTED = '#94a3b8'
const DIM = '#64748b'
const TEXT = '#f1f5f9'

const travelCategoryConfigs = [
  { key: 'cityBreaks', icon: '🏙️', city: 'Paris', countryCode: 'FR', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80', type: 'both' as SearchType },
  { key: 'beachResort', icon: '🏖️', city: 'Malaga', countryCode: 'ES', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80', type: 'both' as SearchType },
  { key: 'adventureNature', icon: '🏔️', city: 'Interlaken', countryCode: 'CH', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80', type: 'accommodation' as SearchType },
  { key: 'culturalExperiences', icon: '🗺️', city: 'Rome', countryCode: 'IT', image: 'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=900&q=80', type: 'both' as SearchType },
  { key: 'familyHolidays', icon: '👨‍👩‍👧', city: 'Albufeira', countryCode: 'PT', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=80', type: 'accommodation' as SearchType },
  { key: 'romanticEscapes', icon: '💑', city: 'Santorini', countryCode: 'GR', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=900&q=80', type: 'accommodation' as SearchType },
  { key: 'backpackerBudget', icon: '🎒', city: 'Lisbon', countryCode: 'PT', image: 'https://images.unsplash.com/photo-1548707309-dcebeab9ea9b?auto=format&fit=crop&w=900&q=80', type: 'flights' as SearchType },
  { key: 'longHaulFlights', icon: '✈️', city: 'New York', countryCode: 'US', image: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=900&q=80', type: 'flights' as SearchType },
  { key: 'cruisePackages', icon: '🚢', city: 'Barcelona', countryCode: 'ES', image: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=900&q=80', type: 'both' as SearchType },
  { key: 'wellnessRetreats', icon: '🧘', city: 'Bali', countryCode: 'ID', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80', type: 'accommodation' as SearchType },
]

const inputStyle = {
  width: '100%',
  minHeight: 44,
  background: CARD_2,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  color: TEXT,
  padding: '10px 12px',
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
}

function pickString(obj: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function bookingSearchUrl(city: string, type: SearchType) {
  const url = new URL(type === 'flights' ? 'https://www.booking.com/flights/' : 'https://www.booking.com/searchresults.html')
  if (city) url.searchParams.set('ss', city)
  url.searchParams.set('utm_source', 'freetrust')
  url.searchParams.set('utm_medium', 'affiliate')
  url.searchParams.set('utm_campaign', 'travel_marketplace')
  return url.toString()
}

function mapHotel(item: unknown, destinationCity: string): HotelCard {
  const row = asRecord(item)
  const property = asRecord(row.property)
  const accessibility = asRecord(row.accessibilityLabel)
  const priceBreakdown = asRecord(property.priceBreakdown || row.priceBreakdown)
  const grossPrice = asRecord(priceBreakdown.grossPrice)
  const reviewScore = asRecord(property.reviewScore || row.reviewScore)
  const photo = asRecord(property.photoUrls || row.photoUrls)
  const photoUrls = Array.isArray(property.photoUrls) ? property.photoUrls : Array.isArray(row.photoUrls) ? row.photoUrls : []
  const hotelId = pickString(property, ['id', 'hotel_id'], pickString(row, ['id', 'hotel_id'], `hotel-${Math.random()}`))
  const name = pickString(property, ['name', 'title'], pickString(row, ['hotel_name', 'name', 'title'], 'Travel partner stay'))
  const city = pickString(property, ['wishlistName', 'city'], pickString(row, ['city', 'city_name'], destinationCity))
  const directUrl = pickString(property, ['url', 'deeplink'], pickString(row, ['url', 'deeplink', 'affiliate_url']))
  const price = pickNumber(grossPrice, ['value', 'amount']) ?? pickNumber(property, ['price', 'price_eur']) ?? pickNumber(row, ['price', 'price_eur'])

  return {
    id: hotelId,
    name,
    city,
    stars: pickNumber(property, ['accuratePropertyClass', 'propertyClass']) ?? pickNumber(row, ['stars', 'class']) ?? 4,
    reviewScore: pickNumber(reviewScore, ['score']) ?? pickNumber(property, ['reviewScore']) ?? pickNumber(row, ['review_score', 'rating']),
    priceEur: price,
    thumbnail: typeof photoUrls[0] === 'string' ? photoUrls[0] : pickString(photo, ['url'], pickString(row, ['thumbnail', 'image'], '')) || null,
    affiliateUrl: directUrl || bookingSearchUrl(city || destinationCity, 'accommodation'),
    raw: row,
  }
}

function mapFlight(item: unknown, departureCity: string, destinationCity: string): FlightCard {
  const row = asRecord(item)
  const segments = Array.isArray(row.segments) ? row.segments : []
  const firstSegment = asRecord(segments[0])
  const lastSegment = asRecord(segments[segments.length - 1])
  const travellerPrices = Array.isArray(row.travellerPrices) ? row.travellerPrices : []
  const firstPrice = asRecord(travellerPrices[0])
  const priceBreakdown = asRecord(row.priceBreakdown || firstPrice.travellerPriceBreakdown)
  const total = asRecord(priceBreakdown.total || priceBreakdown.grossPrice)
  const airline = asRecord(row.airline || firstSegment.airline)
  const legs = Array.isArray(row.legs) ? row.legs : []
  const firstLeg = asRecord(legs[0])
  const carrier = asRecord(firstLeg.carriers)
  const carriersData = Array.isArray(carrier.marketing) ? carrier.marketing : []
  const carrierData = asRecord(carriersData[0])
  const id = pickString(row, ['token', 'id', 'offerId'], `flight-${Math.random()}`)
  const directUrl = pickString(row, ['deeplink', 'url', 'affiliate_url'])
  const departAirport = asRecord(firstSegment.departureAirport || firstLeg.departureAirport)
  const arriveAirport = asRecord(lastSegment.arrivalAirport || firstLeg.arrivalAirport)

  return {
    id,
    airline: pickString(carrierData, ['name'], pickString(airline, ['name'], pickString(row, ['airline', 'carrier'], 'Airline'))),
    logo: pickString(carrierData, ['logoUrl', 'logo'], pickString(airline, ['logoUrl', 'logo'], '')) || null,
    from: pickString(departAirport, ['cityName', 'name', 'code'], departureCity || 'Departure'),
    to: pickString(arriveAirport, ['cityName', 'name', 'code'], destinationCity || 'Destination'),
    departTime: pickString(firstSegment, ['departureTime', 'departTime'], pickString(firstLeg, ['departureTime'], '—')),
    arriveTime: pickString(lastSegment, ['arrivalTime', 'arriveTime'], pickString(firstLeg, ['arrivalTime'], '—')),
    duration: pickString(firstLeg, ['totalTime', 'duration'], pickString(row, ['duration'], '—')),
    stops: pickNumber(firstLeg, ['stopCount', 'stops']) ?? (segments.length > 0 ? Math.max(segments.length - 1, 0) : null),
    priceEur: pickNumber(total, ['units', 'value', 'amount']) ?? pickNumber(priceBreakdown, ['total', 'price']) ?? pickNumber(row, ['price', 'price_eur']),
    affiliateUrl: directUrl || bookingSearchUrl(destinationCity, 'flights'),
    raw: row,
  }
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: TEAL, fontSize: 11, letterSpacing: '0.1em', fontWeight: 900, textTransform: 'uppercase' }}>{eyebrow}</div>
      <h2 style={{ margin: '4px 0', fontSize: 20, color: TEXT, letterSpacing: '-0.02em' }}>{title}</h2>
      {children && <p style={{ margin: 0, color: DIM, fontSize: 13, lineHeight: 1.5 }}>{children}</p>}
    </div>
  )
}

function goToTravelLogin() {
  window.location.assign('/login?redirect=/travel')
}

export default function TravelPage() {
  const t = useTranslations('travel')
  const supabase = useMemo(() => createClient(), [])
  const countries = useMemo(() => buildCountryOptions(new Map()), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [searchType, setSearchType] = useState<SearchType>('both')
  const [destinationCountry, setDestinationCountry] = useState('IE')
  const [destinationCity, setDestinationCity] = useState('Paris')
  const [departureCity, setDepartureCity] = useState('Dublin')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [rooms, setRooms] = useState(1)
  const [cabinClass, setCabinClass] = useState('economy')
  const [hotels, setHotels] = useState<HotelCard[]>([])
  const [flights, setFlights] = useState<FlightCard[]>([])
  const [bookings, setBookings] = useState<TravelBooking[]>([])
  const [activeTab, setActiveTab] = useState<ResultTab>('accommodation')
  const [loading, setLoading] = useState(false)
  const [bookingLoadingId, setBookingLoadingId] = useState<string | null>(null)
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lastSearchId, setLastSearchId] = useState<string | null>(null)

  const getCountryLabel = useCallback((code: string) => countries.find(c => c.code === code)?.label || code, [countries])
  const selectedCountryLabel = getCountryLabel(destinationCountry)
  const needsFlights = searchType === 'flights' || searchType === 'both'
  const needsAccommodation = searchType === 'accommodation' || searchType === 'both'
  const travelCategories = useMemo(() => travelCategoryConfigs.map(cat => ({
    ...cat,
    label: t(`categories.${cat.key}.label`),
    copy: t(`categories.${cat.key}.copy`),
    country: t(`categories.${cat.key}.country`),
    badge: t(`typeBadges.${cat.type}`),
  })), [t])

  const loadBookings = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('travel_bookings')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(12)
    setBookings((data ?? []) as TravelBooking[])
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setUserId(data.user?.id ?? null)
      if (data.user?.id) void loadBookings(data.user.id)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [supabase, loadBookings])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(t)
  }, [toast])

  async function requireAuth() {
    if (!userId) {
      goToTravelLogin()
      return null
    }
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      goToTravelLogin()
      return null
    }
    setUserId(data.user.id)
    return data.user
  }

  async function findDestinationId(city: string, kind: 'hotel' | 'flight' = 'hotel') {
    const endpoint = kind === 'flight' ? 'search-flight-destinations' : 'search-destinations'
    const res = await fetch(`/api/travel/${endpoint}?query=${encodeURIComponent(city)}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => null) as { destinations?: Record<string, unknown>[]; error?: string } | null
    if (!res.ok) throw new Error(payload?.error || t('errors.destinationSearchFailed', { status: res.status }))
    const first = payload?.destinations?.[0]
    if (!first) throw new Error(t('errors.destinationNotFound', { city }))
    return kind === 'flight'
      ? pickString(first, ['id', 'code', 'dest_id', 'city_ufi', 'ufi'], city)
      : pickString(first, ['dest_id', 'id', 'city_ufi', 'ufi'], city)
  }

  async function saveSearch(uid: string, overrides: TravelSearchOverrides = {}) {
    const searchTypeValue = overrides.searchType ?? searchType
    const destinationCityValue = overrides.destinationCity ?? destinationCity
    const destinationCountryValue = overrides.destinationCountry ?? destinationCountry
    const { data, error: insertError } = await supabase
      .from('travel_searches')
      .insert({
        user_id: uid,
        search_type: searchTypeValue,
        destination_country: getCountryLabel(destinationCountryValue).replace(/^\S+\s/, ''),
        destination_city: destinationCityValue || null,
        departure_city: departureCity || null,
        check_in: checkIn || null,
        check_out: checkOut || null,
        departure_date: departureDate || null,
        return_date: returnDate || null,
        adults,
        children,
        rooms,
        cabin_class: cabinClass,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(insertError.message)
    setLastSearchId(data.id)
    return data.id as string
  }

  async function runSearch(overrides: TravelSearchOverrides = {}) {
    const user = await requireAuth()
    if (!user) return
    const searchTypeValue = overrides.searchType ?? searchType
    const destinationCityValue = overrides.destinationCity ?? destinationCity
    const needsFlightsValue = searchTypeValue === 'flights' || searchTypeValue === 'both'
    const needsAccommodationValue = searchTypeValue === 'accommodation' || searchTypeValue === 'both'
    setLoading(true)
    setError(null)
    setHotels([])
    setFlights([])
    try {
      const searchId = await saveSearch(user.id, overrides)
      const destinationId = needsAccommodationValue ? await findDestinationId(destinationCityValue, 'hotel') : await findDestinationId(destinationCityValue, 'flight')
      const requests: Promise<void>[] = []

      if (needsAccommodationValue) {
        const params = new URLSearchParams({
          dest_id: destinationId,
          search_type: 'CITY',
          arrival_date: checkIn || new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
          departure_date: checkOut || new Date(Date.now() + 86400000 * 17).toISOString().slice(0, 10),
          adults: String(adults),
          room_qty: String(rooms),
        })
        if (children > 0) params.set('children_age', Array.from({ length: children }, () => '8').join(','))
        requests.push(fetch(`/api/travel/search-hotels?${params.toString()}`, { cache: 'no-store' }).then(async res => {
          const payload = await res.json().catch(() => null) as { hotels?: unknown[]; error?: string } | null
          if (!res.ok) throw new Error(payload?.error || t('errors.hotelSearchFailed', { status: res.status }))
          setHotels((payload?.hotels ?? []).slice(0, 12).map(item => mapHotel(item, destinationCityValue)))
        }))
      }

      if (needsFlightsValue) {
        let fromId = departureCity
        let toId = destinationId
        try { fromId = await findDestinationId(departureCity, 'flight') } catch { /* keep typed city as fallback */ }
        if (needsAccommodationValue) {
          try { toId = await findDestinationId(destinationCityValue, 'flight') } catch { /* keep hotel destination id as fallback */ }
        }
        const params = new URLSearchParams({
          fromId,
          toId,
          departDate: departureDate || new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
          adults: String(adults),
          cabinClass,
        })
        if (returnDate) params.set('returnDate', returnDate)
        requests.push(fetch(`/api/travel/search-flights?${params.toString()}`, { cache: 'no-store' }).then(async res => {
          const payload = await res.json().catch(() => null) as { flights?: unknown[]; error?: string } | null
          if (!res.ok) throw new Error(payload?.error || t('errors.flightSearchFailed', { status: res.status }))
          setFlights((payload?.flights ?? []).slice(0, 12).map(item => mapFlight(item, departureCity, destinationCityValue)))
        }))
      }

      await Promise.all(requests)
      setActiveTab(needsAccommodationValue ? 'accommodation' : 'flights')
      setLastSearchId(searchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.travelSearchFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCategory(cat: typeof travelCategories[number]) {
    setSearchType(cat.type)
    setDestinationCity(cat.city)
    setDestinationCountry(cat.countryCode)
    if (!userId) {
      goToTravelLogin()
      return
    }
    await runSearch({ searchType: cat.type, destinationCity: cat.city, destinationCountry: cat.countryCode })
  }

  async function saveBooking(kind: 'flight' | 'accommodation' | 'bundle', item: HotelCard | FlightCard) {
    const user = await requireAuth()
    if (!user) return
    setBookingLoadingId(item.id)
    setError(null)
    try {
      const hotel = kind === 'accommodation' ? item as HotelCard : null
      const flight = kind === 'flight' ? item as FlightCard : null
      const res = await fetch('/api/travel/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchId: lastSearchId,
          bookingType: kind,
          externalId: item.id,
          destinationCountry: selectedCountryLabel.replace(/^\S+\s/, ''),
          destinationCity,
          propertyName: hotel?.name ?? null,
          airline: flight?.airline ?? null,
          priceEur: item.priceEur,
          currency: 'EUR',
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          departureDate: departureDate || null,
          returnDate: returnDate || null,
          adults,
          rooms,
          affiliateUrl: item.affiliateUrl,
        }),
      })
      const payload = await res.json().catch(() => null) as { trustAwarded?: number; error?: string } | null
      if (!res.ok) throw new Error(payload?.error || t('errors.saveActivityFailedWithStatus', { status: res.status }))
      if (payload?.trustAwarded) setToast(t('toasts.trustCoinsAdded', { amount: payload.trustAwarded }))
      await loadBookings(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveActivityFailed'))
    } finally {
      setBookingLoadingId(null)
    }
  }

  function startBooking(kind: 'flight' | 'accommodation' | 'bundle', item: HotelCard | FlightCard) {
    if (!userId) {
      goToTravelLogin()
      return
    }
    const opened = window.open(item.affiliateUrl, '_blank', 'noopener,noreferrer')
      if (!opened) setToast(t('toasts.popupBlocked'))
    void saveBooking(kind, item)
  }

  async function cancelBooking(bookingId: string) {
    const user = await requireAuth()
    if (!user) return
    setCancellingBookingId(bookingId)
    setError(null)
    try {
      const res = await fetch('/api/travel/book/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const payload = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error || t('errors.cancelActivityFailedWithStatus', { status: res.status }))
      setToast(t('toasts.activityCancelled'))
      await loadBookings(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.cancelActivityFailed'))
    } finally {
      setCancellingBookingId(null)
    }
  }

  function handleBookingKey(event: KeyboardEvent<HTMLElement>, kind: 'flight' | 'accommodation' | 'bundle', item: HotelCard | FlightCard) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    startBooking(kind, item)
  }

  const showResults = hotels.length > 0 || flights.length > 0 || loading || error

  return (
    <main style={{ minHeight: '100vh', background: BG, color: TEXT, padding: '18px 12px 96px' }}>
      {toast && (
        <div style={{ position: 'sticky', top: 70, zIndex: 20, maxWidth: 1180, margin: '0 auto 12px', background: 'rgba(0,194,203,0.14)', border: '1px solid rgba(0,194,203,0.35)', color: '#a7f3d0', borderRadius: 14, padding: '12px 14px', fontSize: 14, fontWeight: 800 }}>
          {toast}
        </div>
      )}
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <section style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.08),rgba(15,23,42,0))', border: `1px solid ${BORDER}`, borderRadius: 22, padding: 14, boxShadow: '0 18px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: TEAL, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('hero.eyebrow')}</div>
              <h1 style={{ margin: '3px 0 5px', fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.04em' }}>✈️ {t('title')}</h1>
              <p style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.5, maxWidth: 620 }}>{t('hero.subtitle')}</p>
            </div>
            <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 999, padding: '8px 12px', color: ACCENT, fontSize: 12, fontWeight: 900 }}>{t('hero.badge')}</div>
          </div>

          {!userId && (
            <div style={{ marginTop: 16, border: '1px solid rgba(56,189,248,0.28)', background: 'linear-gradient(135deg,rgba(56,189,248,0.12),rgba(0,194,203,0.07))', borderRadius: 16, padding: 14, color: '#dff7ff', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div><strong style={{ color: TEXT }}>{t('membersOnly.title')}</strong><div style={{ color: MUTED, fontSize: 13, marginTop: 3 }}>{t('membersOnly.body')}</div></div>
              <a href="/login?redirect=/travel" style={{ minHeight: 44, border: 'none', borderRadius: 999, background: ACCENT, color: BG, padding: '9px 14px', fontWeight: 950, fontFamily: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{t('membersOnly.cta')}</a>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 9, alignItems: 'end' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.tripType')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  ['flights', `✈️ ${t('flights')}`],
                  ['accommodation', `🏨 ${t('accommodation')}`],
                  ['both', `🌍 ${t('both')}`],
                ] as [SearchType, string][]).map(([value, label]) => {
                  const active = searchType === value
                  return (
                    <button key={value} onClick={() => setSearchType(value)} style={{ minHeight: 44, borderRadius: 12, border: active ? `2px solid ${TEAL}` : `1px solid ${BORDER}`, background: active ? 'rgba(0,194,203,0.14)' : CARD_2, color: active ? TEAL : MUTED, padding: '8px 10px', fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', flex: '1 1 92px' }}>{label}</button>
                  )
                })}
              </div>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.country')}</span>
              <select value={destinationCountry} onChange={e => setDestinationCountry(e.target.value)} style={inputStyle}>
                {countries.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.city')}</span>
              <input value={destinationCity} onChange={e => setDestinationCity(e.target.value)} placeholder={t('placeholders.destinationCity')} autoCorrect="off" spellCheck={false} style={inputStyle} />
            </label>

            {needsFlights && (
              <>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.from')}</span><input value={departureCity} onChange={e => setDepartureCity(e.target.value)} placeholder={t('placeholders.departureCity')} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.depart')}</span><input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.return')}</span><input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('fields.cabin')}</span><select value={cabinClass} onChange={e => setCabinClass(e.target.value)} style={inputStyle}><option value="economy">{t('cabin.economy')}</option><option value="business">{t('cabin.business')}</option><option value="first">{t('cabin.first')}</option></select></label>
              </>
            )}

            {needsAccommodation && (
              <>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('checkIn')}</span><input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('checkOut')}</span><input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('rooms')}</span><input type="number" min="1" value={rooms} onChange={e => setRooms(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} /></label>
              </>
            )}

            <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('adults')}</span><input type="number" min="1" value={adults} onChange={e => setAdults(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} /></label>
            <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{t('children')}</span><input type="number" min="0" value={children} onChange={e => setChildren(Math.max(0, Number(e.target.value) || 0))} style={inputStyle} /></label>
          </div>

          {userId ? (
            <button id="travel-search-button" onClick={() => void runSearch()} disabled={loading} style={{ marginTop: 12, width: '100%', minHeight: 46, border: 'none', borderRadius: 14, background: loading ? '#334155' : 'linear-gradient(135deg,#00c2cb,#38bdf8)', color: '#0f172a', fontSize: 16, fontWeight: 950, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 14px 34px rgba(56,189,248,0.18)' }}>
              {loading ? t('searching') : t('searchButton')}
            </button>
          ) : (
            <a id="travel-search-button" href="/login?redirect=/travel" style={{ marginTop: 12, width: '100%', minHeight: 46, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#00c2cb,#38bdf8)', color: '#0f172a', fontSize: 16, fontWeight: 950, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 14px 34px rgba(56,189,248,0.18)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {t('signInSearch')}
            </a>
          )}
        </section>

        <section style={{ marginTop: 18 }}>
          <SectionTitle eyebrow={t('categoriesSection.eyebrow')} title={t('categoriesSection.title')}>{t('categoriesSection.body')}</SectionTitle>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden', padding: '2px 2px 14px', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
            {travelCategories.map(cat => (
              <button key={cat.label} onClick={() => void handleCategory(cat)} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)' }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = BORDER }} style={{ flex: '0 0 228px', minHeight: 238, textAlign: 'left', border: `1px solid ${BORDER}`, borderRadius: 20, background: CARD, color: TEXT, padding: 0, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 14px 36px rgba(0,0,0,0.18)', scrollSnapAlign: 'start', overflow: 'hidden' }}>
                <div style={{ height: 126, background: `linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.78)), url(${cat.image}) center/cover`, position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 10, left: 10, width: 38, height: 38, borderRadius: 14, background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{cat.icon}</span>
                  <span style={{ position: 'absolute', right: 10, bottom: 10, borderRadius: 999, padding: '5px 8px', background: 'rgba(15,23,42,0.78)', border: '1px solid rgba(56,189,248,0.32)', color: ACCENT, fontSize: 10, fontWeight: 950, textTransform: 'uppercase' }}>{cat.badge}</span>
                </div>
                <div style={{ padding: 13 }}>
                  <div style={{ fontSize: 15, fontWeight: 950 }}>{cat.label}</div>
                  <div style={{ marginTop: 4, color: MUTED, fontSize: 12 }}>{cat.city}, {cat.country}</div>
                  <p style={{ margin: '8px 0 0', color: DIM, fontSize: 12, lineHeight: 1.45 }}>{cat.copy}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <SectionTitle eyebrow={t('results.eyebrow')} title={t('results.title')}>{t('results.body')}</SectionTitle>
          {searchType === 'both' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {([
                ['accommodation', `🏨 ${t('accommodation')} (${hotels.length})`],
                ['flights', `✈️ ${t('flights')} (${flights.length})`],
              ] as [ResultTab, string][]).map(([tab, label]) => {
                const active = activeTab === tab
                return <button key={tab} onClick={() => setActiveTab(tab)} style={{ minHeight: 44, borderRadius: 999, border: active ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`, background: active ? 'rgba(56,189,248,0.12)' : CARD_2, color: active ? ACCENT : MUTED, padding: '9px 14px', fontSize: 13, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
              })}
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', color: '#fecaca', borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>{t('errors.loadTitle')}</div>
              <div style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>{error}</div>
              <button onClick={() => void runSearch()} style={{ marginTop: 12, minHeight: 44, border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, color: TEXT, padding: '9px 14px', fontWeight: 800, fontFamily: 'inherit' }}>{t('retrySearch')}</button>
            </div>
          )}
          {loading && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>{[1,2,3].map(i => <div key={i} style={{ height: 260, borderRadius: 16, background: 'linear-gradient(90deg,#111827,#1e293b,#111827)', border: `1px solid ${BORDER}` }} />)}</div>}
          {!showResults && <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 18, padding: 22, background: CARD_2, color: MUTED, textAlign: 'center' }}>{t('results.empty')}</div>}

          {!loading && ((searchType !== 'flights' && activeTab === 'accommodation') || searchType === 'accommodation') && hotels.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
              {hotels.map(hotel => (
                <article key={hotel.id} role="button" tabIndex={0} onClick={() => startBooking('accommodation', hotel)} onKeyDown={event => handleBookingKey(event, 'accommodation', hotel)} style={{ background: CARD, border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 14px 34px rgba(0,0,0,0.16)' }}>
                  <div style={{ height: 150, background: hotel.thumbnail ? `url(${hotel.thumbnail}) center/cover` : 'linear-gradient(135deg,#0f766e,#164e63)' }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ color: '#fbbf24', fontSize: 12 }}>{'★'.repeat(Math.max(1, Math.min(5, Math.round(hotel.stars))))}</div>
                    <h3 style={{ margin: '5px 0', fontSize: 16, color: TEXT }}>{hotel.name}</h3>
                    <div style={{ color: DIM, fontSize: 13 }}>{hotel.city || destinationCity}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12 }}>
                      <div><div style={{ color: ACCENT, fontSize: 18, fontWeight: 950 }}>{hotel.priceEur ? `€${hotel.priceEur.toFixed(0)}` : t('cards.viewPrice')}</div><div style={{ color: DIM, fontSize: 11 }}>{t('cards.perNightEstimate')}</div></div>
                      <div style={{ color: '#a7f3d0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 999, padding: '5px 8px', fontSize: 12, fontWeight: 900 }}>{hotel.reviewScore ? t('cards.reviewScore', { score: hotel.reviewScore }) : t('cards.reviewed')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                       <button onClick={event => { event.stopPropagation(); startBooking('accommodation', hotel) }} disabled={bookingLoadingId === hotel.id} style={{ flex: 1, minHeight: 44, border: 'none', borderRadius: 12, background: ACCENT, color: BG, fontWeight: 950, cursor: 'pointer', fontFamily: 'inherit' }}>{bookingLoadingId === hotel.id ? t('saving') : t('cards.viewDeal')}</button>
                       <span style={{ alignSelf: 'center', color: '#a7f3d0', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{t('cards.earn', { amount: 25 })}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && ((searchType !== 'accommodation' && activeTab === 'flights') || searchType === 'flights') && flights.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
              {flights.map(flight => (
                <article key={flight.id} role="button" tabIndex={0} onClick={() => startBooking('flight', flight)} onKeyDown={event => handleBookingKey(event, 'flight', flight)} style={{ background: CARD, border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: 14, cursor: 'pointer', boxShadow: '0 14px 34px rgba(0,0,0,0.16)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: flight.logo ? `${CARD_2} url(${flight.logo}) center/contain no-repeat` : CARD_2, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{flight.logo ? null : '✈️'}</div>
                    <div><div style={{ color: TEXT, fontWeight: 900 }}>{flight.airline}</div><div style={{ color: DIM, fontSize: 12 }}>{flight.stops === 0 ? t('cards.direct') : flight.stops == null ? t('cards.stopsVary') : t('cards.stops', { count: flight.stops })}</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: TEXT, fontWeight: 950, fontSize: 15 }}><span>{flight.from}</span><span style={{ color: ACCENT }}>→</span><span>{flight.to}</span></div>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: MUTED, fontSize: 12 }}><div>{t('cards.depart')}<br /><strong style={{ color: TEXT }}>{flight.departTime}</strong></div><div>{t('cards.arrive')}<br /><strong style={{ color: TEXT }}>{flight.arriveTime}</strong></div><div>{t('cards.duration')}<br /><strong style={{ color: TEXT }}>{flight.duration}</strong></div><div>{t('cards.price')}<br /><strong style={{ color: ACCENT, fontSize: 18 }}>{flight.priceEur ? `€${flight.priceEur.toFixed(0)}` : t('cards.viewPrice')}</strong></div></div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button onClick={event => { event.stopPropagation(); startBooking('flight', flight) }} disabled={bookingLoadingId === flight.id} style={{ flex: 1, minHeight: 44, border: 'none', borderRadius: 12, background: ACCENT, color: BG, fontWeight: 950, cursor: 'pointer', fontFamily: 'inherit' }}>{bookingLoadingId === flight.id ? t('saving') : t('cards.bookFlight')}</button><span style={{ alignSelf: 'center', color: '#a7f3d0', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{t('cards.earn', { amount: 20 })}</span></div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 26 }}>
          <SectionTitle eyebrow={t('activity.eyebrow')} title={t('activity.title')}>{t('activity.body')}</SectionTitle>
          {!userId && <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 18, color: MUTED, background: CARD_2 }}>{t('activity.signIn')}</div>}
          {userId && bookings.length === 0 && <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 18, color: MUTED, background: CARD_2 }}>{t('activity.empty')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
            {bookings.map(booking => (
              <article key={booking.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: ACCENT, fontWeight: 950, fontSize: 12, textTransform: 'uppercase' }}>{t(`bookingTypes.${booking.booking_type}`)}</span><span style={{ borderRadius: 999, background: booking.status === 'confirmed' ? 'rgba(16,185,129,0.12)' : booking.status === 'cancelled' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)', color: booking.status === 'confirmed' ? '#86efac' : booking.status === 'cancelled' ? '#fca5a5' : '#fde68a', padding: '3px 8px', fontSize: 11, fontWeight: 900 }}>{booking.status === 'pending' ? t('activity.openedProvider') : booking.status === 'cancelled' ? t('activity.cancelled') : t('activity.confirmed')}</span></div>
                <div style={{ marginTop: 8, color: TEXT, fontWeight: 900 }}>{booking.property_name || booking.airline || booking.destination_city || t('activity.fallbackTitle')}</div>
                <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>{booking.destination_city || t('activity.destination')}{booking.destination_country ? ` · ${booking.destination_country}` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: MUTED, fontSize: 12 }}><span>{booking.check_in || booking.departure_date || t('activity.datePending')}</span><strong style={{ color: ACCENT }}>{booking.price_eur ? `€${Number(booking.price_eur).toFixed(0)}` : t('activity.externalPrice')}</strong></div>
                <div style={{ marginTop: 8, color: '#a7f3d0', fontSize: 12, fontWeight: 900 }}>{t('activity.earned', { amount: booking.trust_coins_earned ?? 0 })}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {booking.affiliate_url && <a href={booking.affiliate_url} target="_blank" rel="noreferrer" style={{ minHeight: 40, borderRadius: 10, background: CARD_2, border: `1px solid ${BORDER}`, color: TEXT, padding: '9px 11px', fontSize: 12, fontWeight: 900, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{t('activity.continue')}</a>}
                  {booking.status !== 'cancelled' && <button onClick={() => void cancelBooking(booking.id)} disabled={cancellingBookingId === booking.id} style={{ minHeight: 40, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', color: '#fecaca', padding: '9px 11px', fontSize: 12, fontWeight: 900, fontFamily: 'inherit', cursor: cancellingBookingId === booking.id ? 'wait' : 'pointer' }}>{cancellingBookingId === booking.id ? t('activity.cancelling') : t('activity.cancel')}</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
