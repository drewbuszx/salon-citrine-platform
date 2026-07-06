import { formatCents } from "@saloncitrine/shared";
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
  todayRevenueCents: number | null;
  todayCheckoutCount: number | null;
};

const EMPTY: TeamPulseMetrics = {
  todayAppointments: 0,
  waitlistActive: 0,
  lowStock: 0,
  scope: "personal",
  loaded: false,
  todayRevenueCents: null,
  todayCheckoutCount: null,
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

    const revenueQuery =
      scope === "salon"
        ? supabase
            .from("checkout_orders")
            .select("total_cents")
            .eq("status", "completed")
            .gte("completed_at", `${todaySalon}T00:00:00`)
            .lt("completed_at", `${todaySalon}T23:59:59`)
        : null;

    const [apptResult, waitlistResult, productsResult, revenueResult] =
      await Promise.all([
        apptQuery,
        supabase
          .from("waitlist_entries")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("products")
          .select("reorder_threshold, inventory_stock(quantity)")
          .eq("is_active", true),
        revenueQuery ?? Promise.resolve({ data: null, error: null }),
      ]);

    const lowStock = (productsResult.data ?? []).filter((p) => {
      const stock = Array.isArray(p.inventory_stock)
        ? p.inventory_stock[0]
        : p.inventory_stock;
      const qty = Number(stock?.quantity ?? 0);
      const threshold = Number(p.reorder_threshold ?? 0);
      return threshold > 0 && qty <= threshold;
    }).length;

    let todayRevenueCents: number | null = null;
    let todayCheckoutCount: number | null = null;
    if (scope === "salon" && revenueResult.data) {
      const rows = revenueResult.data;
      todayCheckoutCount = rows.length;
      todayRevenueCents = rows.reduce(
        (sum, row) => sum + (row.total_cents ?? 0),
        0,
      );
    }

    return {
      todayAppointments: apptResult.count ?? 0,
      waitlistActive: waitlistResult.count ?? 0,
      lowStock,
      scope,
      loaded: true,
      todayRevenueCents,
      todayCheckoutCount,
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
    if (value === 0) {
      return scope === "salon" ? "Open book · add a guest" : "Open book · your chair is free";
    }
    if (value === 1) {
      return scope === "salon" ? "1 guest today · open book" : "1 on your book · open book";
    }
    return scope === "salon"
      ? `${value} guests today · open book`
      : `${value} on your book · open book`;
  }
  if (metric === "waitlist") {
    if (value === 0) return "Queue empty · view waitlist";
    if (value === 1) return "1 waiting · book or reply";
    return `${value} waiting · book or reply`;
  }
  if (value === 0) return "All stocked · view inventory";
  if (value === 1) return "1 below threshold · reorder";
  return `${value} below threshold · reorder`;
}

export function revenuePaceHint(metrics: TeamPulseMetrics): string | null {
  if (metrics.scope !== "salon" || metrics.todayCheckoutCount === null) {
    return null;
  }
  const total = formatCents(metrics.todayRevenueCents ?? 0);
  if (metrics.todayCheckoutCount === 0) {
    return "No checkouts yet today · open reports";
  }
  if (metrics.todayCheckoutCount === 1) {
    return `1 checkout · ${total} today · open reports`;
  }
  return `${metrics.todayCheckoutCount} checkouts · ${total} today · open reports`;
}
