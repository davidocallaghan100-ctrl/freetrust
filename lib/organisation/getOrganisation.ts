import { Organisation } from "@/types/organisation";
import { createClient } from "@/lib/supabase/client";

export async function getOrganisationById(id: string): Promise<Organisation | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("organisations")
      .select("*")
      .eq("id", id)
      .single();
    return data as Organisation | null;
  } catch {
    return null;
  }
}

export async function getAllOrganisations(): Promise<Organisation[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("organisations")
      .select("*")
      .order("name");
    return (data as Organisation[]) ?? [];
  } catch {
    return [];
  }
}
