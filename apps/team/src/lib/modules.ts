/**
 * Employee-management scale-back switch.
 *
 * The product is temporarily focused on employee management. The booking,
 * retail (stock), clients, and reporting modules are HIDDEN from navigation
 * and dashboard/manage entry points, but ALL of their code, routes, APIs, and
 * data remain intact so they can be revived later.
 *
 * ── How to revive the full salon platform ──────────────────────────────────
 *   • Everything at once: set `SCALED_BACK` to `false` below.
 *   • A single module: add its id to `EMPLOYEE_MANAGEMENT_MODULES`
 *     (top-level nav) and/or `EMPLOYEE_MANAGEMENT_MANAGE` (Manage sections)
 *     while leaving `SCALED_BACK` as `true`.
 *
 * Nothing else needs to change — nav, dashboard, Manage, and alerts all read
 * from the helpers exported here.
 */

export type TeamModuleId =
  | "dashboard"
  | "book"
  | "tasks"
  | "stock"
  | "clients"
  | "docs"
  | "events"
  | "reports"
  | "manage";

/** Master switch for the employee-management scale-back. */
export const SCALED_BACK = true;

/** Full salon-platform navigation (used when not scaled back). */
const ALL_MODULES: TeamModuleId[] = [
  "dashboard",
  "book",
  "tasks",
  "stock",
  "clients",
  "docs",
  "events",
  "reports",
  "manage",
];

/** Modules kept visible while scaled back to employee management. */
const EMPLOYEE_MANAGEMENT_MODULES: TeamModuleId[] = [
  "dashboard",
  "tasks",
  "docs",
  "events",
  "manage",
];

export const ENABLED_MODULES: readonly TeamModuleId[] = SCALED_BACK
  ? EMPLOYEE_MANAGEMENT_MODULES
  : ALL_MODULES;

export function isModuleEnabled(id: TeamModuleId): boolean {
  return ENABLED_MODULES.includes(id);
}

/** Manage (Business Settings) sub-sections. Ids match `ManageSection`. */
export type ManageModuleId =
  | "services"
  | "products"
  | "booking-policy"
  | "staff"
  | "tags"
  | "business";

/** Full set of Manage sections (used when not scaled back). */
const ALL_MANAGE_SECTIONS: ManageModuleId[] = [
  "services",
  "products",
  "booking-policy",
  "staff",
  "tags",
  "business",
];

/**
 * Manage sections kept while scaled back — employee and business
 * administration only. Services/Products/Booking Policy serve booking &
 * retail, and Tags serves the client directory, so they are hidden here.
 */
const EMPLOYEE_MANAGEMENT_MANAGE: ManageModuleId[] = ["staff", "business"];

export const ENABLED_MANAGE_SECTIONS: readonly ManageModuleId[] = SCALED_BACK
  ? EMPLOYEE_MANAGEMENT_MANAGE
  : ALL_MANAGE_SECTIONS;

export function isManageSectionEnabled(id: ManageModuleId): boolean {
  return ENABLED_MANAGE_SECTIONS.includes(id);
}

const DISABLED_ROUTE_PREFIXES: ReadonlyArray<{
  module: TeamModuleId;
  prefixes: readonly string[];
}> = [
  {
    module: "book",
    prefixes: [
      "/my-book",
      "/services",
      "/my-services",
      "/booking-policy",
      "/waitlist",
      "/checkout",
      "/api/my-book",
      "/api/services",
      "/api/staff-services",
      "/api/booking-policy",
      "/api/waitlist",
      "/api/checkout",
      "/api/appointments",
      "/api/blocked-times",
      "/api/block-time",
      "/api/calendar",
    ],
  },
  { module: "stock", prefixes: ["/inventory", "/api/inventory"] },
  { module: "clients", prefixes: ["/clients", "/api/clients"] },
  { module: "reports", prefixes: ["/reports", "/api/reports"] },
];

function pathMatchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Returns the centrally disabled module for a page/API path, if any. */
export function disabledModuleForPath(path: string): TeamModuleId | null {
  for (const entry of DISABLED_ROUTE_PREFIXES) {
    if (
      !isModuleEnabled(entry.module) &&
      entry.prefixes.some((prefix) => pathMatchesPrefix(path, prefix))
    ) {
      return entry.module;
    }
  }
  return null;
}
