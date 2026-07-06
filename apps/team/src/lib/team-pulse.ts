import type { SupabaseClient } from "@supabase/supabase-js";
import { isSalonManager } from "./auth";
import { salonDateString } from "./calendar";
import type { StaffProfile } from "../env.d.ts";

export type TeamPulseMetrics = {
  todayAppointments: number;
  waitlistActive: number;
  lowStock: number;
  scope: "salon" | "personal";
  loaded: boolean;
};

const EMPTY: TeamPulseMetrics = {
  todayAppointments: 0,
  waitlistActive: 0,
  lowStock: 0,
  scope: "personal",
  loaded: false,
};

export async function loadTeamPulseMetrics(
  supabase: SupabaseClient,
  staff: StaffProfile,
): Promise<TeamPulseMetrics> {
  const todaySalon = salonDateString(new Date());
  const scope = isSalonManager(staff) ? "salon" : "personal";

  try {
    let apptQuery = supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("starts_at", `${todaySalon}T00:00:00`)
      .lt("starts_at", `${todaySalon}T23:59:59`)
      .not("status", "in", "(cancelled,no_show)");

    if (scope === "personal") {
      apptQuery = apptQuery.eq("staff_id", staff.id);
    }

    const [apptResult, waitlistResult, productsResult] = await Promise.all([
      apptQuery,
      supabase
        .from("waitlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("products")
        .select("reorder_threshold, inventory_stock(quantity)")
        .eq("is_active", true),
    ]);

    const lowStock = (productsResult.data ?? []).filter((p) => {
      const stock = Array.isArray(p.inventory_stock)
        ? p.inventory_stock[0]
        : p.inventory_stock;
      const qty = Number(stock?.quantity ?? 0);
      const threshold = Number(p.reorder_threshold ?? 0);
      return threshold > 0 && qty <= threshold;
    }).length;

    return {
      todayAppointments: apptResult.count ?? 0,
      waitlistActive: waitlistResult.count ?? 0,
      lowStock,
      scope,
      loaded: true,
    };
  } catch (error) {
    console.error("Failed to load team pulse metrics", error);
    return { ...EMPTY, scope };
  }
}

export function pulseHint(
  metric: "appointments" | "waitlist" | "stock",
  value: number,
  scope: TeamPulseMetrics["scope"],
): string {
  if (metric === "appointments") {
    if (value === 0) return scope === "salon" ? "Clear day ahead" : "Your chair is open";
    if (value === 1) return scope === "salon" ? "1 guest on the books" : "1 on your book";
    return scope === "salon" ? `${value} guests today` : `${value} on your book`;
  }
  if (metric === "waitlist") {
    if (value === 0) return "No one waiting";
    if (value === 1) return "1 client wants in";
    return `${value} clients want in`;
  }
  if (value === 0) return "Stock looks good";
  if (value === 1) return "1 item needs reorder";
  return `${value} items need reorder`;
}
