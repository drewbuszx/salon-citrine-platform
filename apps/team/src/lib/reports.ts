import { formatCents } from "@saloncitrine/shared";
import {
  mapProduct,
  PRODUCT_SELECT,
  type ProductRow,
} from "./api-inventory";

type SupabaseClient = App.Locals["supabase"];

export type ReportRange = {
  from: string;
  to: string;
};

export function defaultReportRange(): ReportRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function parseReportRange(searchParams: URLSearchParams): ReportRange {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if (fromParam && toParam) {
    const from = new Date(`${fromParam}T00:00:00`);
    const to = new Date(`${toParam}T23:59:59.999`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return { from: from.toISOString(), to: to.toISOString() };
    }
  }
  return defaultReportRange();
}

export async function loadRevenueSummary(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const { data, error } = await supabase
    .from("checkout_orders")
    .select("total_cents, tip_cents, amount_paid_cents, completed_at")
    .eq("status", "completed")
    .gte("completed_at", range.from)
    .lte("completed_at", range.to);

  if (error) throw error;

  const rows = data ?? [];
  let totalCents = 0;
  let tipCents = 0;
  let orderCount = rows.length;

  for (const row of rows) {
    totalCents += row.total_cents ?? 0;
    tipCents += row.tip_cents ?? 0;
  }

  return {
    orderCount,
    totalCents,
    tipCents,
    averageOrderCents: orderCount > 0 ? Math.round(totalCents / orderCount) : 0,
    formattedTotal: formatCents(totalCents),
    formattedTips: formatCents(tipCents),
    formattedAverage: formatCents(
      orderCount > 0 ? Math.round(totalCents / orderCount) : 0,
    ),
  };
}

export async function loadAppointmentsByStaff(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("staff_id, status, staff ( name )")
    .gte("starts_at", range.from)
    .lte("starts_at", range.to);

  if (error) throw error;

  const byStaff = new Map<
    string,
    { staffName: string; total: number; completed: number; booked: number }
  >();

  for (const row of data ?? []) {
    const staffRaw = row.staff as { name: string } | { name: string }[] | null;
    const staffName = (
      Array.isArray(staffRaw) ? staffRaw[0]?.name : staffRaw?.name
    ) ?? "Unknown";
    const staffId = row.staff_id as string;
    const entry = byStaff.get(staffId) ?? {
      staffName,
      total: 0,
      completed: 0,
      booked: 0,
    };
    entry.total += 1;
    if (row.status === "completed") entry.completed += 1;
    if (["booked", "confirmed", "arrived", "completed"].includes(row.status)) {
      entry.booked += 1;
    }
    byStaff.set(staffId, entry);
  }

  return [...byStaff.values()].sort((a, b) => b.total - a.total);
}

export async function loadCancellationStats(
  supabase: SupabaseClient,
  range: ReportRange,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("status")
    .gte("starts_at", range.from)
    .lte("starts_at", range.to);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const status = row.status as string;
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const total = data?.length ?? 0;
  const cancelled = counts.cancelled ?? 0;
  const noShow = counts.no_show ?? 0;
  const completed = counts.completed ?? 0;

  return {
    total,
    cancelled,
    noShow,
    completed,
    cancellationRate:
      total > 0 ? Math.round(((cancelled + noShow) / total) * 1000) / 10 : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 1000) / 10 : 0,
    byStatus: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count })),
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
  const [revenue, appointmentsByStaff, cancellations, inventory] =
    await Promise.all([
      loadRevenueSummary(supabase, range),
      loadAppointmentsByStaff(supabase, range),
      loadCancellationStats(supabase, range),
      loadLowStockSummary(supabase),
    ]);

  return {
    range,
    revenue,
    appointmentsByStaff,
    cancellations,
    inventory,
  };
}

export function reportsToCsv(payload: Awaited<ReturnType<typeof loadAllReports>>) {
  const lines: string[] = [];

  lines.push("Salon Citrine Team Reports");
  lines.push(`Period,${payload.range.from},${payload.range.to}`);
  lines.push("");

  lines.push("Revenue Summary");
  lines.push("Metric,Value");
  lines.push(`Completed orders,${payload.revenue.orderCount}`);
  lines.push(`Total revenue,${payload.revenue.totalCents / 100}`);
  lines.push(`Tips,${payload.revenue.tipCents / 100}`);
  lines.push(`Average order,${payload.revenue.averageOrderCents / 100}`);
  lines.push("");

  lines.push("Appointments by staff");
  lines.push("Staff,Total,Completed,Active pipeline");
  for (const row of payload.appointmentsByStaff) {
    lines.push(
      `"${row.staffName}",${row.total},${row.completed},${row.booked}`,
    );
  }
  lines.push("");

  lines.push("Cancellation & no-show");
  lines.push("Metric,Count");
  lines.push(`Total appointments,${payload.cancellations.total}`);
  lines.push(`Cancelled,${payload.cancellations.cancelled}`);
  lines.push(`No-show,${payload.cancellations.noShow}`);
  lines.push(`Completed,${payload.cancellations.completed}`);
  lines.push("");

  lines.push("Low stock inventory");
  lines.push("Product,Category,On hand,Unit,Reorder at");
  for (const item of payload.inventory.items) {
    lines.push(
      `"${item.name}","${item.category}",${item.quantity},${item.unit},${item.reorderThreshold}`,
    );
  }

  return lines.join("\n");
}
