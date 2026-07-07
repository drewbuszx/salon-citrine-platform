/**
 * Centralized report metric + section definitions — the single source of truth
 * shared by the server loaders, the CSV export, and the browser UI.
 *
 * Whenever a metric is displayed, exported, or drilled into, its label,
 * help text, and formatting come from here so the three never drift apart.
 *
 * Pure module (only depends on the dependency-free `formatCents`) so it is safe
 * to bundle for the browser.
 */
import { formatCents } from "@saloncitrine/shared";

export type MetricFormat = "currency" | "number" | "percent" | "text";

export type MetricKey =
  | "netRevenue"
  | "grossTotal"
  | "serviceRevenue"
  | "productRevenue"
  | "tips"
  | "tax"
  | "discounts"
  | "completedCheckouts"
  | "averageTicket"
  | "scheduledAppointments"
  | "completedAppointments"
  | "upcomingAppointments"
  | "cancellations"
  | "noShows"
  | "cancellationRate"
  | "noShowRate"
  | "collectedFees"
  | "lowStock"
  | "reorderDeficit"
  | "rebookingRate"
  | "utilization";

export type MetricDef = {
  key: MetricKey;
  label: string;
  /** Short label for dense chips / trend selector. */
  short: string;
  format: MetricFormat;
  /** Plain-language definition surfaced as an accessible tooltip. */
  help: string;
};

export const METRICS: Record<MetricKey, MetricDef> = {
  netRevenue: {
    key: "netRevenue",
    label: "Net revenue",
    short: "Revenue",
    format: "currency",
    help: "Service and product sales from completed checkouts after discounts, before tax and tips.",
  },
  grossTotal: {
    key: "grossTotal",
    label: "Billed total",
    short: "Billed",
    format: "currency",
    help: "Total billed on completed checkouts, including tax and after discounts. Excludes tips.",
  },
  serviceRevenue: {
    key: "serviceRevenue",
    label: "Service revenue",
    short: "Services",
    format: "currency",
    help: "Completed-checkout line items classified as services.",
  },
  productRevenue: {
    key: "productRevenue",
    label: "Product revenue",
    short: "Products",
    format: "currency",
    help: "Completed-checkout line items classified as retail products.",
  },
  tips: {
    key: "tips",
    label: "Tips",
    short: "Tips",
    format: "currency",
    help: "Tips recorded on completed checkouts. Tracked separately from revenue.",
  },
  tax: {
    key: "tax",
    label: "Tax",
    short: "Tax",
    format: "currency",
    help: "Tax collected on completed checkouts.",
  },
  discounts: {
    key: "discounts",
    label: "Discounts",
    short: "Discounts",
    format: "currency",
    help: "Discounts applied on completed checkouts.",
  },
  completedCheckouts: {
    key: "completedCheckouts",
    label: "Completed checkouts",
    short: "Checkouts",
    format: "number",
    help: "Checkout orders marked complete within this date range.",
  },
  averageTicket: {
    key: "averageTicket",
    label: "Average ticket",
    short: "Avg ticket",
    format: "currency",
    help: "Net revenue divided by the number of completed checkouts in range.",
  },
  scheduledAppointments: {
    key: "scheduledAppointments",
    label: "Scheduled appointments",
    short: "Scheduled",
    format: "number",
    help: "Every appointment that starts within this range, regardless of status.",
  },
  completedAppointments: {
    key: "completedAppointments",
    label: "Completed appointments",
    short: "Completed",
    format: "number",
    help: "Appointments marked completed within this range.",
  },
  upcomingAppointments: {
    key: "upcomingAppointments",
    label: "Upcoming",
    short: "Upcoming",
    format: "number",
    help: "Booked, pending, confirmed, or arrived — on the books but not yet completed or cancelled.",
  },
  cancellations: {
    key: "cancellations",
    label: "Cancellations",
    short: "Cancelled",
    format: "number",
    help: "Appointments in range with a cancelled status. Confirmed appointments are never counted here.",
  },
  noShows: {
    key: "noShows",
    label: "No-shows",
    short: "No-shows",
    format: "number",
    help: "Appointments in range marked no-show.",
  },
  cancellationRate: {
    key: "cancellationRate",
    label: "Cancellation rate",
    short: "Cancel %",
    format: "percent",
    help: "Cancelled appointments as a share of everything scheduled in range.",
  },
  noShowRate: {
    key: "noShowRate",
    label: "No-show rate",
    short: "No-show %",
    format: "percent",
    help: "No-show appointments as a share of everything scheduled in range.",
  },
  collectedFees: {
    key: "collectedFees",
    label: "Collected fees",
    short: "Fees",
    format: "currency",
    help: "Cancellation / no-show fees captured on affected appointments.",
  },
  lowStock: {
    key: "lowStock",
    label: "Low-stock products",
    short: "Low stock",
    format: "number",
    help: "Active products at or below their reorder point right now. Inventory is a live snapshot, not date-filtered.",
  },
  reorderDeficit: {
    key: "reorderDeficit",
    label: "Reorder deficit",
    short: "Deficit",
    format: "number",
    help: "How far below the reorder point a product is (reorder point minus quantity on hand).",
  },
  rebookingRate: {
    key: "rebookingRate",
    label: "Rebooking rate",
    short: "Rebooking",
    format: "percent",
    help: "Not reported yet — requires linking each completed visit to a future booking.",
  },
  utilization: {
    key: "utilization",
    label: "Utilization",
    short: "Utilization",
    format: "percent",
    help: "Not reported yet — requires published staff working hours for the range.",
  },
};

export function formatMetric(format: MetricFormat, value: number): string {
  switch (format) {
    case "currency":
      return formatCents(Math.round(value));
    case "percent":
      return `${Math.round(value * 10) / 10}%`;
    case "number":
      return new Intl.NumberFormat("en-US").format(value);
    case "text":
    default:
      return String(value);
  }
}

// --- Report navigation taxonomy ---------------------------------------------

export type ReportSectionId =
  | "reports-overview"
  | "reports-revenue"
  | "reports-appointments"
  | "reports-status"
  | "reports-cancellations"
  | "reports-inventory";

export type ExportKey =
  | "overview"
  | "revenue"
  | "appointments"
  | "cancellations"
  | "status"
  | "inventory"
  | "all";

export type ReportSection = {
  id: ReportSectionId;
  label: string;
  short: string;
  group: string;
  exportKey: ExportKey;
};

/**
 * Only sections backed by real data are listed — no empty destinations.
 * Group headings give the nav a clear taxonomy without inventing pages.
 */
export const REPORT_SECTIONS: ReportSection[] = [
  { id: "reports-overview", label: "Overview", short: "Overview", group: "Business", exportKey: "overview" },
  { id: "reports-revenue", label: "Revenue", short: "Revenue", group: "Business", exportKey: "revenue" },
  { id: "reports-appointments", label: "Appointments by staff", short: "Staff", group: "Appointments", exportKey: "appointments" },
  { id: "reports-status", label: "Appointment status", short: "Status", group: "Appointments", exportKey: "status" },
  { id: "reports-cancellations", label: "Cancellations & no-shows", short: "Cancels", group: "Appointments", exportKey: "cancellations" },
  { id: "reports-inventory", label: "Low stock", short: "Stock", group: "Inventory", exportKey: "inventory" },
];

export type ReportNavGroup = {
  group: string;
  sections: ReportSection[];
};

export function reportNavGroups(): ReportNavGroup[] {
  const groups: ReportNavGroup[] = [];
  for (const section of REPORT_SECTIONS) {
    let group = groups.find((g) => g.group === section.group);
    if (!group) {
      group = { group: section.group, sections: [] };
      groups.push(group);
    }
    group.sections.push(section);
  }
  return groups;
}
