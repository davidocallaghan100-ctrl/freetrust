import { Suspense } from 'react'
import SearchResults from '@/components/search/SearchResults'
import SearchFilters from '@/components/search/SearchFilters'
import SearchBar from '@/components/search/SearchBar'

export const metadata = {
  title: 'Search | FreeTrust',
  description: 'Search across services, products, events, organisations, articles and members on FreeTrust.',
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const query = typeof searchParams.q === 'string' ? searchParams.q : ''
  const category = typeof searchParams.category === 'string' ? searchParams.category : 'all'
  const location = typeof searchParams.location === 'string' ? searchParams.location : ''
  const priceMin = typeof searchParams.priceMin === 'string' ? searchParams.priceMin : ''
  const priceMax = typeof searchParams.priceMax === 'string' ? searchParams.priceMax : ''
  const trustScore = typeof searchParams.trustScore === 'string' ? searchParams.trustScore : '0'
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1

  return (
    <>
      <style>{`
        .sp-page { min-height: 100vh; background: #0f172a; color: #f1f5f9; }
        .sp-hero { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid rgba(56,189,248,0.15); padding: 2.5rem 1.25rem 2rem; }
        .sp-hero-inner { max-width: 720px; margin: 0 auto; text-align: center; }
        .sp-title { font-size: clamp(1.5rem, 4vw, 2.25rem); font-weight: 900; color: #f1f5f9; margin: 0 0 0.5rem; letter-spacing: -0.5px; }
        .sp-title-q { color: #38bdf8; }
        .sp-subtitle { font-size: 0.95rem; color: #64748b; margin: 0 0 1.5rem; }
        .sp-bar-wrap { max-width: 640px; margin: 0 auto; }

        /* Search bar dark overrides */
        .search-bar { position: relative; width: 100%; }
        .search-bar__form { display: flex; gap: 0.5rem; }
        .search-bar__input-wrap { position: relative; flex: 1; display: flex; align-items: center; }
        .search-bar__icon { position: absolute; left: 1rem; color: #64748b; display: flex; pointer-events: none; }
        .search-bar__input { width: 100%; background: #1e293b; border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; padding: 0.85rem 2.8rem 0.85rem 2.8rem; font-size: 1rem; color: #f1f5f9; outline: none; transition: border-color 0.2s; }
        .search-bar__input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.12); }
        .search-bar__input::placeholder { color: #475569; }
        .search-bar__clear { position: absolute; right: 0.75rem; background: none; border: none; cursor: pointer; color: #64748b; display: flex; padding: 4px; border-radius: 4px; }
        .search-bar__clear:hover { color: #f1f5f9; }
        .search-bar__submit { background: #38bdf8; color: #0f172a; border: none; border-radius: 10px; padding: 0.85rem 1.5rem; font-size: 0.95rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
        .search-bar__submit:hover { opacity: 0.88; }
        .search-bar__dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: #1e293b; border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; z-index: 200; box-shadow: 0 12px 40px rgba(0,0,0,0.4); overflow: hidden; }
        .search-bar__group-label { padding: 0.5rem 1rem 0.25rem; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.4rem; }
        .search-bar__suggestion { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.65rem 1rem; background: none; border: none; cursor: pointer; text-align: left; color: #f1f5f9; font-size: 0.9rem; transition: background 0.1s; }
        .search-bar__suggestion:hover, .search-bar__suggestion--active { background: rgba(56,189,248,0.08); }
        .search-bar__suggestion-body { flex: 1; min-width: 0; }
        .search-bar__suggestion-title { display: block; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .search-bar__suggestion-sub { display: block; font-size: 0.78rem; color: #64748b; }
        .search-bar__highlight { background: rgba(56,189,248,0.25); color: #38bdf8; border-radius: 2px; }
        .search-bar__dropdown-footer { padding: 0.6rem 1rem; border-top: 1px solid rgba(56,189,248,0.1); }
        .search-bar__see-all { font-size: 0.85rem; color: #38bdf8; display: flex; align-items: center; gap: 0.4rem; text-decoration: none; }
        .search-bar__see-all:hover { text-decoration: underline; }
        .search-bar__spinner { position: absolute; right: 2.8rem; }

        /* Body layout */
        .sp-body { max-width: 1300px; margin: 0 auto; padding: 2rem 1.25rem; display: grid; grid-template-columns: 240px 1fr; gap: 1.75rem; align-items: start; }
        @media (max-width: 900px) { .sp-body { grid-template-columns: 1fr; } }

        /* Filters dark */
        .search-filters { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 1.25rem; }
        .search-filters__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .search-filters__title { font-size: 0.95rem; font-weight: 700; color: #f1f5f9; }
        .search-filters__clear-all { font-size: 0.8rem; color: #38bdf8; background: none; border: none; cursor: pointer; }
        .search-filters__clear-all:hover { text-decoration: underline; }
        .search-filters__mobile-toggle { display: none; font-size: 0.82rem; color: #64748b; background: none; border: none; cursor: pointer; align-items: center; gap: 0.3rem; }
        @media (max-width: 900px) { .search-filters__mobile-toggle { display: flex; } .search-filters__body { display: none; } .search-filters__body--open { display: block; } }
        .search-filters__section { margin-bottom: 1.25rem; }
        .search-filters__section-title { font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between; }
        .search-filters__trust-value { font-size: 0.9rem; font-weight: 700; color: #38bdf8; text-transform: none; }
        .search-filters__category-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.2rem; }
        .search-filters__category-btn { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.65rem; border-radius: 7px; background: none; border: 1px solid transparent; cursor: pointer; color: #94a3b8; font-size: 0.875rem; text-align: left; transition: all 0.15s; }
        .search-filters__category-btn:hover { color: #f1f5f9; background: rgba(56,189,248,0.06); }
        .search-filters__category-btn--active { color: #38bdf8; background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.25); font-weight: 600; }
        .search-filters__cat-icon { font-size: 0.9rem; }
        .search-filters__location-wrap { position: relative; display: flex; align-items: center; }
        .search-filters__location-icon { position: absolute; left: 0.65rem; color: #64748b; }
        .search-filters__input { width: 100%; background: #0f172a; border: 1px solid rgba(56,189,248,0.15); border-radius: 7px; padding: 0.55rem 0.65rem 0.55rem 2rem; font-size: 0.875rem; color: #f1f5f9; outline: none; }
        .search-filters__input:focus { border-color: #38bdf8; }
        .search-filters__input::placeholder { color: #475569; }
        .search-filters__price-row { display: flex; align-items: center; gap: 0.5rem; }
        .search-filters__input--price { padding-left: 0.65rem; }
        .search-filters__price-sep { color: #64748b; font-size: 0.9rem; }
        .search-filters__range { width: 100%; accent-color: #38bdf8; margin: 0.4rem 0; }
        .search-filters__range-labels { display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748b; }
        .search-filters__trust-tiers { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem; }
        .search-filters__trust-tier { padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; background: rgba(148,163,184,0.08); border: 1px solid rgba(148,163,184,0.15); color: #94a3b8; cursor: pointer; transition: all 0.15s; }
        .search-filters__trust-tier--active { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.35); color: #38bdf8; }
        .search-filters__apply { width: 100%; padding: 0.7rem; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; margin-top: 0.5rem; }
        .search-filters__apply:hover { opacity: 0.88; }
        .search-filters__apply:disabled { opacity: 0.5; cursor: not-allowed; }
        .search-filters--loading { opacity: 0.7; pointer-events: none; }

        /* Results */
        .search-results__meta { font-size: 0.875rem; color: #64748b; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .search-results__count { font-weight: 600; color: #f1f5f9; }
        .search-results__active-cat { background: rgba(var(--cat-color, 56,189,248),0.12); color: var(--cat-color, #38bdf8); padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700; border: 1px solid rgba(56,189,248,0.2); }
        .search-results__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }

        /* Result cards */
        .result-card { display: flex; gap: 1rem; padding: 1rem; background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; text-decoration: none; color: #f1f5f9; transition: all 0.15s; }
        .result-card:hover { border-color: rgba(56,189,248,0.25); background: rgba(30,41,59,0.9); transform: translateY(-1px); }
        .result-card__thumb-wrap { position: relative; flex-shrink: 0; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; }
        .result-card__thumb { width: 100%; height: 100%; object-fit: cover; }
        .result-card__thumb-placeholder { width: 100%; height: 100%; background: rgba(56,189,248,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: #38bdf8; }
        .result-card__cat-badge { position: absolute; bottom: 4px; left: 4px; background: rgba(15,23,42,0.85); color: var(--cat-color, #38bdf8); font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; }
        .result-card__body { flex: 1; min-width: 0; }
        .result-card__title { font-size: 1rem; font-weight: 700; color: #f1f5f9; margin: 0 0 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .result-card__subtitle { font-size: 0.8rem; color: #38bdf8; margin: 0 0 0.3rem; font-weight: 600; }
        .result-card__desc { font-size: 0.85rem; color: #94a3b8; margin: 0 0 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .result-card__meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.78rem; color: #64748b; }
        .result-card__meta-item { display: flex; align-items: center; gap: 0.3rem; }
        .result-card__meta-item--price { color: #34d399; font-weight: 700; }
        .result-card__trust { display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
        .trust-meter { display: flex; flex-direction: column; align-items: center; position: relative; }
        .trust-meter__score { font-size: 0.7rem; font-weight: 800; margin-top: -28px; }
        .trust-meter__label { font-size: 0.6rem; color: #64748b; margin-top: 2px; }
        .trust-badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700; color: var(--trust-color, #38bdf8); }
        .search-bar__highlight { background: rgba(56,189,248,0.2); color: #38bdf8; border-radius: 2px; }

        /* Empty/no results */
        .search-empty { padding: 4rem 2rem; text-align: center; }
        .search-empty__icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
        .search-empty__title { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; margin: 0 0 0.5rem; }
        .search-empty__text { color: #64748b; font-size: 0.95rem; }

        /* Skeleton */
        .search-skeleton { display: flex; flex-direction: column; gap: 0.75rem; }
        .search-skeleton__meta { height: 20px; background: rgba(56,189,248,0.06); border-radius: 6px; width: 200px; margin-bottom: 0.5rem; }
        .search-skeleton__card { display: flex; gap: 1rem; padding: 1rem; background: #1e293b; border: 1px solid rgba(56,189,248,0.06); border-radius: 12px; }
        .search-skeleton__thumb { width: 80px; height: 80px; border-radius: 8px; background: rgba(56,189,248,0.08); flex-shrink: 0; animation: pulse 1.5s ease-in-out infinite; }
        .search-skeleton__content { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
        .search-skeleton__line { background: rgba(56,189,248,0.08); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }
        .search-skeleton__line--title { height: 18px; width: 60%; }
        .search-skeleton__line--sub { height: 14px; width: 40%; }
        .search-skeleton__line--meta { height: 12px; width: 30%; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        /* Pagination */
        .search-pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 2rem 0 1rem; flex-wrap: wrap; }
        .search-pagination__btn { padding: 0.5rem 0.9rem; background: #1e293b; border: 1px solid rgba(56,189,248,0.15); border-radius: 7px; color: #94a3b8; font-size: 0.875rem; text-decoration: none; transition: all 0.15s; }
        .search-pagination__btn:hover { border-color: rgba(56,189,248,0.4); color: #38bdf8; }
        .search-pagination__btn--active { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.4); color: #38bdf8; font-weight: 700; }
        .search-pagination__btn--disabled { opacity: 0.35; pointer-events: none; }
      `}</style>
      <div className="sp-page">
        <div className="sp-hero">
          <div className="sp-hero-inner">
            <h1 className="sp-title">
              {query ? (
                <>Results for <span className="sp-title-q">&ldquo;{query}&rdquo;</span></>
              ) : (
                'Search FreeTrust'
              )}
            </h1>
            <p className="sp-subtitle">
              Find trusted services, products, events, organisations, articles and members
            </p>
            <div className="sp-bar-wrap">
              <SearchBar initialQuery={query} large />
            </div>
          </div>
        </div>

        <div className="sp-body">
          <aside>
            <SearchFilters
              category={category}
              location={location}
              priceMin={priceMin}
              priceMax={priceMax}
              trustScore={trustScore}
              query={query}
            />
          </aside>

          <main>
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
    </>
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
