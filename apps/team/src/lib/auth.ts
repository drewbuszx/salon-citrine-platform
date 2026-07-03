import type { User } from "@supabase/supabase-js";
import type { StaffProfile } from "../env.d.ts";

export function mustChangePassword(user: User | null | undefined) {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  return meta.must_change_password === true;
}

export function isSalonManager(staff: StaffProfile | null | undefined) {
  return staff?.role === "owner" || staff?.role === "front_desk";
}

export async function loadStaffProfile(
  supabase: App.Locals["supabase"],
  userId: string,
): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, slug, name, role, bio, phone, photo_url")
    .eq("supabase_user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as StaffProfile;
}
