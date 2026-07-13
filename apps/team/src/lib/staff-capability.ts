import type { StaffProfile } from "../env.d.ts";

/**
 * Owner anti-lockout floor mirrored from staff_has_capability('manage_team').
 *
 * Expand-contract: `capabilities` is only set when the role_capabilities catalog
 * query succeeds. `undefined` means pre-0038 / catalog unavailable — fall back to
 * owner|front_desk for manage_team and view_activity. An empty array `[]` means
 * the catalog loaded and the role has no grants (do NOT treat as pre-migration;
 * that was the app-before-migration lockout bug when query failure set `[]`).
 */
export function hasStaffCapability(
  staff: StaffProfile | null | undefined,
  capability: string,
) {
  if (!staff) return false;
  if (capability === "manage_team" && staff.role === "owner") return true;

  if (Array.isArray(staff.capabilities)) {
    return staff.capabilities.includes(capability);
  }

  // Catalog unavailable (app deployed before 0038, or role_capabilities query failed).
  if (capability === "manage_team" || capability === "view_activity") {
    return staff.role === "owner" || staff.role === "front_desk";
  }
  return false;
}

export function isSalonManager(staff: StaffProfile | null | undefined) {
  return hasStaffCapability(staff, "manage_team");
}
