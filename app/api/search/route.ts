import { NextRequest, NextResponse } from "next/server";

type OrgResult = {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  sdgs: number[];
  followers: number;
  verified: boolean;
  logo?: string;
};

type ProjectResult = {
  id: string;
  title: string;
  description: string;
  orgId: string;
  orgName: string;
  status: "active" | "completed" | "planned";
  sdgs: number[];
  location: string;
};

type UserResult = {
  id: string;
  name: string;
  role: string;
  orgId?: string;
  orgName?: string;
  avatar?: string;
};

type SearchResults = {
  organisations: OrgResult[];
  projects: ProjectResult[];
  users: UserResult[];
  total: number;
  query: string;
  filters: {
    category?: string;
    sdg?: number;
    location?: string;
    verified?: boolean;
  };
};

const MOCK_ORGS: OrgResult[] = [
  {
    id: "org-1",
    name: "GreenEarth Alliance",
    description: "Global coalition driving climate action and reforestation projects across 40+ countries.",
    category: "Environment",
    location: "Geneva, Switzerland",
    sdgs: [13, 15, 6],
    followers: 12400,
    verified: true,
    logo: undefined,
  },
  {
    id: "org-2",
    name: "EduReach Foundation",
    description: "Expanding quality education access to underserved communities in sub-Saharan Africa.",
    category: "Education",
    location: "Nairobi, Kenya",
    sdgs: [4, 10, 17],
    followers: 8750,
    verified: true,
    logo: undefined,
  },
  {
    id: "org-3",
    name: "CleanWater Initiative",
    description: "Engineering-led NGO delivering sustainable water infrastructure to rural populations.",
    category: "Water & Sanitation",
    location: "Mumbai, India",
    sdgs: [6, 3, 11],
    followers: 5300,
    verified: false,
    logo: undefined,
  },
  {
    id: "org-4",
    name: "HealthBridge Global",
    description: "Connecting volunteer medical professionals with crisis-affected regions worldwide.",
    category: "Health",
    location: "London, UK",
    sdgs: [3, 10, 17],
    followers: 21000,
    verified: true,
    logo: undefined,
  },
  {
    id: "org-5",
    name: "FoodSec Network",
    description: "Tackling food insecurity through community-led agricultural innovation programs.",
    category: "Food & Agriculture",
    location: "Kampala, Uganda",
    sdgs: [2, 1, 8],
    followers: 3100,
    verified: false,
    logo: undefined,
  },
  {
    id: "org-6",
    name: "RenewPower Trust",
    description: "Accelerating renewable energy deployment in emerging markets via policy and finance.",
    category: "Energy",
    location: "Berlin, Germany",
    sdgs: [7, 13, 9],
    followers: 9800,
    verified: true,
    logo: undefined,
  },
  {
    id: "org-7",
    name: "OceanGuard Society",
    description: "Marine conservation organisation protecting biodiversity and fighting plastic pollution.",
    category: "Environment",
    location: "Sydney, Australia",
    sdgs: [14, 13, 12],
    followers: 15600,
    verified: true,
    logo: undefined,
  },
  {
    id: "org-8",
    name: "SafeHaven Refugees",
    description: "Legal aid and resettlement support for displaced persons and asylum seekers.",
    category: "Humanitarian",
    location: "Athens, Greece",
    sdgs: [10, 16, 1],
    followers: 6200,
    verified: false,
    logo: undefined,
  },
];

const MOCK_PROJECTS: ProjectResult[] = [
  {
    id: "proj-1",
    title: "Amazon Reforestation Drive 2024",
    description: "Planting 10 million native trees across degraded Amazon basin land by Q4 2024.",
    orgId: "org-1",
    orgName: "GreenEarth Alliance",
    status: "active",
    sdgs: [13, 15],
    location: "Pará, Brazil",
  },
  {
    id: "proj-2",
    title: "Girls in STEM — East Africa",
    description: "Scholarship and mentorship program for 500 girls pursuing STEM education.",
    orgId: "org-2",
    orgName: "EduReach Foundation",
    status: "active",
    sdgs: [4, 5],
    location: "Kenya & Tanzania",
  },
  {
    id: "proj-3",
    title: "Solar Micro-Grid Deployment",
    description: "Installing community solar grids across 30 off-grid villages in rural Uganda.",
    orgId: "org-6",
    orgName: "RenewPower Trust",
    status: "planned",
    sdgs: [7, 1],
    location: "Uganda",
  },
  {
    id: "proj-4",
    title: "Mobile Health Clinics — Syria",
    description: "Deploying 12 mobile clinics to provide primary healthcare in conflict zones.",
    orgId: "org-4",
    orgName: "HealthBridge Global",
    status: "active",
    sdgs: [3],
    location: "Northern Syria",
  },
  {
    id: "proj-5",
    title: "Pacific Plastic Cleanup Campaign",
    description: "Fleet-based ocean plastic collection targeting the North Pacific Gyre.",
    orgId: "org-7",
    orgName: "OceanGuard Society",
    status: "active",
    sdgs: [14, 12],
    location: "North Pacific Ocean",
  },
  {
    id: "proj-6",
    title: "Urban Water Kiosks — Maharashtra",
    description: "Building 200 solar-powered clean water kiosks in peri-urban Maharashtra.",
    orgId: "org-3",
    orgName: "CleanWater Initiative",
    status: "completed",
    sdgs: [6, 11],
    location: "Maharashtra, India",
  },
];

const MOCK_USERS: UserResult[] = [
  {
    id: "user-1",
    name: "Amara Diallo",
    role: "Programme Director",
    orgId: "org-2",
    orgName: "EduReach Foundation",
  },
  {
    id: "user-2",
    name: "Lars Eriksson",
    role: "Climate Policy Analyst",
    orgId: "org-1",
    orgName: "GreenEarth Alliance",
  },
  {
    id: "user-3",
    name: "Priya Nair",
    role: "Water Engineer",
    orgId: "org-3",
    orgName: "CleanWater Initiative",
  },
  {
    id: "user-4",
    name: "James Okonkwo",
    role: "Volunteer Coordinator",
    orgId: "org-4",
    orgName: "HealthBridge Global",
  },
  {
    id: "user-5",
    name: "Sofia Marchetti",
    role: "Marine Biologist",
    orgId: "org-7",
    orgName: "OceanGuard Society",
  },
  {
    id: "user-6",
    name: "David Chen",
    role: "Independent Researcher",
    orgId: undefined,
    orgName: undefined,
  },
];

function matchesQuery(fields: string[], q: string): boolean {
  const lower = q.toLowerCase().trim();
  if (!lower) return true;
  return fields.some((f) => f.toLowerCase().includes(lower));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const type = searchParams.get("type") ?? "all"; // all | organisations | projects | users
    const category = searchParams.get("category") ?? undefined;
    const sdgParam = searchParams.get("sdg");
    const sdg = sdgParam ? parseInt(sdgParam, 10) : undefined;
    const location = searchParams.get("location") ?? undefined;
    const verifiedParam = searchParams.get("verified");
    const verified =
      verifiedParam === "true" ? true : verifiedParam === "false" ? false : undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;
    const offsetParam = searchParams.get("offset");
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Filter organisations
    let orgs: OrgResult[] = [];
    if (type === "all" || type === "organisations") {
      orgs = MOCK_ORGS.filter((o) => {
        if (!matchesQuery([o.name, o.description, o.category, o.location], q)) return false;
        if (category && o.category.toLowerCase() !== category.toLowerCase()) return false;
        if (sdg !== undefined && !isNaN(sdg) && !o.sdgs.includes(sdg)) return false;
        if (location && !o.location.toLowerCase().includes(location.toLowerCase())) return false;
        if (verified !== undefined && o.verified !== verified) return false;
        return true;
      });
    }

    // Filter projects
    let projects: ProjectResult[] = [];
    if (type === "all" || type === "projects") {
      projects = MOCK_PROJECTS.filter((p) => {
        if (!matchesQuery([p.title, p.description, p.orgName, p.location], q)) return false;
        if (sdg !== undefined && !isNaN(sdg) && !p.sdgs.includes(sdg)) return false;
        if (location && !p.location.toLowerCase().includes(location.toLowerCase())) return false;
        return true;
      });
    }

    // Filter users
    let users: UserResult[] = [];
    if (type === "all" || type === "users") {
      users = MOCK_USERS.filter((u) => {
        const orgName = u.orgName ?? "";
        if (!matchesQuery([u.name, u.role, orgName], q)) return false;
        return true;
      });
    }

    const total = orgs.length + projects.length + users.length;

    // Apply pagination to each group proportionally when type === "all"
    const paginatedOrgs = orgs.slice(offset, offset + limit);
    const paginatedProjects = projects.slice(offset, offset + limit);
    const paginatedUsers = users.slice(offset, offset + limit);

    const result: SearchResults = {
      organisations: paginatedOrgs,
      projects: paginatedProjects,
      users: paginatedUsers,
      total,
      query: q,
      filters: {
        category,
        sdg,
        location,
        verified,
      },
    };

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[/api/search] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", organisations: [], projects: [], users: [], total: 0 },
      { status: 500 }
    );
  }
}

