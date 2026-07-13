import type { User } from "@supabase/supabase-js";
import type { StaffProfile } from "../env.d.ts";
import { staffPhotoSrc } from "./staff-display";
import { hasStaffCapability, isSalonManager } from "./staff-capability";

export { hasStaffCapability, isSalonManager };

export function mustChangePassword(user: User | null | undefined) {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  return meta.must_change_password === true;
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

  const profile = data as StaffProfile;
  const { data: grants, error: grantsError } = await supabase
    .from("role_capabilities")
    .select("capability")
    .eq("role", profile.role);

  if (grantsError) {
    // Table missing / pre-0038 / transient catalog failure: leave undefined so
    // hasStaffCapability uses the owner|front_desk expand-contract fallback.
    // Never assign [] here — that skips the fallback and locks out managers.
    return profile;
  }

  const capabilities = (grants ?? []).map((g) => String(g.capability));
  // Anti-lockout floor: owners always retain manage_team in the app layer too.
  if (profile.role === "owner" && !capabilities.includes("manage_team")) {
    capabilities.push("manage_team");
  }
  profile.capabilities = capabilities;
  return profile;
}

export function staffPhotoUrl(staff: StaffProfile): string | null {
  return staffPhotoSrc(staff.photo_url, staff.slug);
}
