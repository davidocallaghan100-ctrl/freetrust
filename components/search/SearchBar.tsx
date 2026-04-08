
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { searchTypeahead } from "@/lib/search/searchTypeahead"
import type { TypeaheadResult } from "@/lib/search/types"

interface SearchBarProps {
  initialQuery?: string
  large?: boolean
  placeholder?: string
}

const CATEGORY_ICONS: Record<string, string> = {
  service: "🔧",
  product: "📦",
  event: "📅",
  organisation: "🏢",
  article: "📰",
  member: "👤",
}

const CATEGORY_LABELS: Record<string, string> = {
  service: "Service",
  product: "Product",
  event: "Event",
  organisation: "Organisation",
  article: "Article",
  member: "Member",
}

export default function SearchBar({
  initialQuery = "",
  large = false,
  placeholder = "Search services, products, events…",
}: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<TypeaheadResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    try {
      const results = await searchTypeahead(value)
      setSuggestions(results)
      setIsOpen(results.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250)
  }

  const buildSearchUrl = (q: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("q", q)
    params.delete("page")
    return `/search?${params.toString()}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setIsOpen(false)
      router.push(buildSearchUrl(query.trim()))
    }
  }

  const handleSuggestionClick = (suggestion: TypeaheadResult) => {
    setIsOpen(false)
    if (suggestion.href) {
      router.push(suggestion.href)
    } else {
      setQuery(suggestion.title)
      router.push(buildSearchUrl(suggestion.title))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const grouped = suggestions.reduce<Record<string, TypeaheadResult[]>>((acc, s) => {
    const key = s.category
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className={`search-bar${large ? " search-bar--large" : ""}`} role="search">
      <form onSubmit={handleSubmit} className="search-bar__form" autoComplete="off">
        <div className="search-bar__input-wrap">
          <span className="search-bar__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            className="search-bar__input"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            aria-label="Search FreeTrust"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
            aria-expanded={isOpen}
          />
          {isLoading && (
            <span className="search-bar__spinner" aria-hidden="true">
              <span className="search-bar__spinner-dot" />
            </span>
          )}
          {query && (
            <button
              type="button"
              className="search-bar__clear"
              onClick={() => {
                setQuery("")
                setSuggestions([])
                setIsOpen(false)
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button type="submit" className="search-bar__submit">
          Search
        </button>
      </form>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          id="search-suggestions"
          className="search-bar__dropdown"
          role="listbox"
          aria-label="Search suggestions"
        >
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="search-bar__group">
              <div className="search-bar__group-label" role="presentation">
                <span className="search-bar__group-icon">{CATEGORY_ICONS[cat] ?? "🔍"}</span>
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              {items.map((s, idx) => {
                const globalIdx = suggestions.indexOf(s)
                return (
                  <button
                    key={s.id}
                    id={`suggestion-${globalIdx}`}
                    role="option"
                    aria-selected={activeIndex === globalIdx}
                    className={`search-bar__suggestion${activeIndex === globalIdx ? " search-bar__suggestion--active" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSuggestionClick(s)
                    }}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                  >
                    {s.thumbnail && (
                      <img src={s.thumbnail} alt="" className="search-bar__suggestion-thumb" />
                    )}
                    <span className="search-bar__suggestion-body">
                      <span
                        className="search-bar__suggestion-title"
                        dangerouslySetInnerHTML={{ __html: highlightMatch(s.title, query) }}
                      />
                      {s.subtitle && (
                        <span className="search-bar__suggestion-sub">{s.subtitle}</span>
                      )}
                    </span>
                    {s.trustScore !== undefined && (
                      <span className="search-bar__suggestion-trust">
                        <TrustBadge score={s.trustScore} compact />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          <div className="search-bar__dropdown-footer">
            <Link href={buildSearchUrl(query)} className="search-bar__see-all" onClick={() => setIsOpen(false)}>
              See all results for &ldquo;{query}&rdquo;
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  return text.replace(regex, '<mark class="search-bar__highlight">$1</mark>')
}

function TrustBadge({ score, compact }: { score: number; compact?: boolean }) {
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"
  return (
    <span className="trust-badge" style={{ "--trust-color": color } as React.CSSProperties}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill={color} aria-hidden="true">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
      {score}
    </span>
  )
}

