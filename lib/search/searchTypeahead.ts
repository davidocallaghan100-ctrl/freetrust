import type { TypeaheadResult } from "./types"

// Mock typeahead — returns placeholder suggestions based on query
// Replace with real DB/API calls once search backend is wired up
export async function searchTypeahead(query: string): Promise<TypeaheadResult[]> {
  if (!query || query.trim().length < 2) return []

  const q = query.toLowerCase().trim()

  // Static demo data — swap for Supabase/API query in production
  const DEMO: TypeaheadResult[] = [
    { id: "s1", title: "Web Development", subtitle: "Service", category: "service", href: "/services/web-development", trustScore: 92 },
    { id: "s2", title: "Logo Design", subtitle: "Service", category: "service", href: "/services/logo-design", trustScore: 88 },
    { id: "p1", title: "FreeTrust Pro Plan", subtitle: "Product", category: "product", href: "/products/pro-plan", trustScore: 95 },
    { id: "e1", title: "Freelancer Meetup Dublin", subtitle: "Event · Apr 2026", category: "event", href: "/events/freelancer-meetup-dublin", trustScore: 78 },
    { id: "o1", title: "Tech Guild Ireland", subtitle: "Organisation", category: "organisation", href: "/organisations/tech-guild-ireland", trustScore: 85 },
    { id: "m1", title: "David O Callaghan", subtitle: "Member", category: "member", href: "/members/davidocallaghan", trustScore: 91 },
  ]

  return DEMO.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      (r.subtitle?.toLowerCase().includes(q) ?? false)
  ).slice(0, 6)
}
