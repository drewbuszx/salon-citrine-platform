import type { StaffProfile } from "../env.d.ts";

export function isSalonManager(staff: StaffProfile | null | undefined) {
  return staff?.role === "owner" || staff?.role === "front_desk";
}

export async function loadStaffProfile(
  supabase: App.Locals["supabase"],
  userId: string,
): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, slug, name, role")
    .eq("supabase_user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as StaffProfile;
}
