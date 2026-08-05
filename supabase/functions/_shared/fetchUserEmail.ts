import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function fetchUserEmail(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    console.warn("fetchUserEmail failed:", error.message);
    return null;
  }
  const email = data.user?.email?.trim() ?? "";
  return email || null;
}

export async function fetchProfileDisplayName(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const name = (data as { display_name?: string | null } | null)?.display_name?.trim() ?? "";
  return name;
}
