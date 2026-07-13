/**
 * Shared shaping for the manager activity log backed by staff_security_audit.
 * RLS restricts reads to managers; this module only maps rows to a safe,
 * display-ready shape and never exposes raw auth ids.
 */
export const STAFF_AUDIT_SELECT =
  "id, action, before_state, after_state, request_id, created_at, " +
  "actor:staff!staff_security_audit_actor_staff_id_fkey ( id, name ), " +
  "target:staff!staff_security_audit_target_staff_id_fkey ( id, name )";

export const AUDIT_ACTIONS = [
  "staff_created",
  "role_changed",
  "invited",
  "reinvited",
  "linked",
  "deactivated",
  "reactivated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  staff_created: "Employee created",
  role_changed: "Role changed",
  invited: "Invite sent",
  reinvited: "Invite resent",
  linked: "Account linked",
  deactivated: "Access deactivated",
  reactivated: "Access reactivated",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

type Rel =
  | { id: string; name: string }
  | { id: string; name: string }[]
  | null;

function relOne(value: Rel) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type StaffAuditRow = {
  id: string;
  action: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
  actor: Rel;
  target: Rel;
};

export type StaffAuditItem = {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string | null;
  targetName: string | null;
  detail: string | null;
  createdAt: string;
};

function summarize(row: StaffAuditRow): string | null {
  if (row.action === "role_changed") {
    const before = row.before_state?.role;
    const after = row.after_state?.role;
    if (before || after) {
      return `${String(before ?? "unknown")} to ${String(after ?? "unknown")}`;
    }
  }
  if (row.action === "staff_created") {
    const role = row.after_state?.role;
    if (role) return `as ${String(role)}`;
  }
  return null;
}

export function mapAuditRow(row: StaffAuditRow): StaffAuditItem {
  const actor = relOne(row.actor);
  const target = relOne(row.target);
  return {
    id: row.id,
    action: row.action,
    actionLabel: auditActionLabel(row.action),
    actorName: actor?.name ?? null,
    targetName: target?.name ?? null,
    detail: summarize(row),
    createdAt: row.created_at,
  };
}