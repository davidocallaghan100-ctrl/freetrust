'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildCountryOptions } from '@/lib/countries'

type SearchType = 'flights' | 'accommodation' | 'both'
type ResultTab = 'accommodation' | 'flights'

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

const travelCategories = [
  { icon: '🏖️', label: 'Beach & Resort', city: 'Malaga', type: 'both' as SearchType },
  { icon: '🏙️', label: 'City Breaks', city: 'Paris', type: 'both' as SearchType },
  { icon: '🏔️', label: 'Adventure & Nature', city: 'Interlaken', type: 'accommodation' as SearchType },
  { icon: '🗺️', label: 'Cultural Experiences', city: 'Rome', type: 'both' as SearchType },
  { icon: '👨‍👩‍👧', label: 'Family Holidays', city: 'Albufeira', type: 'accommodation' as SearchType },
  { icon: '💑', label: 'Romantic Escapes', city: 'Santorini', type: 'accommodation' as SearchType },
  { icon: '🎒', label: 'Backpacker & Budget', city: 'Lisbon', type: 'flights' as SearchType },
  { icon: '✈️', label: 'Long-Haul Flights', city: 'New York', type: 'flights' as SearchType },
  { icon: '🚢', label: 'Cruise Packages', city: 'Barcelona', type: 'both' as SearchType },
  { icon: '🧘', label: 'Wellness Retreats', city: 'Bali', type: 'accommodation' as SearchType },
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
  const name = pickString(property, ['name', 'title'], pickString(row, ['hotel_name', 'name', 'title'], 'Booking.com hotel'))
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

export default function TravelPage() {
  const router = useRouter()
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
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [lastSearchId, setLastSearchId] = useState<string | null>(null)

  const selectedCountryLabel = countries.find(c => c.code === destinationCountry)?.label || destinationCountry
  const needsFlights = searchType === 'flights' || searchType === 'both'
  const needsAccommodation = searchType === 'accommodation' || searchType === 'both'

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
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      router.push('/login?redirect=/travel')
      return null
    }
    setUserId(data.user.id)
    return data.user
  }

  async function findDestinationId(city: string, kind: 'hotel' | 'flight' = 'hotel') {
    const endpoint = kind === 'flight' ? 'search-flight-destinations' : 'search-destinations'
    const res = await fetch(`/api/travel/${endpoint}?query=${encodeURIComponent(city)}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => null) as { destinations?: Record<string, unknown>[]; error?: string } | null
    if (!res.ok) throw new Error(payload?.error || `Destination search failed (${res.status})`)
    const first = payload?.destinations?.[0]
    if (!first) throw new Error(`No Booking.com destination found for ${city}`)
    return kind === 'flight'
      ? pickString(first, ['id', 'code', 'dest_id', 'city_ufi', 'ufi'], city)
      : pickString(first, ['dest_id', 'id', 'city_ufi', 'ufi'], city)
  }

  async function saveSearch(uid: string) {
    const { data, error: insertError } = await supabase
      .from('travel_searches')
      .insert({
        user_id: uid,
        search_type: searchType,
        destination_country: selectedCountryLabel.replace(/^\S+\s/, ''),
        destination_city: destinationCity || null,
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

  async function runSearch() {
    const user = await requireAuth()
    if (!user) return
    setLoading(true)
    setError(null)
    setHotels([])
    setFlights([])
    try {
      const searchId = await saveSearch(user.id)
      const destinationId = needsAccommodation ? await findDestinationId(destinationCity, 'hotel') : await findDestinationId(destinationCity, 'flight')
      const requests: Promise<void>[] = []

      if (needsAccommodation) {
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
          if (!res.ok) throw new Error(payload?.error || `Hotel search failed (${res.status})`)
          setHotels((payload?.hotels ?? []).slice(0, 12).map(item => mapHotel(item, destinationCity)))
        }))
      }

      if (needsFlights) {
        let fromId = departureCity
        let toId = destinationId
        try { fromId = await findDestinationId(departureCity, 'flight') } catch { /* keep typed city as fallback */ }
        if (needsAccommodation) {
          try { toId = await findDestinationId(destinationCity, 'flight') } catch { /* keep hotel destination id as fallback */ }
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
          if (!res.ok) throw new Error(payload?.error || `Flight search failed (${res.status})`)
          setFlights((payload?.flights ?? []).slice(0, 12).map(item => mapFlight(item, departureCity, destinationCity)))
        }))
      }

      await Promise.all(requests)
      setActiveTab(needsAccommodation ? 'accommodation' : 'flights')
      setLastSearchId(searchId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Travel search failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleCategory(cat: typeof travelCategories[number]) {
    setSearchType(cat.type)
    setDestinationCity(cat.city)
    setTimeout(() => {
      const button = document.getElementById('travel-search-button') as HTMLButtonElement | null
      button?.click()
    }, 0)
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
      if (!res.ok) throw new Error(payload?.error || `Could not save booking (${res.status})`)
      if (payload?.trustAwarded) setToast(`₮${payload.trustAwarded} Trust Coins added to your wallet!`)
      window.open(item.affiliateUrl, '_blank', 'noopener,noreferrer')
      await loadBookings(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save travel booking')
    } finally {
      setBookingLoadingId(null)
    }
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
        <section style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.08),rgba(15,23,42,0))', border: `1px solid ${BORDER}`, borderRadius: 22, padding: 16, boxShadow: '0 18px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: TEAL, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Experience</div>
              <h1 style={{ margin: '4px 0 6px', fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.04em' }}>✈️ Travel</h1>
              <p style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.5, maxWidth: 620 }}>Search flights, stays, and travel bundles while earning Trust Coins for booking activity.</p>
            </div>
            <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 999, padding: '8px 12px', color: ACCENT, fontSize: 12, fontWeight: 900 }}>Powered by Booking.com via RapidAPI</div>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: MUTED, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Step 1 — What are you looking for?</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([
                  ['flights', '✈️ Flights'],
                  ['accommodation', '🏨 Accommodation'],
                  ['both', '🌍 Both'],
                ] as [SearchType, string][]).map(([value, label]) => {
                  const active = searchType === value
                  return (
                    <button key={value} onClick={() => setSearchType(value)} style={{ minHeight: 44, borderRadius: 12, border: active ? `2px solid ${TEAL}` : `1px solid ${BORDER}`, background: active ? 'rgba(0,194,203,0.14)' : CARD_2, color: active ? TEAL : MUTED, padding: '10px 14px', fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
                  )
                })}
              </div>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Step 2 — Country</span>
              <select value={destinationCountry} onChange={e => setDestinationCountry(e.target.value)} style={inputStyle}>
                {countries.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>City</span>
              <input value={destinationCity} onChange={e => setDestinationCity(e.target.value)} placeholder="Paris" autoCorrect="off" spellCheck={false} style={inputStyle} />
            </label>

            {needsFlights && (
              <>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Departure city</span><input value={departureCity} onChange={e => setDepartureCity(e.target.value)} placeholder="Dublin" style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Departure date</span><input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Return date</span><input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Cabin class</span><select value={cabinClass} onChange={e => setCabinClass(e.target.value)} style={inputStyle}><option value="economy">Economy</option><option value="business">Business</option><option value="first">First</option></select></label>
              </>
            )}

            {needsAccommodation && (
              <>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Check-in</span><input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Check-out</span><input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} style={inputStyle} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Rooms</span><input type="number" min="1" value={rooms} onChange={e => setRooms(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} /></label>
              </>
            )}

            <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Adults</span><input type="number" min="1" value={adults} onChange={e => setAdults(Math.max(1, Number(e.target.value) || 1))} style={inputStyle} /></label>
            <label style={{ display: 'grid', gap: 6 }}><span style={{ color: MUTED, fontSize: 12, fontWeight: 800 }}>Children</span><input type="number" min="0" value={children} onChange={e => setChildren(Math.max(0, Number(e.target.value) || 0))} style={inputStyle} /></label>
          </div>

          <button id="travel-search-button" onClick={runSearch} disabled={loading} style={{ marginTop: 14, width: '100%', minHeight: 50, border: 'none', borderRadius: 14, background: loading ? '#334155' : 'linear-gradient(135deg,#00c2cb,#38bdf8)', color: '#0f172a', fontSize: 16, fontWeight: 950, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 14px 34px rgba(56,189,248,0.18)' }}>
            {loading ? 'Searching travel options…' : 'Find Travel Options'}
          </button>
        </section>

        <section style={{ marginTop: 18 }}>
          <SectionTitle eyebrow="Explore by mood" title="Travel categories">Pick a shortcut to pre-fill a travel search with FreeTrust’s marketplace-style discovery tiles.</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {travelCategories.map(cat => (
              <button key={cat.label} onClick={() => void handleCategory(cat)} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.38)' }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = BORDER }} style={{ minHeight: 110, textAlign: 'left', border: `1px solid ${BORDER}`, borderRadius: 16, background: CARD, color: TEXT, padding: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{cat.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>{cat.label}</div>
                <div style={{ marginTop: 5, color: DIM, fontSize: 12 }}>{cat.city} · {cat.type === 'both' ? 'Flights + stays' : cat.type}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <SectionTitle eyebrow="Results" title="Travel options">Real Booking.com results appear here after a search. No fake travel inventory is shown.</SectionTitle>
          {searchType === 'both' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {([
                ['accommodation', `🏨 Accommodation (${hotels.length})`],
                ['flights', `✈️ Flights (${flights.length})`],
              ] as [ResultTab, string][]).map(([tab, label]) => {
                const active = activeTab === tab
                return <button key={tab} onClick={() => setActiveTab(tab)} style={{ minHeight: 44, borderRadius: 999, border: active ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`, background: active ? 'rgba(56,189,248,0.12)' : CARD_2, color: active ? ACCENT : MUTED, padding: '9px 14px', fontSize: 13, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
              })}
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', color: '#fecaca', borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Travel options could not load</div>
              <div style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.5 }}>{error}</div>
              <button onClick={runSearch} style={{ marginTop: 12, minHeight: 44, border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, color: TEXT, padding: '9px 14px', fontWeight: 800, fontFamily: 'inherit' }}>Retry search</button>
            </div>
          )}
          {loading && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>{[1,2,3].map(i => <div key={i} style={{ height: 260, borderRadius: 16, background: 'linear-gradient(90deg,#111827,#1e293b,#111827)', border: `1px solid ${BORDER}` }} />)}</div>}
          {!showResults && <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 18, padding: 22, background: CARD_2, color: MUTED, textAlign: 'center' }}>Choose a category or run a search to see real flights and stays.</div>}

          {!loading && ((searchType !== 'flights' && activeTab === 'accommodation') || searchType === 'accommodation') && hotels.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
              {hotels.map(hotel => (
                <article key={hotel.id} style={{ background: CARD, border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ height: 150, background: hotel.thumbnail ? `url(${hotel.thumbnail}) center/cover` : 'linear-gradient(135deg,#0f766e,#164e63)' }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ color: '#fbbf24', fontSize: 12 }}>{'★'.repeat(Math.max(1, Math.min(5, Math.round(hotel.stars))))}</div>
                    <h3 style={{ margin: '5px 0', fontSize: 16, color: TEXT }}>{hotel.name}</h3>
                    <div style={{ color: DIM, fontSize: 13 }}>{hotel.city || destinationCity}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12 }}>
                      <div><div style={{ color: ACCENT, fontSize: 18, fontWeight: 950 }}>{hotel.priceEur ? `€${hotel.priceEur.toFixed(0)}` : 'View price'}</div><div style={{ color: DIM, fontSize: 11 }}>per night / from API</div></div>
                      <div style={{ color: '#a7f3d0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 999, padding: '5px 8px', fontSize: 12, fontWeight: 900 }}>{hotel.reviewScore ? `${hotel.reviewScore} / 10` : 'Reviewed'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button onClick={() => void saveBooking('accommodation', hotel)} disabled={bookingLoadingId === hotel.id} style={{ flex: 1, minHeight: 44, border: 'none', borderRadius: 12, background: ACCENT, color: BG, fontWeight: 950, cursor: 'pointer', fontFamily: 'inherit' }}>{bookingLoadingId === hotel.id ? 'Saving…' : 'View Deal'}</button>
                      <span style={{ alignSelf: 'center', color: '#a7f3d0', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>Earn ₮25</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && ((searchType !== 'accommodation' && activeTab === 'flights') || searchType === 'flights') && flights.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
              {flights.map(flight => (
                <article key={flight.id} style={{ background: CARD, border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, padding: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: flight.logo ? `${CARD_2} url(${flight.logo}) center/contain no-repeat` : CARD_2, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{flight.logo ? null : '✈️'}</div>
                    <div><div style={{ color: TEXT, fontWeight: 900 }}>{flight.airline}</div><div style={{ color: DIM, fontSize: 12 }}>{flight.stops === 0 ? 'Direct' : flight.stops == null ? 'Stops vary' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`}</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: TEXT, fontWeight: 950, fontSize: 15 }}><span>{flight.from}</span><span style={{ color: ACCENT }}>→</span><span>{flight.to}</span></div>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: MUTED, fontSize: 12 }}><div>Depart<br /><strong style={{ color: TEXT }}>{flight.departTime}</strong></div><div>Arrive<br /><strong style={{ color: TEXT }}>{flight.arriveTime}</strong></div><div>Duration<br /><strong style={{ color: TEXT }}>{flight.duration}</strong></div><div>Price<br /><strong style={{ color: ACCENT, fontSize: 18 }}>{flight.priceEur ? `€${flight.priceEur.toFixed(0)}` : 'View price'}</strong></div></div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button onClick={() => void saveBooking('flight', flight)} disabled={bookingLoadingId === flight.id} style={{ flex: 1, minHeight: 44, border: 'none', borderRadius: 12, background: ACCENT, color: BG, fontWeight: 950, cursor: 'pointer', fontFamily: 'inherit' }}>{bookingLoadingId === flight.id ? 'Saving…' : 'Book Flight'}</button><span style={{ alignSelf: 'center', color: '#a7f3d0', fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>Earn ₮20</span></div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 26 }}>
          <SectionTitle eyebrow="My bookings" title="Travel booking activity">Pending outbound booking clicks and Trust Coin awards for your account.</SectionTitle>
          {!userId && <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 18, color: MUTED, background: CARD_2 }}>Sign in to save travel booking activity.</div>}
          {userId && bookings.length === 0 && <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 18, color: MUTED, background: CARD_2 }}>No travel bookings yet.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
            {bookings.map(booking => (
              <article key={booking.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: ACCENT, fontWeight: 950, fontSize: 12, textTransform: 'uppercase' }}>{booking.booking_type}</span><span style={{ borderRadius: 999, background: booking.status === 'confirmed' ? 'rgba(16,185,129,0.12)' : booking.status === 'cancelled' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)', color: booking.status === 'confirmed' ? '#86efac' : booking.status === 'cancelled' ? '#fca5a5' : '#fde68a', padding: '3px 8px', fontSize: 11, fontWeight: 900 }}>{booking.status}</span></div>
                <div style={{ marginTop: 8, color: TEXT, fontWeight: 900 }}>{booking.property_name || booking.airline || booking.destination_city || 'Travel booking'}</div>
                <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>{booking.destination_city || 'Destination'}{booking.destination_country ? ` · ${booking.destination_country}` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: MUTED, fontSize: 12 }}><span>{booking.check_in || booking.departure_date || 'Date pending'}</span><strong style={{ color: ACCENT }}>{booking.price_eur ? `€${Number(booking.price_eur).toFixed(0)}` : 'External price'}</strong></div>
                <div style={{ marginTop: 8, color: '#a7f3d0', fontSize: 12, fontWeight: 900 }}>₮{booking.trust_coins_earned ?? 0} earned</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
