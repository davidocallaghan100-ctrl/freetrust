
import Link from "next/link"
import { fetchSearchResults } from "@/lib/search/fetchSearchResults"
import SearchPagination from "@/components/search/SearchPagination"
import type { SearchResult } from "@/lib/search/types"

interface SearchResultsProps {
  query: string
  category: string
  location: string
  priceMin: string
  priceMax: string
  trustScore: number
  page: number
}

const CATEGORY_COLORS: Record<string, string> = {
  service: "#6366f1",
  product: "#8b5cf6",
  event: "#ec4899",
  organisation: "#0ea5e9",
  article: "#14b8a6",
  member: "#f59e0b",
}

const CATEGORY_LABELS: Record<string, string> = {
  service: "Service",
  product: "Product",
  event: "Event",
  organisation: "Organisation",
  article: "Article",
  member: "Member",
}

export default async function SearchResults({
  query,
  category,
  location,
  priceMin,
  priceMax,
  trustScore,
  page,
}: SearchResultsProps) {
  const { results, total, totalPages } = await fetchSearchResults({
    query,
    category,
    location,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    trustScore,
    page,
    pageSize: 12,
  })

  if (!query && results.length === 0) {
    return <EmptyPrompt />
  }

  if (results.length === 0) {
    return <NoResults query={query} category={category} />
  }

  return (
    <div className="search-results">
      <div className="search-results__meta">
        <span className="search-results__count">
          {total.toLocaleString()} result{total !== 1 ? "s" : ""}
          {query ? ` for "${query}"` : ""}
        </span>
        {category !== "all" && (
          <span className="search-results__active-cat" style={{ "--cat-color": CATEGORY_COLORS[category] } as React.CSSProperties}>
            {CATEGORY_LABELS[category] ?? category}
          </span>
        )}
      </div>

      <ul className="search-results__list" role="list">
        {results.map((result) => (
          <li key={result.id}>
            <ResultCard result={result} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <SearchPagination
          currentPage={page}
          totalPages={totalPages}
          query={query}
          category={category}
          location={location}
          priceMin={priceMin}
          priceMax={priceMax}
          trustScore={String(trustScore)}
        />
      )}
    </div>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  const catColor = CATEGORY_COLORS[result.category] ?? "#64748b"
  const catLabel = CATEGORY_LABELS[result.category] ?? result.category

  return (
    <Link href={result.href} className="result-card">
      <div className="result-card__thumb-wrap">
        {result.thumbnail ? (
          <img src={result.thumbnail} alt="" className="result-card__thumb" loading="lazy" />
        ) : (
          <div className="result-card__thumb-placeholder" style={{ "--cat-color": catColor } as React.CSSProperties}>
            <span>{catLabel.charAt(0)}</span>
          </div>
        )}
        <span
          className="result-card__cat-badge"
          style={{ "--cat-color": catColor } as React.CSSProperties}
        >
          {catLabel}
        </span>
      </div>

      <div className="result-card__body">
        <h2 className="result-card__title">{result.title}</h2>
        {result.subtitle && (
          <p className="result-card__subtitle">{result.subtitle}</p>
        )}
        {result.description && (
          <p className="result-card__desc">{result.description}</p>
        )}

        <div className="result-card__meta">
          {result.location && (
            <span className="result-card__meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {result.location}
            </span>
          )}
          {result.price !== undefined && (
            <span className="result-card__meta-item result-card__meta-item--price">
              {result.price === 0 ? "Free" : `£${result.price.toLocaleString()}`}
            </span>
          )}
          {result.date && (
            <span className="result-card__meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {result.date}
            </span>
          )}
        </div>
      </div>

      {result.trustScore !== undefined && (
        <div className="result-card__trust">
          <TrustMeter score={result.trustScore} />
        </div>
      )}
    </Link>
  )
}

function TrustMeter({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444"
  const label = score >= 80 ? "High" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Low"
  return (
    <div className="trust-meter" title={`Trust score: ${score}/100`}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="4"