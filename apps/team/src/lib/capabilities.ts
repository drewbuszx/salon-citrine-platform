/**
 * Shared, bounded capability catalog for the role/permission editor (task 24).
 * The database `capabilities` table is the source of truth for descriptions;
 * these constants keep the API and UI type-safe and provide the anti-lockout
 * rules the UI must mirror (the database enforces them regardless).
 */
export const CAPABILITY_KEYS = ["manage_team", "view_activity"] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const CAPABILITY_ROLES = [
  "owner",
  "stylist",
  "esthetician",
  "front_desk",
] as const;
export type CapabilityRole = (typeof CAPABILITY_ROLES)[number];

/** Grants the editor must render as locked-on (database also refuses to drop them). */
export const LOCKED_ON_GRANTS: { role: CapabilityRole; capability: CapabilityKey }[] = [
  { role: "owner", capability: "manage_team" },
];

export function isLockedOnGrant(role: string, capability: string): boolean {
  return LOCKED_ON_GRANTS.some(
    (g) => g.role === role && g.capability === capability,
  );
}

export function isKnownCapability(value: string): value is CapabilityKey {
  return (CAPABILITY_KEYS as readonly string[]).includes(value);
}

export function isKnownRole(value: string): value is CapabilityRole {
  return (CAPABILITY_ROLES as readonly string[]).includes(value);
}