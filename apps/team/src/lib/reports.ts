import { formatCents, formatCategoryLabel, formatQuantity } from "@saloncitrine/shared";
import {
  addDays,
  dayOfWeek,
  formatReportRangeLabel,
  reportRangeFilenameSuffix,
  resolveReportRange,
  salonLocalDate,
  SALON_TIME_ZONE,
  type ReportRange,
} from "./report-range";
import { formatMetric, METRICS } from "./report-metrics";
import type {
  AppointmentCounts,
  AppointmentStatusSummary,
  CancellationSummary,
  ComparisonSummary,
  InventoryItem,
  InventorySummary,
  InventorySeverity,
  ReportDetail,
  ReportGrouping,
  ReportsPayload,
  RevenueSummary,
  StaffReportRow,
  TrendData,
  TrendPoint,
} from "./report-types";

type SupabaseClient = App.Locals["supabase"];

export type { ReportRange };
export type {
  ReportsPayload,
  RevenueSummary,
  StaffReportRow,
  CancellationSummary,
  AppointmentStatusSummary,
  InventorySummary,
  ReportDetail,
} from "./report-types";

/** Appointment statuses that represent work still on the books (not done/cancelled). */
const UPCOMING_STATUSES = new Set(["booked", "pending", "confirmed", "arrived"]);

const DETAIL_ROW_CAP = 500;

export function parseReportRange(searchParams: URLSearchParams): ReportRange {
  return resolveReportRange(searchParams.get("from"), searchParams.get("to"));
}

/** Inclusive number of calendar days between the two range dates. */
function rangeDays(range: ReportRange): number {
  const from = new Date(`${range.fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${range.toDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000) + 1;
}

function firstName(
  raw: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null,
): string {
  const rec = Array.isArray(raw) ? raw[0] : raw;
  if (!rec) return "Unknown client";
  return `${rec.first_name ?? ""} ${rec.last_name ?? ""}`.trim() || "Unknown client";
}

function staffNameOf(raw: { name?: string } | { name?: string }[] | null): string {
  const rec = Array.isArray(raw) ? raw[0] : raw;
  return rec?.name ?? "Unknown";
}

// --- Raw fetch (each source table queried once) -----------------------------

type OrderRow = {
  id: string;
  staff_id: string | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
  completed_at: string | null;
};

type LineItemRow = {
  order_id: string;
  kind: string;
  total_cents: number | null;
};

type AppointmentRow = {
  id: string;
  staff_id: string | null;
  status: string;
  starts_at: string;
  cancel_fee_cents: number | null;
  staff: { name?: string } | { name?: string }[] | null;
};

async function fetchOrders(supabase: SupabaseClient, range: ReportRange): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("checkout_orders")
    .select(
      "id, staff_id, subtotal_cents, discount_cents, tax_cents, tip_cents, total_cents, completed_at",
    )
    .eq("status", "completed")
    .gte("completed_at", range.startUtc)
    .lt("completed_at", range.endExclusiveUtc);
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function fetchLineItems(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<LineItemRow[]> {
  if (orderIds.length === 0) return [];
  const { data, error } = await supabase
    .from("checkout_line_items")
    .select("order_id, kind, total_cents")
    .in("order_id", orderIds);
  if (error) throw error;
  return (data ?? []) as LineItemRow[];
}

async function fetchAppointments(
  supabase: SupabaseClient,
  range: ReportRange,
): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, staff_id, status, starts_at, cancel_fee_cents, staff ( name )")
    .gte("starts_at", range.startUtc)
    .lt("starts_at", range.endExclusiveUtc);
  if (error) throw error;
  return (data ?? []) as AppointmentRow[];
}

// --- Derivations ------------------------------------------------------------

function deriveRevenue(orders: OrderRow[], lineItems: LineItemRow[]): RevenueSummary {
  let netRevenueCents = 0;
  let grossTotalCents = 0;
  let tipCents = 0;
  let taxCents = 0;
  let discountCents = 0;

  for (const o of orders) {
    const subtotal = o.subtotal_cents ?? 0;
    const discount = o.discount_cents ?? 0;
    netRevenueCents += subtotal - discount;
    grossTotalCents += o.total_cents ?? 0;
    tipCents += o.tip_cents ?? 0;
    taxCents += o.tax_cents ?? 0;
    discountCents += discount;
  }

  let serviceRevenueCents = 0;
  let productRevenueCents = 0;
  for (const li of lineItems) {
    if (li.kind === "service") serviceRevenueCents += li.total_cents ?? 0;
    else if (li.kind === "product") productRevenueCents += li.total_cents ?? 0;
  }

  const orderCount = orders.length;
  const averageTicketCents = orderCount > 0 ? Math.round(netRevenueCents / orderCount) : 0;

  return {
    orderCount,
    netRevenueCents,
    grossTotalCents,
    serviceRevenueCents,
    productRevenueCents,
    tipCents,
    taxCents,
    discountCents,
    averageTicketCents,
  };
}

function deriveAppointmentCounts(appts: AppointmentRow[]): AppointmentCounts {
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let upcoming = 0;
  for (const a of appts) {
    if (a.status === "completed") completed += 1;
    else if (a.status === "cancelled") cancelled += 1;
    else if (a.status === "no_show") noShow += 1;
    if (UPCOMING_STATUSES.has(a.status)) upcoming += 1;
  }
  return { scheduled: appts.length, completed, cancelled, noShow, upcoming };
}

function deriveStatus(appts: AppointmentRow[]): AppointmentStatusSummary {
  const counts: Record<string, number> = {};
  for (const a of appts) counts[a.status] = (counts[a.status] ?? 0) + 1;
  return {
    total: appts.length,
    byStatus: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count })),
  };
}

function deriveCancellations(appts: AppointmentRow[]): CancellationSummary {
  const counts = deriveAppointmentCounts(appts);
  const scheduledTotal = counts.scheduled;
  let collectedFeeCents = 0;
  for (const a of appts) {
    if (a.status === "cancelled" || a.status === "no_show") {
      collectedFeeCents += a.cancel_fee_cents ?? 0;
    }
  }
  const pct = (n: number) =>
    scheduledTotal > 0 ? Math.round((n / scheduledTotal) * 1000) / 10 : 0;
  return {
    scheduledTotal,
    cancelled: counts.cancelled,
    noShow: counts.noShow,
    completed: counts.completed,
    cancellationRate: pct(counts.cancelled),
    noShowRate: pct(counts.noShow),
    collectedFeeCents,
  };
}

function deriveStaffRows(
  appts: AppointmentRow[],
  orders: OrderRow[],
  lineItems: LineItemRow[],
): StaffReportRow[] {
  type Acc = {
    staffId: string;
    staffName: string;
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
    orderCount: number;
    serviceRevenueCents: number;
    productRevenueCents: number;
    tipCents: number;
    netRevenueCents: number;
  };
  const map = new Map<string, Acc>();

  const ensure = (id: string, name: string): Acc => {
    let acc = map.get(id);
    if (!acc) {
      acc = {
        staffId: id,
        staffName: name,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        upcoming: 0,
        orderCount: 0,
        serviceRevenueCents: 0,
        productRevenueCents: 0,
        tipCents: 0,
        netRevenueCents: 0,
      };
      map.set(id, acc);
    }
    // Prefer a real name if a later row provides one.
    if (acc.staffName === "Unknown" && name !== "Unknown") acc.staffName = name;
    return acc;
  };

  for (const a of appts) {
    const name = staffNameOf(a.staff);
    const id = a.staff_id ?? name;
    const acc = ensure(id, name);
    acc.scheduled += 1;
    if (a.status === "completed") acc.completed += 1;
    else if (a.status === "cancelled") acc.cancelled += 1;
    else if (a.status === "no_show") acc.noShow += 1;
    if (UPCOMING_STATUSES.has(a.status)) acc.upcoming += 1;
  }

  const orderStaff = new Map<string, string>();
  for (const o of orders) {
    const id = o.staff_id;
    if (!id) continue;
    orderStaff.set(o.id, id);
    const acc = ensure(id, "Unknown");
    acc.orderCount += 1;
    acc.netRevenueCents += (o.subtotal_cents ?? 0) - (o.discount_cents ?? 0);
    acc.tipCents += o.tip_cents ?? 0;
  }

  for (const li of lineItems) {
    const staffId = orderStaff.get(li.order_id);
    if (!staffId) continue;
    const acc = map.get(staffId);
    if (!acc) continue;
    if (li.kind === "service") acc.serviceRevenueCents += li.total_cents ?? 0;
    else if (li.kind === "product") acc.productRevenueCents += li.total_cents ?? 0;
  }

  return [...map.values()]
    .map((acc) => ({
      ...acc,
      averageTicketCents:
        acc.orderCount > 0 ? Math.round(acc.netRevenueCents / acc.orderCount) : 0,
    }))
    .sort((a, b) => b.scheduled - a.scheduled || b.netRevenueCents - a.netRevenueCents);
}

// --- Trend ------------------------------------------------------------------

function chooseGrouping(days: number): ReportGrouping {
  if (days <= 31) return "day";
  if (days <= 182) return "week";
  return "month";
}

function salonDateOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return salonLocalDate(d);
}

function mondayOf(localDate: string): string {
  const offset = (dayOfWeek(localDate) + 6) % 7;
  return addDays(localDate, -offset);
}

function bucketKey(localDate: string, grouping: ReportGrouping): string {
  if (grouping === "day") return localDate;
  if (grouping === "week") return mondayOf(localDate);
  return localDate.slice(0, 7);
}

function bucketLabel(key: string, grouping: ReportGrouping): string {
  if (grouping === "month") {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1, 12));
    return new Intl.DateTimeFormat("en-US", {
      timeZone: SALON_TIME_ZONE,
      month: "short",
      year: "numeric",
    }).format(d);
  }
  const d = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(d);
}

function enumerateBuckets(range: ReportRange, grouping: ReportGrouping): string[] {
  const keys: string[] = [];
  if (grouping === "day") {
    let cur = range.fromDate;
    while (cur <= range.toDate) {
      keys.push(cur);
      cur = addDays(cur, 1);
    }
  } else if (grouping === "week") {
    let cur = mondayOf(range.fromDate);
    while (cur <= range.toDate) {
      keys.push(cur);
      cur = addDays(cur, 7);
    }
  } else {
    let [y, m] = range.fromDate.slice(0, 7).split("-").map(Number);
    const endKey = range.toDate.slice(0, 7);
    let key = `${y}-${String(m).padStart(2, "0")}`;
    while (key <= endKey) {
      keys.push(key);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      key = `${y}-${String(m).padStart(2, "0")}`;
    }
  }
  return keys;
}

function deriveTrend(
  range: ReportRange,
  orders: OrderRow[],
  appts: AppointmentRow[],
): TrendData {
  const grouping = chooseGrouping(rangeDays(range));
  const keys = enumerateBuckets(range, grouping);
  const points = new Map<string, TrendPoint>();
  for (const key of keys) {
    points.set(key, {
      key,
      label: bucketLabel(key, grouping),
      revenueCents: 0,
      completedCheckouts: 0,
      scheduledAppts: 0,
      completedAppts: 0,
      cancellations: 0,
      averageTicketCents: 0,
    });
  }

  for (const o of orders) {
    const local = salonDateOf(o.completed_at);
    if (!local) continue;
    const pt = points.get(bucketKey(local, grouping));
    if (!pt) continue;
    pt.revenueCents += (o.subtotal_cents ?? 0) - (o.discount_cents ?? 0);
    pt.completedCheckouts += 1;
  }

  for (const a of appts) {
    const local = salonDateOf(a.starts_at);
    if (!local) continue;
    const pt = points.get(bucketKey(local, grouping));
    if (!pt) continue;
    pt.scheduledAppts += 1;
    if (a.status === "completed") pt.completedAppts += 1;
    else if (a.status === "cancelled") pt.cancellations += 1;
  }

  for (const pt of points.values()) {
    pt.averageTicketCents =
      pt.completedCheckouts > 0 ? Math.round(pt.revenueCents / pt.completedCheckouts) : 0;
  }

  return { grouping, points: keys.map((k) => points.get(k)!) };
}

// --- Inventory --------------------------------------------------------------

type InventoryProductRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  reorder_threshold: number | string | null;
  retail_price_cents: number | null;
  inventory_stock:
    | { quantity: number; updated_at: string | null }
    | { quantity: number; updated_at: string | null }[]
    | null;
};

function severityFor(quantity: number, threshold: number): InventorySeverity {
  if (quantity <= 0) return "out-of-stock";
  if (threshold > 0 && quantity <= threshold / 2) return "critical";
  if (threshold > 0 && quantity < threshold) return "low";
  return "at-reorder";
}

export async function loadInventorySummary(
  supabase: SupabaseClient,
): Promise<InventorySummary> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, category, unit, reorder_threshold, retail_price_cents, inventory_stock ( quantity, updated_at )",
    )
    .eq("is_active", true)
    .order("name");
  if (error) throw error;

  const rows = (data ?? []) as InventoryProductRow[];
  const items: InventoryItem[] = [];
  let outOfStockCount = 0;
  let criticalCount = 0;

  for (const row of rows) {
    const stock = Array.isArray(row.inventory_stock)
      ? row.inventory_stock[0]
      : row.inventory_stock;
    const quantity = Number(stock?.quantity ?? 0);
    const reorderThreshold = Number(row.reorder_threshold ?? 0);
    const isLow = reorderThreshold > 0 && quantity <= reorderThreshold;
    if (!isLow) continue;

    const severity = severityFor(quantity, reorderThreshold);
    if (severity === "out-of-stock") outOfStockCount += 1;
    if (severity === "critical") criticalCount += 1;

    items.push({
      id: row.id,
      name: row.name,
      category: row.category ?? "Uncategorized",
      brand: row.brand,
      quantity,
      unit: row.unit,
      reorderThreshold,
      deficit: Math.max(reorderThreshold - quantity, 0),
      severity,
      lastUpdated: stock?.updated_at ?? null,
      retailPriceCents: row.retail_price_cents,
    });
  }

  const severityRank: Record<InventorySeverity, number> = {
    "out-of-stock": 0,
    critical: 1,
    low: 2,
    "at-reorder": 3,
  };
  items.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || b.deficit - a.deficit,
  );

  return {
    totalProducts: rows.length,
    lowStockCount: items.length,
    outOfStockCount,
    criticalCount,
    items,
  };
}

// --- Orchestration ----------------------------------------------------------

async function loadRangeCore(supabase: SupabaseClient, range: ReportRange) {
  const [orders, appts] = await Promise.all([
    fetchOrders(supabase, range),
    fetchAppointments(supabase, range),
  ]);
  const lineItems = await fetchLineItems(supabase, orders.map((o) => o.id));
  return { orders, appts, lineItems };
}

/** Lightweight summary (revenue + appointment counts) for comparison ranges. */
export async function loadComparisonSummary(
  supabase: SupabaseClient,
  range: ReportRange,
): Promise<ComparisonSummary> {
  const { orders, appts, lineItems } = await loadRangeCore(supabase, range);
  return {
    range: {
      fromDate: range.fromDate,
      toDate: range.toDate,
      label: formatReportRangeLabel(range),
    },
    revenue: deriveRevenue(orders, lineItems),
    appointments: deriveAppointmentCounts(appts),
  };
}

export async function loadAllReports(
  supabase: SupabaseClient,
  range: ReportRange,
  compareRange?: ReportRange | null,
): Promise<ReportsPayload> {
  const [{ orders, appts, lineItems }, inventory, comparison] = await Promise.all([
    loadRangeCore(supabase, range),
    loadInventorySummary(supabase),
    compareRange ? loadComparisonSummary(supabase, compareRange) : Promise.resolve(null),
  ]);

  return {
    range: {
      fromDate: range.fromDate,
      toDate: range.toDate,
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      label: formatReportRangeLabel(range),
      days: rangeDays(range),
    },
    revenue: deriveRevenue(orders, lineItems),
    appointments: deriveAppointmentCounts(appts),
    appointmentsByStaff: deriveStaffRows(appts, orders, lineItems),
    cancellations: deriveCancellations(appts),
    appointmentStatus: deriveStatus(appts),
    inventory,
    trend: deriveTrend(range, orders, appts),
    comparison,
  };
}

// --- Drill-down detail ------------------------------------------------------

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function salonDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export async function loadReportDetail(
  supabase: SupabaseClient,
  range: ReportRange,
  params: { kind: string; status?: string | null; staffId?: string | null },
): Promise<ReportDetail> {
  const kind = params.kind;

  if (kind === "revenue" || kind === "ledger") {
    const { data, error } = await supabase
      .from("checkout_orders")
      .select(
        "id, subtotal_cents, discount_cents, tip_cents, total_cents, completed_at, staff ( name ), client:clients ( first_name, last_name )",
      )
      .eq("status", "completed")
      .gte("completed_at", range.startUtc)
      .lt("completed_at", range.endExclusiveUtc)
      .order("completed_at", { ascending: false })
      .limit(DETAIL_ROW_CAP);
    if (error) throw error;
    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      when: salonDateTimeLabel(r.completed_at as string),
      client: firstName(r.client as never),
      staff: staffNameOf(r.staff as never),
      net: formatCents(((r.subtotal_cents as number) ?? 0) - ((r.discount_cents as number) ?? 0)),
      tips: formatCents((r.tip_cents as number) ?? 0),
      billed: formatCents((r.total_cents as number) ?? 0),
    }));
    return {
      kind,
      title: "Completed checkouts",
      description: "Transactions included in the revenue totals for this range.",
      columns: [
        { key: "when", label: "Completed" },
        { key: "client", label: "Client" },
        { key: "staff", label: "Staff" },
        { key: "net", label: "Net", numeric: true },
        { key: "tips", label: "Tips", numeric: true },
        { key: "billed", label: "Billed", numeric: true },
      ],
      rows,
    };
  }

  // Appointment-based drill-downs.
  let query = supabase
    .from("appointments")
    .select(
      "id, status, starts_at, cancel_fee_cents, staff ( name ), client:clients ( first_name, last_name )",
    )
    .gte("starts_at", range.startUtc)
    .lt("starts_at", range.endExclusiveUtc)
    .order("starts_at", { ascending: false })
    .limit(DETAIL_ROW_CAP);

  let title = "Appointments";
  let description = "Appointments included in this range.";

  if (kind === "cancellations") {
    query = query.in("status", ["cancelled", "no_show"]);
    title = "Cancellations & no-shows";
    description = "Cancelled and no-show appointments behind the cancellation totals.";
  } else if (kind === "status" && params.status) {
    query = query.eq("status", params.status);
    title = `${statusLabel(params.status)} appointments`;
    description = `Appointments with a ${statusLabel(params.status).toLowerCase()} status in this range.`;
  } else if ((kind === "staff" || kind === "appointments") && params.staffId) {
    query = query.eq("staff_id", params.staffId);
    title = "Staff appointments";
    description = "Appointments for the selected staff member in this range.";
  }

  const { data, error } = await query;
  if (error) throw error;

  const includeFee = kind === "cancellations";
  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const base: Record<string, string | number> = {
      when: salonDateTimeLabel(r.starts_at as string),
      client: firstName(r.client as never),
      staff: staffNameOf(r.staff as never),
      status: statusLabel(r.status as string),
    };
    if (includeFee) base.fee = formatCents((r.cancel_fee_cents as number) ?? 0);
    return base;
  });

  const columns = [
    { key: "when", label: "When" },
    { key: "client", label: "Client" },
    { key: "staff", label: "Staff" },
    { key: "status", label: "Status" },
    ...(includeFee ? [{ key: "fee", label: "Fee", numeric: true }] : []),
  ];

  return { kind, title, description, columns, rows };
}

// --- CSV export -------------------------------------------------------------

export function reportsCsvFilename(range: ReportRange): string {
  return `salon-citrine-reports-${range.fromDate}-to-${range.toDate}.csv`;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function reportsToCsv(payload: ReportsPayload): string {
  const lines: string[] = [];
  lines.push("Salon Citrine Team Reports");
  lines.push(`Period,${payload.range.fromDate},${payload.range.toDate}`);
  lines.push("");

  lines.push("Revenue Summary");
  lines.push("Metric,Value");
  lines.push(`${METRICS.completedCheckouts.label},${payload.revenue.orderCount}`);
  lines.push(`${METRICS.netRevenue.label},${payload.revenue.netRevenueCents / 100}`);
  lines.push(`${METRICS.serviceRevenue.label},${payload.revenue.serviceRevenueCents / 100}`);
  lines.push(`${METRICS.productRevenue.label},${payload.revenue.productRevenueCents / 100}`);
  lines.push(`${METRICS.tips.label},${payload.revenue.tipCents / 100}`);
  lines.push(`${METRICS.tax.label},${payload.revenue.taxCents / 100}`);
  lines.push(`${METRICS.discounts.label},${payload.revenue.discountCents / 100}`);
  lines.push(`${METRICS.averageTicket.label},${payload.revenue.averageTicketCents / 100}`);
  lines.push("");

  lines.push("Appointments by staff");
  lines.push("Staff,Scheduled,Completed,Cancelled,No-show,Upcoming,Service revenue,Product revenue,Tips,Average ticket");
  for (const row of payload.appointmentsByStaff) {
    lines.push(
      [
        csvCell(row.staffName),
        row.scheduled,
        row.completed,
        row.cancelled,
        row.noShow,
        row.upcoming,
        row.serviceRevenueCents / 100,
        row.productRevenueCents / 100,
        row.tipCents / 100,
        row.averageTicketCents / 100,
      ].join(","),
    );
  }
  lines.push("");

  lines.push("Cancellations & no-shows");
  lines.push("Metric,Value");
  lines.push(`Total scheduled,${payload.cancellations.scheduledTotal}`);
  lines.push(`Cancelled,${payload.cancellations.cancelled}`);
  lines.push(`No-show,${payload.cancellations.noShow}`);
  lines.push(`Cancellation rate %,${payload.cancellations.cancellationRate}`);
  lines.push(`No-show rate %,${payload.cancellations.noShowRate}`);
  lines.push(`Collected fees,${payload.cancellations.collectedFeeCents / 100}`);
  lines.push("");

  lines.push("Appointment status");
  lines.push("Status,Count");
  for (const row of payload.appointmentStatus.byStatus) {
    lines.push(`${csvCell(statusLabel(row.status))},${row.count}`);
  }
  lines.push("");

  lines.push("Low stock inventory");
  lines.push("Product,Category,Supplier,On hand,Reorder at,Deficit,Status");
  for (const item of payload.inventory.items) {
    lines.push(
      [
        csvCell(item.name),
        csvCell(formatCategoryLabel(item.category)),
        csvCell(item.brand ?? ""),
        csvCell(formatQuantity(item.quantity, item.unit)),
        item.reorderThreshold,
        item.deficit,
        csvCell(item.severity),
      ].join(","),
    );
  }

  return lines.join("\n");
}

export type ReportsData = ReportsPayload;

// Re-export so callers that used the old helper name keep working.
export { formatMetric };
