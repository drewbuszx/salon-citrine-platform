// NOTE: keep this module free of server-only imports. It is imported by the
// header's client controller (`scripts/team-alerts.ts`), so any runtime import
// that reaches `cloudflare:workers` (e.g. via `team-pulse` → `auth` →
// `supabase-server`) would poison the client bundle and stop ALL header JS
// from loading. The `TeamPulseMetrics` type import below is type-only and is
// fully erased at build time. Server-only alert builders live in
// `./alerts-build`.
import type { TeamPulseMetrics } from "./team-pulse";

/** Stable v1 alert identifiers — used for dismiss state and DOM keys. */
export const TEAM_ALERT_IDS = {
  waitlistActive: "waitlist-active",
  lowStock: "low-stock",
  tasksOpen: "tasks-open",
} as const;

export type TeamAlertKind =
  (typeof TEAM_ALERT_IDS)[keyof typeof TEAM_ALERT_IDS];

export type TeamAlertSeverity = "info" | "warning" | "urgent";

export type TeamAlert = {
  /** Stable id, e.g. `waitlist-active`. */
  id: TeamAlertKind;
  kind: TeamAlertKind;
  title: string;
  message: string;
  /** Actionable item count driving this alert. */
  count: number;
  /** Team-app path (relative to BASE_URL), suitable for `teamUrl(href)`. */
  href: string;
  severity: TeamAlertSeverity;
  /** ISO timestamp when the alert was computed (server `now`). */
  generatedAt: string;
};

export type AlertsSuccessResponse = {
  ok: true;
  alerts: TeamAlert[];
  generatedAt: string;
  scope: TeamPulseMetrics["scope"];
};

export type AlertsErrorResponse = {
  ok: false;
  error: string;
};

export type AlertsResponse = AlertsSuccessResponse | AlertsErrorResponse;

/** Snapshot passed to alert builders from the alerts API aggregator. */
export type TeamAlertMetrics = {
  waitlistActive: number;
  lowStock: number;
  /** Open-pool tasks anyone can claim (`assignment_type=open`, `status=open`). */
  openPoolTasks: number;
  /** Tasks due within attention window visible to the current staff member. */
  attentionTasks: number;
  scope: TeamPulseMetrics["scope"];
  generatedAt: string;
};

export type DismissedAlertRecord = {
  dismissedAt: string;
  /** Count at dismiss time — alert resurfaces when count increases. */
  count: number;
};

export type DismissedAlertsState = Partial<
  Record<TeamAlertKind, DismissedAlertRecord>
>;

export const DISMISSED_ALERTS_STORAGE_KEY = "team-alerts-dismissed-v1";

const VALID_KINDS = new Set<string>(Object.values(TEAM_ALERT_IDS));

export function tasksOpenCount(metrics: Pick<TeamAlertMetrics, "openPoolTasks" | "attentionTasks">) {
  return metrics.openPoolTasks + metrics.attentionTasks;
}

export function sortAlerts(alerts: TeamAlert[]): TeamAlert[] {
  const severityRank: Record<TeamAlertSeverity, number> = {
    urgent: 0,
    warning: 1,
    info: 2,
  };
  return [...alerts].sort((a, b) => {
    const bySeverity = severityRank[a.severity] - severityRank[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.count - a.count;
  });
}

export function isAlertUnread(
  alert: TeamAlert,
  dismissed: DismissedAlertsState,
): boolean {
  const record = dismissed[alert.kind];
  if (!record) return true;
  return alert.count > record.count;
}

export function countUnreadAlerts(
  alerts: TeamAlert[],
  dismissed: DismissedAlertsState,
): number {
  return alerts.filter((alert) => isAlertUnread(alert, dismissed)).length;
}

export function dismissAlert(
  state: DismissedAlertsState,
  alert: TeamAlert,
): DismissedAlertsState {
  return {
    ...state,
    [alert.kind]: {
      dismissedAt: new Date().toISOString(),
      count: alert.count,
    },
  };
}

function parseDismissedState(raw: string | null): DismissedAlertsState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const next: DismissedAlertsState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!VALID_KINDS.has(key) || !value || typeof value !== "object") continue;
      const record = value as Record<string, unknown>;
      const count = Number(record.count);
      const dismissedAt = String(record.dismissedAt ?? "");
      if (!Number.isFinite(count) || count < 0 || !dismissedAt) continue;
      next[key as TeamAlertKind] = { count, dismissedAt };
    }
    return next;
  } catch {
    return {};
  }
}

export function loadDismissedAlerts(): DismissedAlertsState {
  if (typeof localStorage === "undefined") return {};
  try {
    return parseDismissedState(localStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveDismissedAlerts(state: DismissedAlertsState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / privacy mode */
  }
}

/** Badge label: raw count up to 9, then `9+`. */
export function formatAlertBadgeCount(unreadCount: number): string | null {
  if (unreadCount <= 0) return null;
  return unreadCount > 9 ? "9+" : String(unreadCount);
}
