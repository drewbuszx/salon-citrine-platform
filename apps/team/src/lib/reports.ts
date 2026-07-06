import { formatCents, formatCategoryLabel, formatQuantity } from "@saloncitrine/shared";
import {
  formatReportRangeLabel,
  reportRangeFilenameSuffix,
  resolveReportRange,
  type ReportRange,
} from "./report-range";
import {
  mapProduct,
  PRODUCT_SELECT,
  type ProductRow,
} from "./api-inventory";

type SupabaseClient = App.Locals["supabase"];

export type { ReportRange };

/** Appointment statuses that represent work still on the books (not done/cancelled). */
const UPCOMING_STATUSES = new Set(["booked", "pending", "confirmed", "arrived"]);

export function parseReportRange(searchParams: URLSearchParams): ReportRange {
  return resolveReportRange(searchParams.get("from"), searchParams.get("to"));
}

export async function loadRevenueSummary(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const { data, error } = await supabase
    .from("checkout_orders")
    .select("total_cents, tip_cents, amount_paid_cents, completed_at")
    .eq("status", "completed")
    .gte("completed_at", range.startUtc)
    .lt("completed_at", range.endExclusiveUtc);

  if (error) throw error;

  const rows = data ?? [];
  let totalCents = 0;
  let tipCents = 0;
  const orderCount = rows.length;

  for (const row of rows) {
    totalCents += row.total_cents ?? 0;
    tipCents += row.tip_cents ?? 0;
  }

  const averageOrderCents =
    orderCount > 0 ? Math.round(totalCents / orderCount) : 0;

  return {
    orderCount,
    totalCents,
    tipCents,
    averageOrderCents,
    formattedTotal: formatCents(totalCents),
    formattedTips: formatCents(tipCents),
    formattedAverage: formatCents(averageOrderCents),
  };
}

export async function loadAppointmentsByStaff(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("staff_id, status, staff ( name )")
    .gte("starts_at", range.startUtc)
    .lt("starts_at", range.endExclusiveUtc);

  if (error) throw error;

  const byStaff = new Map<
    string,
    { staffName: string; total: number; completed: number; upcoming: number }
  >();

  for (const row of data ?? []) {
    const staffRaw = row.staff as { name: string } | { name: string }[] | null;
    const staffName =
      (Array.isArray(staffRaw) ? staffRaw[0]?.name : staffRaw?.name) ??
      "Unknown";
    const staffId = (row.staff_id as string) ?? staffName;
    const entry = byStaff.get(staffId) ?? {
      staffName,
      total: 0,
      completed: 0,
      upcoming: 0,
    };
    entry.total += 1;
    if (row.status === "completed") entry.completed += 1;
    if (UPCOMING_STATUSES.has(row.status as string)) entry.upcoming += 1;
    byStaff.set(staffId, entry);
  }

  return [...byStaff.values()].sort((a, b) => b.total - a.total);
}

/**
 * Appointment outcomes for the range. `cancellations` isolates the genuine
 * cancellation/no-show signal (with rates against everything scheduled), while
 * `status` is the full status breakdown for the separate "Appointment status"
 * panel — the two used to be conflated, which made "Total" count every
 * appointment instead of cancellations.
 */
export async function loadAppointmentOutcomes(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("status")
    .gte("starts_at", range.startUtc)
    .lt("starts_at", range.endExclusiveUtc);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const status = row.status as string;
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const scheduledTotal = data?.length ?? 0;
  const cancelled = counts.cancelled ?? 0;
  const noShow = counts.no_show ?? 0;
  const completed = counts.completed ?? 0;

  const pct = (n: number) =>
    scheduledTotal > 0 ? Math.round((n / scheduledTotal) * 1000) / 10 : 0;

  return {
    cancellations: {
      scheduledTotal,
      cancelled,
      noShow,
      completed,
      cancellationRate: pct(cancelled),
      noShowRate: pct(noShow),
    },
    status: {
      total: scheduledTotal,
      byStatus: Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count })),
    },
  };
}

export async function loadLowStockSummary(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;

  const products = (data as ProductRow[]).map(mapProduct);
  const lowStock = products.filter((p) => p.isLowStock);

  return {
    totalProducts: products.length,
    lowStockCount: lowStock.length,
    items: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? "Uncategorized",
      quantity: p.quantity,
      unit: p.unit,
      reorderThreshold: p.reorderThreshold,
    })),
  };
}

export async function loadAllReports(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const [revenue, appointmentsByStaff, outcomes, inventory] = await Promise.all(
    [
      loadRevenueSummary(supabase, range),
      loadAppointmentsByStaff(supabase, range),
      loadAppointmentOutcomes(supabase, range),
      loadLowStockSummary(supabase),
    ],
  );

  return {
    range: {
      fromDate: range.fromDate,
      toDate: range.toDate,
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      label: formatReportRangeLabel(range),
    },
    revenue,
    appointmentsByStaff,
    cancellations: outcomes.cancellations,
    appointmentStatus: outcomes.status,
    inventory,
  };
}

export type ReportsData = Awaited<ReturnType<typeof loadAllReports>>;

export function reportsCsvFilename(range: ReportRange): string {
  return `salon-citrine-reports_${reportRangeFilenameSuffix(range)}.csv`;
}

export function reportsToCsv(payload: ReportsData) {
  const lines: string[] = [];

  lines.push("Salon Citrine Team Reports");
  lines.push(`Period,${payload.range.fromDate},${payload.range.toDate}`);
  lines.push("");

  lines.push("Revenue Summary");
  lines.push("Metric,Value");
  lines.push(`Completed checkouts,${payload.revenue.orderCount}`);
  lines.push(`Total revenue,${payload.revenue.totalCents / 100}`);
  lines.push(`Tips,${payload.revenue.tipCents / 100}`);
  lines.push(`Average ticket,${payload.revenue.averageOrderCents / 100}`);
  lines.push("");

  lines.push("Appointments by staff");
  lines.push("Staff,Total,Completed,Upcoming");
  for (const row of payload.appointmentsByStaff) {
    lines.push(`"${row.staffName}",${row.total},${row.completed},${row.upcoming}`);
  }
  lines.push("");

  lines.push("Cancellations & no-shows");
  lines.push("Metric,Value");
  lines.push(`Total scheduled,${payload.cancellations.scheduledTotal}`);
  lines.push(`Cancelled,${payload.cancellations.cancelled}`);
  lines.push(`No-show,${payload.cancellations.noShow}`);
  lines.push(`Cancellation rate %,${payload.cancellations.cancellationRate}`);
  lines.push(`No-show rate %,${payload.cancellations.noShowRate}`);
  lines.push("");

  lines.push("Appointment status");
  lines.push("Status,Count");
  for (const row of payload.appointmentStatus.byStatus) {
    lines.push(`"${row.status.replace(/_/g, " ")}",${row.count}`);
  }
  lines.push("");

  lines.push("Low stock inventory");
  lines.push("Product,Category,On hand,Reorder at");
  for (const item of payload.inventory.items) {
    lines.push(
      `"${item.name}","${formatCategoryLabel(item.category)}","${formatQuantity(item.quantity, item.unit)}",${item.reorderThreshold}`,
    );
  }

  return lines.join("\n");
}
