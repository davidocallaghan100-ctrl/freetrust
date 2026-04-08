
"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"

const CATEGORIES = [
  { value: "all", label: "All", icon: "🔍" },
  { value: "service", label: "Services", icon: "🔧" },
  { value: "product", label: "Products", icon: "📦" },
  { value: "event", label: "Events", icon: "📅" },
  { value: "organisation", label: "Organisations", icon: "🏢" },
  { value: "article", label: "Articles", icon: "📰" },
  { value: "member", label: "Members", icon: "👤" },
]

interface SearchFiltersProps {
  query: string
  category: string
  location: string
  priceMin: string
  priceMax: string
  trustScore: string
}

export default function SearchFilters({
  query,
  category,
  location,
  priceMin,
  priceMax,
  trustScore,
}: SearchFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [localLocation, setLocalLocation] = useState(location)
  const [localPriceMin, setLocalPriceMin] = useState(priceMin)
  const [localPriceMax, setLocalPriceMax] = useState(priceMax)
  const [localTrust, setLocalTrust] = useState(trustScore)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    params.set("category", category)
    if (localLocation) params.set("location", localLocation)
    if (localPriceMin) params.set("priceMin", localPriceMin)
    if (localPriceMax) params.set("priceMax", localPriceMax)
    if (localTrust && localTrust !== "0") params.set("trustScore", localTrust)
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    params.set("category", category)
    if (localLocation) params.set("location", localLocation)
    if (localPriceMin) params.set("priceMin", localPriceMin)
    if (localPriceMax) params.set("priceMax", localPriceMax)
    if (localTrust && localTrust !== "0") params.set("trustScore", localTrust)
    params.delete("page")
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const clearFilters = () => {
    setLocalLocation("")
    setLocalPriceMin("")
    setLocalPriceMax("")
    setLocalTrust("0")
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    params.set("category", "all")
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const hasActiveFilters =
    category !== "all" ||
    location ||
    priceMin ||
    priceMax ||
    (trustScore && trustScore !== "0")

  return (
    <div className={`search-filters${isPending ? " search-filters--loading" : ""}`}>
      <div className="search-filters__header">
        <span className="search-filters__title">Filters</span>
        {hasActiveFilters && (
          <button className="search-filters__clear-all" onClick={clearFilters}>
            Clear all
          </button>
        )}
        <button
          className="search-filters__mobile-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? "Hide filters" : "Show filters"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points={filtersOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
          </svg>
        </button>
      </div>

      <div className={`search-filters__body${filtersOpen ? " search-filters__body--open" : ""}`}>
        {/* Category */}
        <div className="search-filters__section">
          <h3 className="search-filters__section-title">Category</h3>
          <ul className="search-filters__category-list" role="list">
            {CATEGORIES.map((cat) => (
              <li key={cat.value}>
                <button
                  className={`search-filters__category-btn${category === cat.value ? " search-filters__category-btn--active" : ""}`}
                  onClick={() =>
                    startTransition(() =>
                      router.push(buildUrl({ category: cat.value }))
                    )
                  }
                  aria-pressed={category === cat.value}
                >
                  <span className="search-filters__cat-icon">{cat.icon}</span>
                  {cat.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Location */}
        <div className="search-filters__section">
          <h3 className="search-filters__section-title">Location</h3>
          <div className="search-filters__location-wrap">
            <svg className="search-filters__location-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input
              type="text"
              className="search-filters__input"
              placeholder="City, region or postcode"
              value={localLocation}
              onChange={(e) => setLocalLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
        </div>

        {/* Price range */}
        {(category === "all" || category === "service" || category === "product" || category === "event") && (
          <div className="search-filters__section">
            <h3 className="search-filters__section-title">Price range</h3>
            <div className="search-filters__price-row">
              <input
                type="number"
                className="search-filters__input search-filters__input--price"
                placeholder="Min £"
                value={localPriceMin}
                min="0"
                onChange={(e) => setLocalPriceMin(e.target.value)}
              />
              <span className="search-filters__price-sep">–</span>
              <input
                type="number"
                className="search-filters__input search-filters__input--price"
                placeholder="Max £"
                value={localPriceMax}
                min="0"
                onChange={(e) => setLocalPriceMax(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Trust score */}
        <div className="search-filters__section">
          <h3 className="search-filters__section-title">
            Minimum Trust score
            <span className="search-filters__trust-value">{localTrust || "0"}</span>
          </h3>
          <input
            type="range"
            className="search-filters__range"
            min="0"
            max="100"
            step="5"
            value={localTrust || "0"}
            onChange={(e) => setLocalTrust(e.target.value)}
            aria-label="Minimum trust score"
          />
          <div className="search-filters__range-labels">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="search-filters__trust-tiers">
            {[
              { label: "Any", min: 0, color: "#94a3b8" },
              { label: "Fair", min: 40, color: "#f59e0b" },
              { label: "Good", min: 60, color: "#3b82f6" },
              { label: "High", min: 80, color: "#22c55e" },
            ].map((t) => (
              <button
                key={t.label}
                className={`search-filters__trust-tier${Number(localTrust) === t.min ? " search-filters__trust-tier--active" : ""}`}
                style={{ "--tier-color": t.color } as React.CSSProperties}
                onClick={() => setLocalTrust(String(t.min))}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button className="search-filters__apply" onClick={applyFilters} disabled={isPending}>
          {isPending ? "Applying…" : "Apply filters"}
        </button>
      </div>
    </div>
  )
}

