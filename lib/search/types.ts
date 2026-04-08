export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  description?: string
  href: string
  thumbnail?: string
  category: string
  location?: string
  price?: number
  date?: string
  trustScore?: number
}

export interface TypeaheadResult {
  id: string
  title: string
  subtitle?: string
  href?: string
  thumbnail?: string
  category: string
  trustScore?: number
}

export interface SearchParams {
  query: string
  category?: string
  location?: string
  priceMin?: number
  priceMax?: number
  trustScore?: number
  page?: number
  pageSize?: number
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  totalPages: number
}
