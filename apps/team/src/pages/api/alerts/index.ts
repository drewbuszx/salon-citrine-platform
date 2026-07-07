import type { APIRoute } from "astro";
import { buildTeamAlerts } from "../../../lib/alerts";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  countAttentionTasks,
  countOpenPoolTasks,
  requireManager,
} from "../../../lib/api-tasks";
import { loadTeamPulseMetrics } from "../../../lib/team-pulse";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const manager = requireManager(staff);
  const generatedAt = new Date().toISOString();

  try {
    const [pulse, attentionTasks, openPoolTasks] = await Promise.all([
      loadTeamPulseMetrics(supabase, staff),
      countAttentionTasks(supabase, staff.id, manager).catch((error) => {
        console.error("alerts attention task count failed", error);
        return 0;
      }),
      countOpenPoolTasks(supabase).catch((error) => {
        console.error("alerts open pool task count failed", error);
        return 0;
      }),
    ]);

    const alerts = buildTeamAlerts({
      waitlistActive: pulse.waitlistActive,
      lowStock: pulse.lowStock,
      openPoolTasks,
      attentionTasks,
      scope: pulse.scope,
      generatedAt,
    });

    return jsonOk({
      alerts,
      unreadCount: alerts.length,
      generatedAt,
      scope: pulse.scope,
    });
  } catch (error) {
    console.error("alerts GET", error);
    return jsonError("Failed to load alerts", 500);
  }
};
