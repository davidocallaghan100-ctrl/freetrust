import { NextRequest, NextResponse } from "next/server";

type SDGBadge = {
  id: number;
  label: string;
  color: string;
};

type Review = {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
};

type OrganisationTab = {
  overview: string;
  mission: string;
  impact: string;
};

type Organisation = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  coverImage: string;
  tagline: string;
  description: string;
  website: string;
  location: string;
  founded: number;
  size: string;
  category: string;
  verified: boolean;
  followersCount: number;
  sdgs: SDGBadge[];
  tabs: OrganisationTab;
  reviews: Review[];
  socialLinks: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  projects: {
    id: string;
    title: string;
    status: "active" | "completed" | "upcoming";
    summary: string;
  }[];
  team: {
    id: string;
    name: string;
    role: string;
    avatar: string;
  }[];
};

const SDG_PALETTE: Record<number, { label: string; color: string }> = {
  1:  { label: "No Poverty",             color: "#E5243B" },
  2:  { label: "Zero Hunger",            color: "#DDA63A" },
  3:  { label: "Good Health",            color: "#4C9F38" },
  4:  { label: "Quality Education",      color: "#C5192D" },
  5:  { label: "Gender Equality",        color: "#FF3A21" },
  6:  { label: "Clean Water",            color: "#26BDE2" },
  7:  { label: "Affordable Energy",      color: "#FCC30B" },
  8:  { label: "Decent Work",            color: "#A21942" },
  9:  { label: "Industry & Innovation",  color: "#FD6925" },
  10: { label: "Reduced Inequalities",   color: "#DD1367" },
  11: { label: "Sustainable Cities",     color: "#FD9D24" },
  12: { label: "Responsible Consumption",color: "#BF8B2E" },
  13: { label: "Climate Action",         color: "#3F7E44" },
  14: { label: "Life Below Water",       color: "#0A97D9" },
  15: { label: "Life on Land",           color: "#56C02B" },
  16: { label: "Peace & Justice",        color: "#00689D" },
  17: { label: "Partnerships",           color: "#19486A" },
};

function buildSDGs(ids: number[]): SDGBadge[] {
  return ids.map((id) => ({
    id,
    label: SDG_PALETTE[id]?.label ?? `SDG ${id}`,
    color: SDG_PALETTE[id]?.color ?? "#6B7280",
  }));
}

const MOCK_ORGANISATIONS: Record<string, Organisation> = {
  "org-001": {
    id: "org-001",
    name: "GreenFuture Foundation",
    slug: "greenfuture-foundation",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=greenfuture",
    coverImage: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80",
    tagline: "Restoring ecosystems, one community at a time.",
    description:
      "GreenFuture Foundation partners with local communities across Sub-Saharan Africa and South-East Asia to restore degraded land, protect biodiversity corridors, and build climate resilience through nature-based solutions. Since 2009 we have planted over 14 million trees and trained 32,000 smallholder farmers in regenerative agriculture.",
    website: "https://greenfuture.example.org",
    location: "Nairobi, Kenya",
    founded: 2009,
    size: "51–200 employees",
    category: "Environment",
    verified: true,
    followersCount: 4821,
    sdgs: buildSDGs([13, 15, 2, 6]),
    tabs: {
      overview:
        "We operate reforestation programmes in 12 countries, working alongside governments, NGOs, and community cooperatives to deliver measurable ecological and social outcomes.",
      mission:
        "Our mission is to reverse land degradation and empower communities to become stewards of their natural heritage — ensuring thriving ecosystems for generations to come.",
      impact:
        "14M+ trees planted · 320,000 hectares under restoration · 32,000 farmers trained · 85,000 tonnes of CO₂ sequestered annually.",
    },
    reviews: [
      {
        id: "r-001",
        author: "Amara Diallo",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=amara",
        rating: 5,
        comment:
          "Working with GreenFuture transformed our village's relationship with the surrounding forest. The training was practical and deeply respectful of local knowledge.",
        date: "2024-03-12",
      },
      {
        id: "r-002",
        author: "Lena Hoffmann",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=lena",
        rating: 4,
        comment:
          "Excellent transparency in reporting and a genuine commitment to community-led approaches. Would love to see more engagement on their digital platforms.",
        date: "2024-01-28",
      },
    ],
    socialLinks: {
      twitter: "https://twitter.com/greenfuture_eg",
      linkedin: "https://linkedin.com/company/greenfuture-foundation",
    },
    projects: [
      {
        id: "proj-001",
        title: "Sahel Regreening Initiative",
        status: "active",
        summary: "Restoring 50,000 hectares of degraded dryland across Niger and Mali using farmer-managed natural regeneration.",
      },
      {
        id: "proj-002",
        title: "Mangrove Coastal Shield",
        status: "active",
        summary: "Replanting mangrove belts along 120 km of coastline in Mozambique to protect against storm surge and support fisheries.",
      },
      {
        id: "proj-003",
        title: "Seed Bank Network",
        status: "completed",
        summary: "Established 18 community-managed native seed banks across Kenya and Tanzania, preserving over 400 indigenous species.",
      },
    ],
    team: [
      {
        id: "tm-001",
        name: "Dr. Fatima Osei",
        role: "Executive Director",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=fatima",
      },
      {
        id: "tm-002",
        name: "James Mwangi",
        role: "Head of Field Operations",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=james",
      },
      {
        id: "tm-003",
        name: "Priya Nair",
        role: "Director of Partnerships",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
      },
    ],
  },
  "org-002": {
    id: "org-002",
    name: "TechForGood Labs",
    slug: "techforgood-labs",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=techforgood",
    coverImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
    tagline: "Open-source tools for a more equitable world.",
    description:
      "TechForGood Labs builds and maintains open-source software infrastructure that helps civil society organisations, humanitarian agencies, and grassroots collectives operate more effectively. Our tools are used by over 1,200 organisations in 78 countries.",
    website: "https://techforgood.example.io",
    location: "Berlin, Germany",
    founded: 2015,
    size: "11–50 employees",
    category: "Technology",
    verified: true,
    followersCount: 2340,
    sdgs: buildSDGs([9, 10, 16, 17]),
    tabs: {
      overview:
        "We focus on three product areas: data management for crisis response, digital identity for stateless populations, and transparency tools for public-sector accountability.",
      mission:
        "Technology should amplify human dignity, not extract from it. We exist to ensure the tools of the digital age are accessible, open, and governed by the communities they serve.",
      impact:
        "1,200+ NGO clients · 78 countries reached · 4.2M end-users of our platforms · 100% open-source codebase · $0 licensing fees.",
    },
    reviews: [
      {
        id: "r-003",
        author: "Carlos Mendez",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=carlos",
        rating: 5,
        comment:
          "Their humanitarian data kit saved us weeks of setup time during the Syria response. Exceptional documentation and a responsive support team.",
        date: "2024-04-05",
      },
    ],
    socialLinks: {
      twitter: "https://twitter.com/techforgoodlabs",
      linkedin: "https://linkedin.com/company/techforgood-labs",
      instagram: "https://instagram.com/techforgoodlabs",
    },
    projects: [
      {
        id: "proj-004",
        title: "OpenID for Refugees",
        status: "active",
        summary: "Blockchain-anchored digital identity credentials for stateless and displaced persons, piloting with UNHCR partners.",
      },
      {
        id: "proj-005",
        title: "BudgetWatch",
        status: "active",
        summary: "Public finance transparency dashboard deployed in 14 municipalities across Latin America and West Africa.",
      },
    ],
    team: [
      {
        id: "tm-004",
        name: "Sophie Richter",
        role: "CEO & Co-Founder",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sophie",
      },
      {
        id: "tm-005",
        name: "Kwame Asante",
        role: "CTO",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=kwame",
      },
    ],
  },
  "org-003": {
    id: "org-003",
    name: "SafeHarbour Alliance",
    slug: "safeharbour-alliance",
    logo: "https://api.dicebear.com/7.x/identicon/svg?seed=safeharbour",
    coverImage: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200&q=80",
    tagline: "Dignified shelter and pathways for displaced people.",
    description:
      "SafeHarbour Alliance coordinates emergency shelter, legal aid, and integration support for asylum seekers and refugees across Southern Europe. We work at the intersection of humanitarian response and long-term systemic advocacy.",
    website: "https://safeharbour.example.eu",
    location: "Athens, Greece",
    founded: 2016,
    size: "51–200 employees",
    category: "Humanitarian",
    verified: false,
    followersCount: 1107,
    sdgs: buildSDGs([10, 16, 11, 1]),
    tabs: {
      overview:
        "Operating across Greece, Italy, and Spain, we run reception centres, mobile legal clinics, and family reunification support programmes.",
      mission:
        "Every person fleeing persecution deserves safety, dignity, and the chance to rebuild their life. We work until that is a political and practical reality.",
      impact:
        "18,000+ individuals supported annually · 94% asylum approval rate for our clients · 6 reception centres · 120 pro-bono legal partners.",
    },
    reviews: [
      {
        id: "r-004",
        author: "Ioanna Papadaki",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ioanna",
        rating: 5,
        comment:
          "SafeHarbour's legal team guided my family through an incredibly complex process with patience and genuine care. We would not be here without them.",
        date: "2023-11-19",
      },
      {
        id: "r-005",
        author: "Marco Ferretti",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=marco",
        rating: 4,
        comment:
          "Strong on the ground operations. Their coordination with local authorities is impressive given how politicised the environment is.",
        date: "2024-02-07",
      },
    ],
    socialLinks: {
      twitter: "https://twitter.com/safeharbour_eu",
      linkedin: "https://linkedin.com/company/safeharbour-alliance",
    },
    projects: [
      {
        id: "proj-006",
        title: "Aegean Legal Clinic",
        status: "active",
        summary: "Mobile legal aid units serving island reception centres in Lesvos, Chios, and Samos.",
      },
      {
        id: "proj-007",
        title: "Pathway to Employment",
        status: "upcoming",
        summary: "Six-month vocational training and job-placement programme for recognised refugees in Athens and Thessaloniki.",
      },
    ],
    team: [
      {
        id: "tm-006",
        name: "Elena Vasiliou",
        role: "Executive Director",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=elena",
      },
      {
        id: "tm-007",
        name: "Yusuf Al-Rashid",
        role: "Head of Legal Services",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=yusuf",
      },
    ],
  },
};

function notFound(id: string) {
  return NextResponse.json(
    { error: "Organisation not found", id },
    { status: 404 }
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Invalid organisation ID" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const org = MOCK_ORGANISATIONS[id] ?? null;

  if (!org) {
    // Attempt a slug-based lookup as fallback
    const bySlug = Object.values(MOCK_ORGANISATIONS).find(
      (o) => o.slug === id
    );
    if (!bySlug) {
      return notFound(id);
    }
    return NextResponse.json(
      { data: bySlug, source: "mock" },
      { status: 200, headers: corsHeaders() }
    );
  }

  return NextResponse.json(
    { data: org, source: "mock" },
    { status: 200, headers: corsHeaders() }
  );
}

