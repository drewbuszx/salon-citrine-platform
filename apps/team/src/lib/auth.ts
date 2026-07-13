import type { User } from "@supabase/supabase-js";
import type { StaffProfile } from "../env.d.ts";
import { staffPhotoSrc } from "./staff-display";

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
    .select("id, slug, name, role, bio, phone, photo_url, photo_crop, access_status")
    .eq("supabase_user_id", userId)
    .eq("access_status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as StaffProfile;
}

export function staffPhotoUrl(staff: StaffProfile): string | null {
  return staffPhotoSrc(staff.photo_url, staff.slug);
}
