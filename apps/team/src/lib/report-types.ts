/**
 * Shared report payload types.
 *
 * Kept as a pure, runtime-free module so it is safe to import from both the
 * server loaders (`lib/reports.ts`, the API route) and the browser bundle
 * (`scripts/reports.ts`) without pulling any server-only code into the client.
 */

export type ReportGrouping = "day" | "week" | "month";

export type ReportRangeMeta = {
  fromDate: string;
  toDate: string;
  startUtc: string;
  endExclusiveUtc: string;
  label: string;
  /** Inclusive number of calendar days in the range. */
  days: number;
};

/**
 * Revenue is derived entirely from completed `checkout_orders` (and their line
 * items). Every field maps to a real column so the displayed number, the CSV
 * export, and the drill-down agree.
 */
export type RevenueSummary = {
  /** Completed checkout orders in range. */
  orderCount: number;
  /** subtotal - discount, summed. Service + product sales after discounts, before tax and tips. */
  netRevenueCents: number;
  /** total_cents summed. What was billed including tax, after discounts. */
  grossTotalCents: number;
  /** Line-item revenue where kind = 'service'. */
  serviceRevenueCents: number;
  /** Line-item revenue where kind = 'product'. */
  productRevenueCents: number;
  tipCents: number;
  taxCents: number;
  discountCents: number;
  /** netRevenueCents / orderCount (0 when no orders). */
  averageTicketCents: number;
};

export type AppointmentCounts = {
  /** Every appointment whose start falls in range, any status. */
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  /** booked / pending / confirmed / arrived — on the books, not yet resolved. */
  upcoming: number;
};

export type StaffReportRow = {
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
  averageTicketCents: number;
};

export type CancellationSummary = {
  scheduledTotal: number;
  cancelled: number;
  noShow: number;
  completed: number;
  cancellationRate: number;
  noShowRate: number;
  /** Sum of cancel_fee_cents captured on cancelled / no-show appointments. */
  collectedFeeCents: number;
};

export type AppointmentStatusSummary = {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
};

export type InventorySeverity =
  | "out-of-stock"
  | "critical"
  | "low"
  | "at-reorder";

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  /** Product brand — the closest supported "supplier" field. */
  brand: string | null;
  quantity: number;
  unit: string;
  reorderThreshold: number;
  /** max(reorderThreshold - quantity, 0). */
  deficit: number;
  severity: InventorySeverity;
  /** inventory_stock.updated_at ISO string, when available. */
  lastUpdated: string | null;
  retailPriceCents: number | null;
};

export type InventorySummary = {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  criticalCount: number;
  items: InventoryItem[];
};

export type TrendPoint = {
  key: string;
  label: string;
  revenueCents: number;
  completedCheckouts: number;
  scheduledAppts: number;
  completedAppts: number;
  cancellations: number;
  averageTicketCents: number;
};

export type TrendData = {
  grouping: ReportGrouping;
  points: TrendPoint[];
};

export type ComparisonSummary = {
  range: { fromDate: string; toDate: string; label: string };
  revenue: RevenueSummary;
  appointments: AppointmentCounts;
} | null;

export type ReportsPayload = {
  range: ReportRangeMeta;
  revenue: RevenueSummary;
  appointments: AppointmentCounts;
  appointmentsByStaff: StaffReportRow[];
  cancellations: CancellationSummary;
  appointmentStatus: AppointmentStatusSummary;
  inventory: InventorySummary;
  trend: TrendData;
  comparison: ComparisonSummary;
};

// --- Drill-down detail ------------------------------------------------------

export type DetailColumn = {
  key: string;
  label: string;
  numeric?: boolean;
};

export type DetailRow = Record<string, string | number>;

export type ReportDetail = {
  kind: string;
  title: string;
  description: string;
  columns: DetailColumn[];
  rows: DetailRow[];
};
