import type { User } from "@supabase/supabase-js";
import type { StaffProfile } from "../env.d.ts";
import { staffPhotoSrc } from "./staff-display";

export function mustChangePassword(user: User | null | undefined) {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  return meta.must_change_password === true;
}

/** Owner anti-lockout floor mirrored from staff_has_capability('manage_team'). */
export function hasStaffCapability(
  staff: StaffProfile | null | undefined,
  capability: string,
) {
  if (!staff) return false;
  if (capability === "manage_team" && staff.role === "owner") return true;
  if (staff.capabilities?.includes(capability)) return true;
  // Pre-migration fallback: preserve owner/front_desk manager behavior.
  if (!staff.capabilities && capability === "manage_team") {
    return staff.role === "owner" || staff.role === "front_desk";
  }
  if (!staff.capabilities && capability === "view_activity") {
    return staff.role === "owner" || staff.role === "front_desk";
  }
  return false;
}

export function isSalonManager(staff: StaffProfile | null | undefined) {
  return hasStaffCapability(staff, "manage_team");
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
  const { data: grants } = await supabase
    .from("role_capabilities")
    .select("capability")
    .eq("role", profile.role);

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
