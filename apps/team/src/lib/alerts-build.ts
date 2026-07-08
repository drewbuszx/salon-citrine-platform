import { pulseHint } from "./team-pulse";
import { isModuleEnabled } from "./modules";
import {
  TEAM_ALERT_IDS,
  sortAlerts,
  tasksOpenCount,
  type TeamAlert,
  type TeamAlertMetrics,
  type TeamAlertSeverity,
} from "./alerts";

/**
 * Server-only alert builders.
 *
 * These import `team-pulse` (which reaches `auth` → `supabase-server` →
 * `cloudflare:workers`), so they MUST stay out of any client bundle. The
 * header's client controller (`scripts/team-alerts.ts`) imports only the pure
 * helpers from `./alerts`; the alerts API route imports the builders from here.
 */

export function buildWaitlistAlert(
  count: number,
  generatedAt: string,
): TeamAlert | null {
  if (count <= 0) return null;
  return {
    id: TEAM_ALERT_IDS.waitlistActive,
    kind: TEAM_ALERT_IDS.waitlistActive,
    title: "Waitlist",
    message: pulseHint("waitlist", count),
    count,
    href: "/waitlist",
    severity: count >= 3 ? "warning" : "info",
    generatedAt,
  };
}

export function buildLowStockAlert(
  count: number,
  generatedAt: string,
): TeamAlert | null {
  if (count <= 0) return null;
  return {
    id: TEAM_ALERT_IDS.lowStock,
    kind: TEAM_ALERT_IDS.lowStock,
    title: "Low stock",
    message: pulseHint("stock", count),
    count,
    href: "/inventory?lowStockOnly=1",
    severity: "warning",
    generatedAt,
  };
}

export function buildTasksOpenAlert(
  metrics: Pick<TeamAlertMetrics, "openPoolTasks" | "attentionTasks" | "generatedAt">,
): TeamAlert | null {
  const count = tasksOpenCount(metrics);
  if (count <= 0) return null;

  const { openPoolTasks, attentionTasks } = metrics;
  let message: string;
  let href = "/tasks";
  let severity: TeamAlertSeverity = "info";

  if (attentionTasks > 0 && openPoolTasks > 0) {
    message =
      attentionTasks === 1
        ? `1 due soon · ${openPoolTasks} open to claim`
        : `${attentionTasks} due soon · ${openPoolTasks} open to claim`;
    href = "/tasks?view=attention";
    severity = "urgent";
  } else if (attentionTasks > 0) {
    message =
      attentionTasks === 1
        ? "1 task due soon · view tasks"
        : `${attentionTasks} tasks due soon · view tasks`;
    href = "/tasks?view=attention";
    severity = "urgent";
  } else {
    message =
      openPoolTasks === 1
        ? "1 open task · claim or assign"
        : `${openPoolTasks} open tasks · claim or assign`;
    href = "/tasks?view=available";
  }

  return {
    id: TEAM_ALERT_IDS.tasksOpen,
    kind: TEAM_ALERT_IDS.tasksOpen,
    title: "Tasks",
    message,
    count,
    href,
    severity,
    generatedAt: metrics.generatedAt,
  };
}

/** Build the v1 alert list from aggregated metrics (count > 0 only). */
export function buildTeamAlerts(metrics: TeamAlertMetrics): TeamAlert[] {
  // Waitlist belongs to Book and low stock to Stock; skip those alerts while
  // those modules are set aside so alerts never deep-link into hidden routes.
  const alerts = [
    isModuleEnabled("book")
      ? buildWaitlistAlert(metrics.waitlistActive, metrics.generatedAt)
      : null,
    isModuleEnabled("stock")
      ? buildLowStockAlert(metrics.lowStock, metrics.generatedAt)
      : null,
    buildTasksOpenAlert(metrics),
  ].filter((alert): alert is TeamAlert => alert != null);

  return sortAlerts(alerts);
}
