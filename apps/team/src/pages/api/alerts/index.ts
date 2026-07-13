import type { APIRoute } from "astro";
import { buildTeamAlerts } from "../../../lib/alerts-build";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { countPendingTimeOff } from "../../../lib/api-events";
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
    const [pulse, attentionTasks, openPoolTasks, pendingTimeOff, pendingInvites] =
      await Promise.all([
        loadTeamPulseMetrics(supabase, staff),
        countAttentionTasks(supabase, staff.id, manager).catch((error) => {
          console.error("alerts attention task count failed", error);
          return 0;
        }),
        countOpenPoolTasks(supabase).catch((error) => {
          console.error("alerts open pool task count failed", error);
          return 0;
        }),
        manager
          ? countPendingTimeOff(supabase, staff).catch((error) => {
              console.error("alerts pending time-off count failed", error);
              return 0;
            })
          : Promise.resolve(0),
        manager
          ? supabase
              .from("staff")
              .select("id", { count: "exact", head: true })
              .eq("access_status", "invited")
              .then(({ count, error }) => {
                if (error) throw error;
                return count ?? 0;
              })
              .catch((error) => {
                console.error("alerts pending invites count failed", error);
                return 0;
              })
          : Promise.resolve(0),
      ]);

    const alerts = buildTeamAlerts({
      waitlistActive: pulse.waitlistActive,
      lowStock: pulse.lowStock,
      openPoolTasks,
      attentionTasks,
      pendingTimeOff,
      pendingInvites,
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
