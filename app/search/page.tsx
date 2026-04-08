
import { Suspense } from "react"
import SearchResults from "@/components/search/SearchResults"
import SearchFilters from "@/components/search/SearchFilters"
import SearchBar from "@/components/search/SearchBar"

export const metadata = {
  title: "Search | FreeTrust",
  description: "Search across services, products, events, organisations, articles and members on FreeTrust.",
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const query = typeof searchParams.q === "string" ? searchParams.q : ""
  const category = typeof searchParams.category === "string" ? searchParams.category : "all"
  const location = typeof searchParams.location === "string" ? searchParams.location : ""
  const priceMin = typeof searchParams.priceMin === "string" ? searchParams.priceMin : ""
  const priceMax = typeof searchParams.priceMax === "string" ? searchParams.priceMax : ""
  const trustScore = typeof searchParams.trustScore === "string" ? searchParams.trustScore : "0"
  const page = typeof searchParams.page === "string" ? parseInt(searchParams.page, 10) : 1

  return (
    <div className="search-page">
      <div className="search-page__hero">
        <div className="search-page__hero-inner">
          <h1 className="search-page__title">
            {query ? (
              <>
                Results for <span className="search-page__title-query">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              "Search FreeTrust"
            )}
          </h1>
          <p className="search-page__subtitle">
            Find trusted services, products, events, organisations, articles and members
          </p>
          <div className="search-page__bar-wrapper">
            <SearchBar initialQuery={query} large />
          </div>
        </div>
      </div>

      <div className="search-page__body">
        <aside className="search-page__sidebar">
          <SearchFilters
            category={category}
            location={location}
            priceMin={priceMin}
            priceMax={priceMax}
            trustScore={trustScore}
            query={query}
          />
        </aside>

        <main className="search-page__main">
          <Suspense fallback={<SearchResultsSkeleton />}>
            <SearchResults
              query={query}
              category={category}
              location={location}
              priceMin={priceMin}
              priceMax={priceMax}
              trustScore={Number(trustScore)}
              page={page}
            />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

function SearchResultsSkeleton() {
  return (
    <div className="search-skeleton">
      <div className="search-skeleton__meta" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="search-skeleton__card">
          <div className="search-skeleton__thumb" />
          <div className="search-skeleton__content">
            <div className="search-skeleton__line search-skeleton__line--title" />
            <div className="search-skeleton__line search-skeleton__line--sub" />
            <div className="search-skeleton__line search-skeleton__line--meta" />
          </div>
        </div>
      ))}
    </div>
  )
}

