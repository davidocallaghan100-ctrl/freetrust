import type { SearchParams, SearchResponse, SearchResult } from "./types"

// Mock search results — replace with real DB/API calls once backend is wired up
const DEMO_RESULTS: SearchResult[] = [
  {
    id: "s1",
    title: "Web Development",
    subtitle: "Full-stack development service",
    description: "Professional web development for startups and SMEs. React, Next.js, Node.js.",
    href: "/services/web-development",
    category: "service",
    location: "Dublin, Ireland",
    price: 500,
    trustScore: 92,
  },
  {
    id: "s2",
    title: "Logo Design",
    subtitle: "Brand identity design",
    description: "Custom logo and brand identity packages tailored to your business.",
    href: "/services/logo-design",
    category: "service",
    location: "Remote",
    price: 150,
    trustScore: 88,
  },
  {
    id: "p1",
    title: "FreeTrust Pro Plan",
    subtitle: "Premium subscription",
    description: "Unlock advanced features including verified badges, analytics, and priority support.",
    href: "/products/pro-plan",
    category: "product",
    price: 29,
    trustScore: 95,
  },
  {
    id: "e1",
    title: "Freelancer Meetup Dublin",
    subtitle: "Networking event",
    description: "Monthly meetup for freelancers and independent professionals in Dublin.",
    href: "/events/freelancer-meetup-dublin",
    category: "event",
    location: "Dublin, Ireland",
    date: "Apr 18, 2026",
    trustScore: 78,
  },
  {
    id: "o1",
    title: "Tech Guild Ireland",
    subtitle: "Professional organisation",
    description: "Ireland's largest community for tech professionals, freelancers, and founders.",
    href: "/organisations/tech-guild-ireland",
    category: "organisation",
    location: "Ireland",
    trustScore: 85,
  },
  {
    id: "m1",
    title: "David O Callaghan",
    subtitle: "Founder & Developer",
    description: "Building FreeTrust — open-source trust infrastructure for modern applications.",
    href: "/members/davidocallaghan",
    category: "member",
    location: "Ireland",
    trustScore: 91,
  },
]

export async function fetchSearchResults({
  query,
  category = "all",
  location,
  priceMin,
  priceMax,
  trustScore = 0,
  page = 1,
  pageSize = 12,
}: SearchParams): Promise<SearchResponse> {
  const q = query?.toLowerCase().trim() ?? ""

  let filtered = DEMO_RESULTS.filter((r) => {
    if (q && !r.title.toLowerCase().includes(q) && !r.description?.toLowerCase().includes(q)) {
      return false
    }
    if (category && category !== "all" && r.category !== category) return false
    if (location && !r.location?.toLowerCase().includes(location.toLowerCase())) return false
    if (priceMin !== undefined && (r.price ?? 0) < priceMin) return false
    if (priceMax !== undefined && (r.price ?? Infinity) > priceMax) return false
    if (trustScore > 0 && (r.trustScore ?? 0) < trustScore) return false
    return true
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const results = filtered.slice(start, start + pageSize)

  return { results, total, totalPages }
}
