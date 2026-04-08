"use client"

import Link from "next/link"

interface SearchPaginationProps {
  currentPage: number
  totalPages: number
  query: string
  category: string
  location: string
  priceMin: string
  priceMax: string
  trustScore: string
}

function buildPageUrl(
  page: number,
  { query, category, location, priceMin, priceMax, trustScore }: Omit<SearchPaginationProps, "currentPage" | "totalPages">
): string {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (category && category !== "all") params.set("category", category)
  if (location) params.set("location", location)
  if (priceMin) params.set("priceMin", priceMin)
  if (priceMax) params.set("priceMax", priceMax)
  if (trustScore && trustScore !== "0") params.set("trustScore", trustScore)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return `/search${qs ? `?${qs}` : ""}`
}

export default function SearchPagination({
  currentPage,
  totalPages,
  query,
  category,
  location,
  priceMin,
  priceMax,
  trustScore,
}: SearchPaginationProps) {
  const urlProps = { query, category, location, priceMin, priceMax, trustScore }

  const pages: (number | "…")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push("…")
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push("…")
    pages.push(totalPages)
  }

  return (
    <nav className="search-pagination" aria-label="Search results pagination">
      {currentPage > 1 && (
        <Link
          href={buildPageUrl(currentPage - 1, urlProps)}
          className="search-pagination__btn search-pagination__btn--prev"
          aria-label="Previous page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Prev
        </Link>
      )}

      <ol className="search-pagination__pages" role="list">
        {pages.map((p, i) =>
          p === "…" ? (
            <li key={`ellipsis-${i}`} className="search-pagination__ellipsis" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              {p === currentPage ? (
                <span className="search-pagination__page search-pagination__page--current" aria-current="page">
                  {p}
                </span>
              ) : (
                <Link href={buildPageUrl(p, urlProps)} className="search-pagination__page">
                  {p}
                </Link>
              )}
            </li>
          )
        )}
      </ol>

      {currentPage < totalPages && (
        <Link
          href={buildPageUrl(currentPage + 1, urlProps)}
          className="search-pagination__btn search-pagination__btn--next"
          aria-label="Next page"
        >
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </nav>
  )
}
