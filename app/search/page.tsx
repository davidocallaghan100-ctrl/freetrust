'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  UserCircleIcon,
  BriefcaseIcon,
  CubeIcon,
  BuildingOffice2Icon,
  UsersIcon,
  DocumentTextIcon,
  StarIcon,
  MapPinIcon,
  TagIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentType = 'all' | 'services' | 'products' | 'users' | 'organisations' | 'communities' | 'posts';

interface SearchResult {
  id: string;
  type: Exclude<ContentType, 'all'>;
  title: string;
  description: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  location?: string;
  tags?: string[];
  author?: string;
  authorAvatar?: string;
  verified?: boolean;
  createdAt: Date;
  slug: string;
}

interface FilterState {
  minPrice: string;
  maxPrice: string;
  minRating: string;
  location: string;
  tags: string;
  sortBy: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RESULTS: SearchResult[] = [
  {
    id: '1',
    type: 'services',
    title: 'Professional Logo Design',
    description: 'High-quality logo design tailored to your brand identity. Includes 3 concepts, unlimited revisions, and full source files.',
    price: 150,
    currency: 'USDT',
    rating: 4.8,
    reviewCount: 124,
    location: 'Remote',
    tags: ['design', 'branding', 'logo'],
    author: 'Alex Rivera',
    authorAvatar: '',
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    slug: '/services/professional-logo-design',
  },
  {
    id: '2',
    type: 'products',
    title: 'UI Component Library — Pro',
    description: 'Over 500 ready-to-use React components with Tailwind CSS. Dark mode, accessibility, TypeScript support included.',
    price: 89,
    currency: 'USDT',
    rating: 4.9,
    reviewCount: 312,
    tags: ['react', 'ui', 'tailwind', 'typescript'],
    author: 'DesignLab',
    authorAvatar: '',
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    slug: '/products/ui-component-library-pro',
  },
  {
    id: '3',
    type: 'users',
    title: 'Maria Chen',
    description: 'Full-stack developer specialising in Next.js, TypeScript, and Web3 integrations. 7+ years experience.',
    location: 'Singapore',
    tags: ['nextjs', 'web3', 'typescript'],
    rating: 4.7,
    reviewCount: 89,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    slug: '/users/maria-chen',
  },
  {
    id: '4',
    type: 'organisations',
    title: 'OpenBuild Collective',
    description: 'A decentralised organisation of builders, designers, and marketers working on open-source Web3 tools.',
    location: 'Global',
    tags: ['web3', 'open-source', 'dao'],
    rating: 4.6,
    reviewCount: 55,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    slug: '/organisations/openbuild-collective',
  },
  {
    id: '5',
    type: 'services',
    title: 'Smart Contract Audit',
    description: 'Comprehensive security audit for Solidity smart contracts. Includes detailed report, vulnerability analysis, and remediation advice.',
    price: 800,
    currency: 'USDT',
    rating: 5.0,
    reviewCount: 42,
    location: 'Remote',
    tags: ['solidity', 'security', 'blockchain', 'audit'],
    author: 'CryptoGuard',
    authorAvatar: '',
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    slug: '/services/smart-contract-audit',
  },
  {
    id: '6',
    type: 'communities',
    title: 'Web3 Builders Hub',
    description: 'A thriving community for Web3 developers, designers, and entrepreneurs to collaborate and grow together.',
    tags: ['web3', 'builders', 'community'],
    rating: 4.5,
    reviewCount: 210,
    location: 'Online',
    verified: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
    slug: '/communities/web3-builders-hub',
  },
  {
    id: '7',
    type: 'posts',
    title: 'How to structure a FreeTrust escrow deal',
    description: 'A step-by-step guide on setting up milestone-based escrow payments on FreeTrust, protecting both buyers and sellers.',
    tags: ['escrow', 'guide', 'tutorial'],
    author: 'FreeTrust Team',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    slug: '/posts/how-to-structure-escrow-deal',
  },
  {
    id: '8',
    type: 'products',
    title: 'Crypto Payment Gateway SDK',
    description: 'Accept USDT, ETH, and BTC on your platform with a single SDK. React & Node.js compatible, full docs included.',
    price: 299,
    currency: 'USDT',
    rating: 4.8,
    reviewCount: 67,
    tags: ['crypto', 'payments', 'sdk', 'web3'],
    author: 'PayKit',
    verified: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
    slug: '/products/crypto-payment-gateway-sdk',
  },
  {
    id: '9',
    type: 'users',
    title: 'James Okafor',
    description: 'Creative director and brand strategist with 10+ years helping Web2 and Web3 companies build memorable identities.',
    location: 'Lagos, Nigeria',
    tags: ['branding', 'design', 'strategy'],
    rating: 4.9,
    reviewCount: 143,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
    slug: '/users/james-okafor',
  },
  {
    id: '10',
    type: 'services',
    title: 'SEO & Content Strategy',
    description: 'Drive organic growth with tailored SEO strategy, keyword research, competitor analysis, and monthly performance reports.',
    price: 350,
    currency: 'USDT',
    rating: 4.6,
    reviewCount: 98,
    location: 'Remote',
    tags: ['seo', 'content', 'marketing'],
    author: 'GrowthStudio',
    verified: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
    slug: '/services/seo-content-strategy',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<Exclude<ContentType, 'all'>, { label: string; icon: React.ReactNode; color: string }> = {
  services: { label: 'Service', icon: <BriefcaseIcon className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  products: { label: 'Product', icon: <CubeIcon className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  users: { label: 'User', icon: <UserCircleIcon className="w-3.5 h-3.5" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  organisations: { label: 'Organisation', icon: <BuildingOffice2Icon className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  communities: { label: 'Community', icon: <UsersIcon className="w-3.5 h-3.5" />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  posts: { label: 'Post', icon: <DocumentTextIcon className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

const TAB_ITEMS: { key: ContentType; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <MagnifyingGlassIcon className="w-4 h-4" /> },
  { key: 'services', label: 'Services', icon: <BriefcaseIcon className="w-4 h-4" /> },
  { key: 'products', label: 'Products', icon: <CubeIcon className="w-4 h-4" /> },
  { key: 'users', label: 'People', icon: <UserCircleIcon className="w-4 h-4" /> },
  { key: 'organisations', label: 'Orgs', icon: <BuildingOffice2Icon className="w-4 h-4" /> },
  { key: 'communities', label: 'Communities', icon: <UsersIcon className="w-4 h-4" /> },
  { key: 'posts', label: 'Posts', icon: <DocumentTextIcon className="w-4 h-4" /> },
];

function filterAndSort(results: SearchResult[], query: string, type: ContentType, filters: FilterState): SearchResult[] {
  let filtered = results.filter((r) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q)) ||
      r.author?.toLowerCase().includes(q);
    const matchesType = type === 'all' || r.type === type;
    const matchesMin = !filters.minPrice || (r.price !== undefined && r.price >= parseFloat(filters.minPrice));
    const matchesMax = !filters.maxPrice || (r.price !== undefined && r.price <= parseFloat(filters.maxPrice));
    const matchesRating = !filters.minRating || (r.rating !== undefined && r.rating >= parseFloat(filters.minRating));
    const matchesLocation = !filters.location || r.location?.toLowerCase().includes(filters.location.toLowerCase());
    const matchesTags =
      !filters.tags ||
      filters.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .every((ft) => r.tags?.some((rt) => rt.toLowerCase().includes(ft)));
    return matchesQuery && matchesType && matchesMin && matchesMax && matchesRating && matchesLocation && matchesTags;
  });

  switch (filters.sortBy) {
    case 'newest':
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case 'price_asc':
      filtered = filtered.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      break;
    case 'price_desc':
      filtered = filtered.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      break;
    case 'rating':
      filtered = filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    default:
      break;
  }
  return filtered;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <StarSolid
          key={s}
          className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-600'}`}
        />
      ))}
    </span>
  );
}

function TypeBadge({ type }: { type: Exclude<ContentType, 'all'> }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const hasPrice = result.price !== undefined;
  const hasRating = result.rating !== undefined;

  return (
    <Link href={result.slug} className="block group">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200">
        <div className="flex items-start gap-4">
          {/* Avatar/Icon placeholder */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {result.title.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <TypeBadge type={result.type} />
              {result.verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  ✓ Verified
                </span>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                {formatDistanceToNow(result.createdAt, { addSuffix: true })}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
              {result.title}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{result.description}</p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {hasRating && result.rating !== undefined && (
                <span className="flex items-center gap-1.5">
                  <RatingStars rating={result.rating} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{result.rating.toFixed(1)}</span>
                  {result.reviewCount !== undefined && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">({result.reviewCount})</span>
                  )}
                </span>
              )}
              {result.location && (
                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <MapPinIcon className="w-3.5 h-3.5" />
                  {result.location}
                </span>
              )}
              {result.author && (
                <span className="text-xs text-gray-400 dark:text-gray-500">by {result.author}</span>
              )}
              {hasPrice && (
                <span className="ml-auto text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {result.currency} {result.price?.toLocaleString()}
                </span>
              )}
            </div>

            {/* Tags */}
            {result.tags && result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {result.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <TagIcon className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function FilterPanel({
  filters,
  onChange,
  onReset,
  activeType,
}: {
  filters: FilterState;
  onChange: (k: keyof FilterState, v: string) => void;
  onReset: () => void;
  activeType: ContentType;
}) {
  const showPrice = activeType === 'all' || activeType === 'services' || activeType === 'products';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Filters
        </h3>
        <button
          onClick={onReset}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Reset all
        </button>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Sort by</label>
        <select
          value={filters.sortBy}
          onChange={(e) => onChange('sortBy', e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="rating">Highest rated</option>
          {showPrice && <option value="price_asc">Price: low to high</option>}
          {showPrice && <option value="price_desc">Price: high to low</option>}
        </select>
      </div>

      {/* Price range */}
      {showPrice && (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Price (USDT)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice}
              onChange={(e) => onChange('minPrice', e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 dark:text-gray-500 text-xs">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={(e) => onChange('maxPrice', e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Min rating */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Min. rating</label>
        <select
          value={filters.minRating}
          onChange={(e) => onChange('minRating', e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Any</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
          <option value="4.5">4.5+</option>
          <option value="5">5 only</option>
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Location</label>
        <input
          type="text"
          placeholder="e.g. Remote, Lagos…"
          value={filters.location}
          onChange={(e) => onChange('location', e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Tags (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g. react, web3, design"
          value={filters.tags}
          onChange={(e) => onChange('tags', e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <MagnifyingGlassIcon className="w-14 h-14 text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {query ? `No results for "${query}"` : 'Start searching'}
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
        {query
          ? 'Try different keywords, adjust filters, or explore a different category.'
          : 'Enter a search term above to find services, products, people, and more.'}
      </p>
    </div>
  );
}

// ─── Main inner component (uses useSearchParams) ───────────────────────────

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get('q') ?? '';
  const initialType = (searchParams.get('type') as ContentType) ?? 'all';

  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeType, setActiveType] = useState<ContentType>(initialType);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    minPrice: '',
    maxPrice: '',
    minRating: '',
    location: '',
    tags: '',
    sortBy: 'relevance',
  });

  const results = filterAndSort(MOCK_RESULTS, query, activeType, filters);

  // Sync URL params
  const updateUrl = useCallback(
    (q: string, type: ContentType) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (type !== 'all') params.set('type', type);
      router.replace(`/search?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setQuery(inputValue);
    updateUrl(inputValue, activeType);
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleTypeChange = (type: ContentType) => {
    setActiveType(type);
    updateUrl(query, type);
  };

  const handleFilterChange = (k: keyof FilterState, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }));
  };

  const resetFilters = () => {
    setFilters({ minPrice: '', maxPrice: '', minRating: '', location: '', tags: '', sortBy: 'relevance' });
  };

  const activeFilterCount = [filters.minPrice, filters.maxPrice, filters.minRating, filters.location, filters.tags].filter(Boolean).length;

  // Count results per type
  const countByType = (type: ContentType) => {
    if (type === 'all') return filterAndSort(MOCK_RESULTS, query, 'all', filters).length;
    return filterAndSort(MOCK_RESULTS, query, type, filters).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search services, products, people, organisations…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoFocus
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => { setInputValue(''); setQuery(''); updateUrl('', activeType); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
              disabled={isLoading}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`relative px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 ${
                showFilters
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </form>

          {/* Tabs */}
          <div className="flex gap-0.5 mt-3 overflow-x-auto scrollbar-hide">
            {TAB_ITEMS.map((tab) => {
              const count = countByType(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTypeChange(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeType === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeType === tab.key ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6 items-start">
          {/* Filter sidebar */}
          {showFilters && (
            <div className="hidden lg:block w-64 flex-shrink-0 sticky top-[130px]">
              <FilterPanel
                filters={filters}
                onChange={handleFilterChange}
                onReset={resetFilters}
                activeType={activeType}
              />
            </div>
          )}

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            {showFilters && (
              <div className="lg:hidden mb-4">
                <FilterPanel
                  filters={filters}
                  onChange={handleFilterChange}
                  onReset={resetFilters}
                  activeType={activeType}
                />
              </div>
            )}

            {/* Results count */}
            {query && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {isLoading ? 'Searching…' : (
                  <>
                    <span className="font-semibold text-gray-900 dark:text-white">{results.length}</span>
                    {' '}result{results.length !== 1 ? 's' : ''} for{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">"{query}"</span>
                  </>
                )}
              </p>
            )}

            {/* Cards */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((r) => (
                  <ResultCard key={r.id} result={r} />
                ))}
              </div>
            ) : (
              <EmptyState query={query} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export (wraps in Suspense for useSearchParams) ──────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <MagnifyingGlassIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 animate-pulse" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading search…</p>
        </div>
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  );
}

