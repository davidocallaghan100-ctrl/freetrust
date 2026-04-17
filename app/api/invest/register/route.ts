import { NextRequest, NextResponse } from "next/server";

type InvestorEntry = {
  id: string;
  name: string;
  email: string;
  tier: string;
  amount: number;
  registeredAt: string;
};

type RegisterBody = {
  name: string;
  email: string;
  tier: string;
  amount: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __investorStore: InvestorEntry[] | undefined;
}

function getStore(): InvestorEntry[] {
  if (!global.__investorStore) {
    global.__investorStore = [];
  }
  return global.__investorStore;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidTier(tier: string): boolean {
  const validTiers = ["Explorer", "Builder", "Pioneer", "Visionary", "Custom"];
  return validTiers.includes(tier);
}

function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<RegisterBody>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { name, email, tier, amount } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json(
      { success: false, message: "A valid name (min 2 characters) is required." },
      { status: 400 }
    );
  }

  if (!email || typeof email !== "string" || !isValidEmail(email.trim())) {
    return NextResponse.json(
      { success: false, message: "A valid email address is required." },
      { status: 400 }
    );
  }

  if (!tier || typeof tier !== "string" || !isValidTier(tier)) {
    return NextResponse.json(
      {
        success: false,
        message: "Tier must be one of: Explorer, Builder, Pioneer, Visionary, Custom.",
      },
      { status: 400 }
    );
  }

  if (amount === undefined || typeof amount !== "number" || !isFinite(amount) || amount < 1) {
    return NextResponse.json(
      { success: false, message: "Amount must be a positive number." },
      { status: 400 }
    );
  }

  const store = getStore();

  const duplicate = store.find(
    (e) => e.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json(
      {
        success: false,
        message: "This email has already registered interest. We'll be in touch soon!",
      },
      { status: 409 }
    );
  }

  const entry: InvestorEntry = {
    id: generateId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    tier: tier.trim(),
    amount,
    registeredAt: new Date().toISOString(),
  };

  store.push(entry);

  return NextResponse.json(
    {
      success: true,
      message: "We'll be in touch!",
      data: {
        id: entry.id,
        name: entry.name,
        tier: entry.tier,
        registeredAt: entry.registeredAt,
      },
    },
    { status: 201 }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.INVEST_ADMIN_SECRET) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  const store = getStore();

  const totalRaised = store.reduce((sum, e) => sum + e.amount, 0);
  const totalInvestors = store.length;

  return NextResponse.json(
    {
      success: true,
      totalInvestors,
      totalRaised,
      entries: store,
    },
    { status: 200 }
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, GET, OPTIONS",
    },
  });
}

