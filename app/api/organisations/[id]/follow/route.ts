export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const orgId = params.id;
  const userId = user.id;

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organisation_followers")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[follow] fetch error:", fetchError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    if (existing) {
      const { error: deleteError } = await supabase
        .from("organisation_followers")
        .delete()
        .eq("organisation_id", orgId)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("[follow] delete error:", deleteError);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
      }

      const { count } = await supabase
        .from("organisation_followers")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", orgId);

      return NextResponse.json({ following: false, followers: count ?? 0 });
    }

    const { error: insertError } = await supabase
      .from("organisation_followers")
      .insert({ organisation_id: orgId, user_id: userId });

    if (insertError) {
      console.error("[follow] insert error:", insertError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const { count } = await supabase
      .from("organisation_followers")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId);

    return NextResponse.json({ following: true, followers: count ?? 0 });
  } catch (err) {
    console.error("[follow] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const orgId = params.id;
  const userId = user?.id ?? null;

  try {
    const { count: followers } = await supabase
      .from("organisation_followers")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId);

    if (!userId) {
      return NextResponse.json({ following: false, followers: followers ?? 0 });
    }

    const { data: existing } = await supabase
      .from("organisation_followers")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      following: !!existing,
      followers: followers ?? 0,
    });
  } catch (err) {
    console.error("[follow/GET] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
