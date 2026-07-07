import { formatCategoryLabel, formatQuantity } from "@saloncitrine/shared";
import {
  addDays,
  dayOfWeek,
  formatReportRangeLabel,
  lastDayOfMonth,
  salonLocalDate,
  SALON_TIME_ZONE,
} from "../lib/report-range";
import {
  formatMetric,
  METRICS,
  type ExportKey,
  type MetricKey,
  type ReportSectionId,
} from "../lib/report-metrics";
import type {
  AppointmentStatusSummary,
  CancellationSummary,
  InventoryItem,
  InventorySummary,
  ReportDetail,
  ReportsPayload,
  RevenueSummary,
  StaffReportRow,
  TrendData,
} from "../lib/report-types";
import { showToast } from "../lib/toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PresetValue =
  | "today"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "ytd"
  | "custom";

type CompareMode = "none" | "previous" | "previous-month" | "last-year";

type TrendMetric =
  | "revenue"
  | "completedCheckouts"
  | "scheduledAppts"
  | "averageTicket"
  | "cancellations";

type StateKind =
  | "loading"
  | "empty"
  | "not-configured"
  | "error"
  | "permission";

const EXPORT_LABELS: Record<ExportKey, string> = {
  overview: "Overview",
  revenue: "Revenue",
  appointments: "Appointments by staff",
  cancellations: "Cancellations & no-shows",
  status: "Appointment status",
  inventory: "Low stock",
  all: "Full report",
};

const TREND_OPTIONS: Array<{ value: TrendMetric; label: string }> = [
  { value: "revenue", label: METRICS.netRevenue.short },
  { value: "completedCheckouts", label: METRICS.completedCheckouts.short },
  { value: "scheduledAppts", label: METRICS.scheduledAppointments.short },
  { value: "averageTicket", label: METRICS.averageTicket.short },
  { value: "cancellations", label: METRICS.cancellations.short },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function info(def: { help: string }) {
  return `<span class="reports-info" role="img" tabindex="0" aria-label="${escapeHtml(def.help)}" title="${escapeHtml(def.help)}">i</span>`;
}

function computePresetRange(
  preset: PresetValue,
  today: string,
): { from: string; to: string } | null {
  const [y, m] = today.split("-").map(Number);
  const mondayOffset = (dayOfWeek(today) + 6) % 7;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this-week":
      return { from: addDays(today, -mondayOffset), to: today };
    case "last-week": {
      const thisMonday = addDays(today, -mondayOffset);
      return { from: addDays(thisMonday, -7), to: addDays(thisMonday, -1) };
    }
    case "this-month":
      return { from: `${y}-${pad2(m)}-01`, to: today };
    case "last-month": {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      const last = lastDayOfMonth(ly, lm);
      return { from: `${ly}-${pad2(lm)}-01`, to: `${ly}-${pad2(lm)}-${pad2(last)}` };
    }
    case "ytd":
      return { from: `${y}-01-01`, to: today };
    case "custom":
      return null;
  }
}

function detectPreset(from: string, to: string, today: string): PresetValue {
  for (const preset of [
    "today",
    "this-week",
    "last-week",
    "this-month",
    "last-month",
    "ytd",
  ] as PresetValue[]) {
    const range = computePresetRange(preset, today);
    if (range && range.from === from && range.to === to) return preset;
  }
  return "custom";
}

function stateMarkup(kind: StateKind, title: string, hint?: string) {
  if (kind === "loading") {
    return `<div class="reports-state ui-empty ui-empty--compact" aria-busy="true"><p class="ui-empty__title">${escapeHtml(title)}</p></div>`;
  }
  const errorClass = kind === "error" || kind === "permission" ? " ui-empty--error" : "";
  return `<div class="reports-state ui-empty ui-empty--compact${errorClass}">
    <p class="ui-empty__title">${escapeHtml(title)}</p>
    ${hint ? `<p class="ui-empty__hint">${escapeHtml(hint)}</p>` : ""}
  </div>`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function severityLabel(severity: InventoryItem["severity"]) {
  switch (severity) {
    case "out-of-stock":
      return "Out of stock";
    case "critical":
      return "Critical";
    case "low":
      return "Low";
    default:
      return "At reorder point";
  }
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

// --- Comparison -------------------------------------------------------------

function comparisonLine(
  current: number,
  previous: number | undefined,
  format: "currency" | "number",
  unitLabel: string,
): string {
  if (previous === undefined) return "";
  const delta = current - previous;
  if (delta === 0) return `<span class="reports-kpi__cmp reports-kpi__cmp--flat">Same as comparison</span>`;
  const dir = delta > 0 ? "up" : "down";
  const arrow = delta > 0 ? "↑" : "↓";
  if (previous === 0) {
    const abs = format === "currency" ? formatMetric("currency", Math.abs(delta)) : String(Math.abs(delta));
    const verb = delta > 0 ? "Up by" : "Down by";
    return `<span class="reports-kpi__cmp reports-kpi__cmp--${dir}">${arrow} ${verb} ${abs} ${unitLabel}</span>`;
  }
  const pct = Math.round((Math.abs(delta) / Math.abs(previous)) * 1000) / 10;
  return `<span class="reports-kpi__cmp reports-kpi__cmp--${dir}">${arrow} ${pct}% vs comparison</span>`;
}

// --- Export -----------------------------------------------------------------

function sectionHasExportData(key: ExportKey, p: ReportsPayload): boolean {
  switch (key) {
    case "overview":
      return (
        p.revenue.orderCount > 0 ||
        p.appointments.scheduled > 0 ||
        p.inventory.lowStockCount > 0
      );
    case "revenue":
      return p.revenue.orderCount > 0;
    case "appointments":
      return p.appointmentsByStaff.length > 0;
    case "cancellations":
      return p.cancellations.scheduledTotal > 0;
    case "status":
      return p.appointmentStatus.total > 0;
    case "inventory":
      return p.inventory.lowStockCount > 0;
    case "all":
      return (
        sectionHasExportData("revenue", p) ||
        sectionHasExportData("appointments", p) ||
        sectionHasExportData("cancellations", p) ||
        sectionHasExportData("inventory", p)
      );
  }
}

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function sectionCsv(key: ExportKey, p: ReportsPayload): string {
  const lines: string[] = [];
  lines.push("Salon Citrine Team Reports");
  lines.push(`Period,${p.range.fromDate},${p.range.toDate}`);
  lines.push("");

  const revenue = () => {
    lines.push("Revenue Summary");
    lines.push("Metric,Value");
    lines.push(`${METRICS.completedCheckouts.label},${p.revenue.orderCount}`);
    lines.push(`${METRICS.netRevenue.label},${p.revenue.netRevenueCents / 100}`);
    lines.push(`${METRICS.serviceRevenue.label},${p.revenue.serviceRevenueCents / 100}`);
    lines.push(`${METRICS.productRevenue.label},${p.revenue.productRevenueCents / 100}`);
    lines.push(`${METRICS.tips.label},${p.revenue.tipCents / 100}`);
    lines.push(`${METRICS.averageTicket.label},${p.revenue.averageTicketCents / 100}`);
  };

  const appointments = () => {
    lines.push("Appointments by staff");
    lines.push("Staff,Scheduled,Completed,Cancelled,No-show,Upcoming,Service revenue,Product revenue,Tips,Average ticket");
    for (const row of p.appointmentsByStaff) {
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
  };

  const cancellations = () => {
    lines.push("Cancellations & no-shows");
    lines.push("Metric,Value");
    lines.push(`Total scheduled,${p.cancellations.scheduledTotal}`);
    lines.push(`Cancelled,${p.cancellations.cancelled}`);
    lines.push(`No-show,${p.cancellations.noShow}`);
    lines.push(`Cancellation rate %,${p.cancellations.cancellationRate}`);
    lines.push(`No-show rate %,${p.cancellations.noShowRate}`);
    lines.push(`Collected fees,${p.cancellations.collectedFeeCents / 100}`);
  };

  const status = () => {
    lines.push("Appointment status");
    lines.push("Status,Count,Share %");
    for (const row of p.appointmentStatus.byStatus) {
      const share =
        p.appointmentStatus.total > 0
          ? Math.round((row.count / p.appointmentStatus.total) * 1000) / 10
          : 0;
      lines.push(`${csvCell(statusLabel(row.status))},${row.count},${share}`);
    }
  };

  const inventory = () => {
    lines.push("Low stock inventory");
    lines.push("Product,Category,Supplier,On hand,Reorder at,Deficit,Status");
    for (const item of p.inventory.items) {
      lines.push(
        [
          csvCell(item.name),
          csvCell(formatCategoryLabel(item.category)),
          csvCell(item.brand ?? ""),
          csvCell(formatQuantity(item.quantity, item.unit)),
          item.reorderThreshold,
          item.deficit,
          csvCell(severityLabel(item.severity)),
        ].join(","),
      );
    }
  };

  if (key === "overview") {
    revenue();
    lines.push("");
    lines.push("Appointments");
    lines.push("Metric,Value");
    lines.push(`${METRICS.scheduledAppointments.label},${p.appointments.scheduled}`);
    lines.push(`${METRICS.completedAppointments.label},${p.appointments.completed}`);
    lines.push(`${METRICS.cancellations.label},${p.appointments.cancelled}`);
    lines.push(`${METRICS.noShows.label},${p.appointments.noShow}`);
    lines.push(`${METRICS.lowStock.label},${p.inventory.lowStockCount}`);
  } else if (key === "revenue") revenue();
  else if (key === "appointments") appointments();
  else if (key === "cancellations") cancellations();
  else if (key === "status") status();
  else if (key === "inventory") inventory();
  else {
    revenue();
    lines.push("");
    appointments();
    lines.push("");
    cancellations();
    lines.push("");
    status();
    lines.push("");
    inventory();
  }
  return lines.join("\n");
}

function downloadCsv(key: ExportKey, payload: ReportsPayload) {
  const slug = key === "all" ? "report" : key;
  const filename = `salon-citrine-${slug}-${payload.range.fromDate}-to-${payload.range.toDate}.csv`;
  const blob = new Blob([sectionCsv(key, payload)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`${EXPORT_LABELS[key]} CSV downloaded.`, "success");
}

// ---------------------------------------------------------------------------
// Table enhancers (sort, search, column visibility)
// ---------------------------------------------------------------------------

function wireSortableTable(table: HTMLTableElement) {
  const thead = table.tHead;
  if (!thead) return;
  for (const th of Array.from(thead.querySelectorAll<HTMLTableCellElement>("th[data-sort]"))) {
    th.tabIndex = 0;
    th.setAttribute("role", "button");
    th.setAttribute("aria-sort", "none");
    const toggle = () => {
      const key = th.dataset.sort!;
      const numeric = th.dataset.sortNumeric === "true";
      const tbody = table.tBodies[0];
      if (!tbody) return;
      const rows = Array.from(tbody.rows);
      const asc = th.getAttribute("aria-sort") !== "ascending";
      for (const h of Array.from(thead.querySelectorAll("th[data-sort]"))) {
        h.setAttribute("aria-sort", "none");
      }
      th.setAttribute("aria-sort", asc ? "ascending" : "descending");
      rows.sort((a, b) => {
        const av = a.querySelector(`[data-col="${key}"]`)?.textContent?.trim() ?? "";
        const bv = b.querySelector(`[data-col="${key}"]`)?.textContent?.trim() ?? "";
        if (numeric) {
          const an = Number(av.replace(/[^0-9.-]/g, "")) || 0;
          const bn = Number(bv.replace(/[^0-9.-]/g, "")) || 0;
          return asc ? an - bn : bn - an;
        }
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      for (const row of rows) tbody.appendChild(row);
    };
    th.addEventListener("click", toggle);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }
}

function wireTableSearch(input: HTMLInputElement, table: HTMLTableElement) {
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    for (const row of Array.from(table.tBodies[0]?.rows ?? [])) {
      const text = row.textContent?.toLowerCase() ?? "";
      row.hidden = q.length > 0 && !text.includes(q);
    }
  });
}

function wireColumnVisibility(root: HTMLElement, table: HTMLTableElement) {
  const toggles = Array.from(root.querySelectorAll<HTMLInputElement>("[data-col-toggle]"));
  const apply = () => {
    for (const input of toggles) {
      const col = input.dataset.colToggle!;
      const show = input.checked;
      for (const el of Array.from(table.querySelectorAll(`[data-col="${col}"]`))) {
        (el as HTMLElement).hidden = !show;
      }
    }
  };
  for (const input of toggles) input.addEventListener("change", apply);
  apply();
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderOverview(
  p: ReportsPayload,
  trendMetric: TrendMetric,
  onTrendChange: (m: TrendMetric) => void,
) {
  const cmp = p.comparison;
  const rev = p.revenue;
  const ap = p.appointments;
  const inv = p.inventory;

  const hasRevenue = rev.orderCount > 0;
  const hasAppts = ap.scheduled > 0;
  const hasInv = inv.lowStockCount > 0;
  const hasAny = hasRevenue || hasAppts || hasInv;

  let banner = "";
  if (!hasAny) {
    banner = stateMarkup(
      "empty",
      "No activity for this period",
      "No appointments, checkouts, or inventory alerts were recorded in this range.",
    );
  } else if (!hasRevenue && hasAppts) {
    banner = `<div class="reports-banner reports-banner--info" role="status">
      <p class="reports-banner__title">No completed checkout activity for this period</p>
      <p class="reports-banner__hint">Appointments were scheduled, but no completed checkouts or revenue were recorded during this range.</p>
    </div>`;
  }

  type Kpi = {
    metric: MetricKey;
    value: string;
    cmp?: string;
    drill?: string;
    drillParams?: Record<string, string>;
    scrollTo?: string;
  };

  const kpis: Kpi[] = [
    {
      metric: "netRevenue",
      value: formatMetric("currency", rev.netRevenueCents),
      cmp: cmp
        ? comparisonLine(rev.netRevenueCents, cmp.revenue.netRevenueCents, "currency", "revenue")
        : "",
      drill: "ledger",
    },
    {
      metric: "completedCheckouts",
      value: formatMetric("number", rev.orderCount),
      cmp: cmp
        ? comparisonLine(rev.orderCount, cmp.revenue.orderCount, "number", "checkouts")
        : "",
      drill: "ledger",
    },
    {
      metric: "scheduledAppointments",
      value: formatMetric("number", ap.scheduled),
      cmp: cmp
        ? comparisonLine(ap.scheduled, cmp.appointments.scheduled, "number", "appointments")
        : "",
      drill: "appointments",
    },
    {
      metric: "completedAppointments",
      value: formatMetric("number", ap.completed),
      cmp: cmp
        ? comparisonLine(ap.completed, cmp.appointments.completed, "number", "appointments")
        : "",
      drill: "status",
      drillParams: { status: "completed" },
    },
    {
      metric: "averageTicket",
      value: formatMetric("currency", rev.averageTicketCents),
      cmp: cmp
        ? comparisonLine(
            rev.averageTicketCents,
            cmp.revenue.averageTicketCents,
            "currency",
            "average ticket",
          )
        : "",
      drill: "ledger",
    },
    {
      metric: "cancellations",
      value: formatMetric("number", ap.cancelled),
      cmp: cmp
        ? comparisonLine(ap.cancelled, cmp.appointments.cancelled, "number", "cancellations")
        : "",
      drill: "cancellations",
    },
    {
      metric: "noShows",
      value: formatMetric("number", ap.noShow),
      cmp: cmp
        ? comparisonLine(ap.noShow, cmp.appointments.noShow, "number", "no-shows")
        : "",
      drill: "cancellations",
    },
    {
      metric: "lowStock",
      value: formatMetric("number", inv.lowStockCount),
      scrollTo: "reports-inventory",
    },
  ];

  const kpiHtml = kpis
    .map((k) => {
      const def = METRICS[k.metric];
      const attrs = k.drill
        ? ` data-drill="${escapeHtml(k.drill)}"${k.drillParams ? ` data-drill-params='${escapeHtml(JSON.stringify(k.drillParams))}'` : ""}`
        : k.scrollTo
          ? ` data-scroll-to="${escapeHtml(k.scrollTo)}"`
          : "";
      return `<article class="reports-kpi"${attrs} tabindex="${k.drill || k.scrollTo ? "0" : "-1"}" role="${k.drill || k.scrollTo ? "button" : "group"}">
        <p class="reports-kpi__label">${escapeHtml(def.label)} ${info(def)}</p>
        <p class="reports-kpi__value">${escapeHtml(k.value)}</p>
        ${k.cmp ? k.cmp : ""}
      </article>`;
    })
    .join("");

  const trendHtml = renderTrend(p.trend, trendMetric, onTrendChange);

  let invAlert = "";
  if (inv.lowStockCount > 0) {
    invAlert = `<p class="reports-inv-alert"><a href="#reports-inventory" data-scroll-to="reports-inventory">${inv.lowStockCount} product${inv.lowStockCount === 1 ? "" : "s"} need attention</a></p>`;
  }

  return `${banner}${invAlert}<div class="reports-kpi-grid">${kpiHtml}</div>${trendHtml}`;
}

function trendValue(pt: TrendData["points"][0], metric: TrendMetric): number {
  switch (metric) {
    case "revenue":
      return pt.revenueCents;
    case "completedCheckouts":
      return pt.completedCheckouts;
    case "scheduledAppts":
      return pt.scheduledAppts;
    case "averageTicket":
      return pt.averageTicketCents;
    case "cancellations":
      return pt.cancellations;
  }
}

function renderTrend(
  trend: TrendData,
  metric: TrendMetric,
  onTrendChange: (m: TrendMetric) => void,
) {
  const values = trend.points.map((pt) => trendValue(pt, metric));
  const max = Math.max(...values, 1);
  const hasData = values.some((v) => v > 0);

  const selector = `<div class="reports-trend__controls" role="group" aria-label="Trend metric">
    ${TREND_OPTIONS.map(
      (opt) =>
        `<button type="button" class="reports-trend__metric${opt.value === metric ? " is-active" : ""}" data-trend-metric="${opt.value}" aria-pressed="${opt.value === metric}">${escapeHtml(opt.label)}</button>`,
    ).join("")}
  </div>`;

  if (!hasData) {
    return `<section class="reports-trend" aria-labelledby="reports-trend-title">
      <div class="reports-trend__head">
        <h3 class="reports-trend__title" id="reports-trend-title">Trend</h3>
        ${selector}
      </div>
      ${stateMarkup("empty", "No chartable activity", "Try a wider range or a different metric.")}
    </section>`;
  }

  const isCurrency = metric === "revenue" || metric === "averageTicket";
  const bars = trend.points
    .map((pt, i) => {
      const v = values[i]!;
      const pct = Math.round((v / max) * 100);
      const label = isCurrency ? formatMetric("currency", v) : String(v);
      return `<div class="reports-trend__bar-wrap" title="${escapeHtml(pt.label)}: ${escapeHtml(label)}">
        <div class="reports-trend__bar" style="height:${Math.max(pct, 4)}%" role="presentation"></div>
        <span class="reports-trend__bar-label">${escapeHtml(pt.label)}</span>
        <span class="sr-only">${escapeHtml(pt.label)}: ${escapeHtml(label)}</span>
      </div>`;
    })
    .join("");

  const total = values.reduce((a, b) => a + b, 0);
  const summary = isCurrency
    ? `Total ${formatMetric("currency", total)} across ${trend.points.length} ${trend.grouping === "day" ? "days" : trend.grouping === "week" ? "weeks" : "months"}.`
    : `Total ${total} across ${trend.points.length} ${trend.grouping === "day" ? "days" : trend.grouping === "week" ? "weeks" : "months"}.`;

  // Defer wiring trend buttons — caller re-renders overview on change.
  void onTrendChange;

  return `<section class="reports-trend" aria-labelledby="reports-trend-title">
    <div class="reports-trend__head">
      <h3 class="reports-trend__title" id="reports-trend-title">Trend</h3>
      ${selector}
    </div>
    <p class="reports-trend__summary">${escapeHtml(summary)}</p>
    <div class="reports-trend__chart" role="img" aria-label="Trend chart. ${escapeHtml(summary)}">${bars}</div>
  </section>`;
}

function renderRevenueSection(rev: RevenueSummary) {
  if (rev.orderCount === 0) {
    return stateMarkup(
      "empty",
      "No completed checkout activity",
      "Revenue appears once checkouts are completed in this range.",
    );
  }
  const rows = [
    { metric: "netRevenue" as MetricKey, value: rev.netRevenueCents, drill: "ledger" },
    { metric: "serviceRevenue" as MetricKey, value: rev.serviceRevenueCents },
    { metric: "productRevenue" as MetricKey, value: rev.productRevenueCents },
    { metric: "tips" as MetricKey, value: rev.tipCents },
    { metric: "tax" as MetricKey, value: rev.taxCents },
    { metric: "discounts" as MetricKey, value: rev.discountCents },
    { metric: "averageTicket" as MetricKey, value: rev.averageTicketCents },
    { metric: "completedCheckouts" as MetricKey, value: rev.orderCount, drill: "ledger" },
  ];
  return `<div class="reports-table-wrap">
    <table class="reports-table" data-reports-table>
      <thead><tr><th>Metric</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            const def = METRICS[r.metric];
            const drill = r.drill ? ` data-drill="${r.drill}" tabindex="0" role="button"` : "";
            return `<tr${drill}>
              <td data-col="metric">${escapeHtml(def.label)} ${info(def)}</td>
              <td class="num" data-col="value">${escapeHtml(formatMetric(def.format, r.value))}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function renderStaffTable(rows: StaffReportRow[]) {
  if (rows.length === 0) {
    return stateMarkup(
      "empty",
      "No appointments in this range",
      "Staff totals appear once appointments are booked.",
    );
  }

  const cols = [
    { key: "staff", label: "Staff", default: true },
    { key: "scheduled", label: "Scheduled", numeric: true, default: true },
    { key: "completed", label: "Completed", numeric: true, default: true },
    { key: "cancelled", label: "Cancelled", numeric: true, default: true },
    { key: "noShow", label: "No-show", numeric: true, default: false },
    { key: "upcoming", label: "Upcoming", numeric: true, default: true },
    { key: "serviceRevenue", label: "Service revenue", numeric: true, default: true },
    { key: "productRevenue", label: "Product revenue", numeric: true, default: false },
    { key: "tips", label: "Tips", numeric: true, default: false },
    { key: "averageTicket", label: "Avg ticket", numeric: true, default: true },
  ];

  const colMenu = `<details class="reports-col-menu">
    <summary class="reports-col-menu__trigger ui-btn ui-btn--secondary ui-btn--compact">Columns</summary>
    <div class="reports-col-menu__panel">
      ${cols
        .filter((c) => c.key !== "staff")
        .map(
          (c) =>
            `<label class="reports-col-menu__item"><input type="checkbox" data-col-toggle="${c.key}" ${c.default ? "checked" : ""} /> ${escapeHtml(c.label)}</label>`,
        )
        .join("")}
    </div>
  </details>`;

  const head = cols
    .map(
      (c) =>
        `<th class="${c.numeric ? "num" : ""}" data-sort="${c.key}" data-sort-numeric="${c.numeric ? "true" : "false"}">${escapeHtml(c.label)}</th>`,
    )
    .join("");

  const body = rows
    .map((row) => {
      const cells: Record<string, string> = {
        staff: escapeHtml(row.staffName),
        scheduled: String(row.scheduled),
        completed: String(row.completed),
        cancelled: String(row.cancelled),
        noShow: String(row.noShow),
        upcoming: String(row.upcoming),
        serviceRevenue: formatMetric("currency", row.serviceRevenueCents),
        productRevenue: formatMetric("currency", row.productRevenueCents),
        tips: formatMetric("currency", row.tipCents),
        averageTicket: formatMetric("currency", row.averageTicketCents),
      };
      return `<tr data-staff-id="${escapeHtml(row.staffId)}" data-drill="staff" data-drill-params='${escapeHtml(JSON.stringify({ staffId: row.staffId }))}' tabindex="0" role="button">
        ${cols.map((c) => `<td class="${c.numeric ? "num" : ""}" data-col="${c.key}">${cells[c.key]}</td>`).join("")}
      </tr>`;
    })
    .join("");

  return `<div class="reports-table-toolbar">
    <label class="reports-table-search">
      <span class="sr-only">Search staff</span>
      <input class="form-input reports-table-search__input" type="search" placeholder="Search staff…" data-table-search />
    </label>
    ${colMenu}
  </div>
  <div class="reports-table-wrap">
    <table class="reports-table reports-table--staff" data-reports-table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <p class="reports-table-foot">Click a row to view that staff member's appointments. Upcoming = booked, confirmed, or arrived.</p>`;
}

function renderCancellations(stats: CancellationSummary) {
  if (stats.scheduledTotal === 0) {
    return stateMarkup(
      "empty",
      "No appointments in this range",
      "Cancellation and no-show rates appear once appointments are booked.",
    );
  }
  return `<div class="reports-cancel-row" data-drill="cancellations" tabindex="0" role="button" aria-label="View cancellation details">
    <div class="reports-cancel-cell">
      <span class="reports-cancel-cell__label">Total scheduled</span>
      <span class="reports-cancel-cell__value">${stats.scheduledTotal}</span>
    </div>
    <div class="reports-cancel-cell">
      <span class="reports-cancel-cell__label">Cancelled</span>
      <span class="reports-cancel-cell__value${stats.cancelled > 0 ? " reports-cancel-cell__value--flag" : ""}">${stats.cancelled}</span>
      <span class="reports-cancel-cell__meta">${stats.cancellationRate}% of scheduled</span>
    </div>
    <div class="reports-cancel-cell">
      <span class="reports-cancel-cell__label">No-show</span>
      <span class="reports-cancel-cell__value${stats.noShow > 0 ? " reports-cancel-cell__value--flag" : ""}">${stats.noShow}</span>
      <span class="reports-cancel-cell__meta">${stats.noShowRate}% of scheduled</span>
    </div>
    <div class="reports-cancel-cell">
      <span class="reports-cancel-cell__label">Collected fees</span>
      <span class="reports-cancel-cell__value">${formatMetric("currency", stats.collectedFeeCents)}</span>
      <span class="reports-cancel-cell__meta">Cancellation / no-show fees captured</span>
    </div>
  </div>
  <p class="reports-table-foot">Click the summary row to view underlying cancelled and no-show appointments.</p>`;
}

function renderStatus(stats: AppointmentStatusSummary) {
  if (stats.total === 0) {
    return stateMarkup(
      "empty",
      "No appointments in this range",
      "The status breakdown appears once appointments are booked.",
    );
  }
  const rows = stats.byStatus
    .map((row) => {
      const share =
        stats.total > 0 ? Math.round((row.count / stats.total) * 1000) / 10 : 0;
      const pct = Math.max(share, 2);
      return `<tr data-drill="status" data-drill-params='${escapeHtml(JSON.stringify({ status: row.status }))}' tabindex="0" role="button">
        <td data-col="status">${escapeHtml(statusLabel(row.status))}</td>
        <td class="num" data-col="count">${row.count}</td>
        <td class="num" data-col="share">${share}%</td>
        <td data-col="bar" class="reports-status-bar-cell">
          <div class="reports-status-bar" role="presentation"><span class="reports-status-bar__fill" style="width:${pct}%"></span></div>
          <span class="sr-only">${share}% of appointments</span>
        </td>
      </tr>`;
    })
    .join("");

  return `<div class="reports-table-wrap">
    <table class="reports-table" data-reports-table>
      <thead>
        <tr>
          <th data-sort="status">Status</th>
          <th class="num" data-sort="count" data-sort-numeric="true">Count</th>
          <th class="num" data-sort="share" data-sort-numeric="true">Share</th>
          <th>Distribution</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="reports-table-foot">Click a status to view matching appointments.</p>`;
}

function renderInventory(inv: InventorySummary, inventoryUrl: string) {
  if (inv.totalProducts === 0) {
    return stateMarkup(
      "not-configured",
      "Inventory isn't set up yet",
      "Add products in Stock to track low-stock alerts here.",
    );
  }
  if (inv.lowStockCount === 0) {
    return stateMarkup(
      "empty",
      "Everything is stocked",
      "No products are at or below their reorder threshold.",
    );
  }

  const rows = inv.items
    .map(
      (item) => `<tr>
        <td data-col="product">${escapeHtml(item.name)}</td>
        <td data-col="category">${escapeHtml(formatCategoryLabel(item.category))}</td>
        <td class="num" data-col="quantity">${escapeHtml(formatQuantity(item.quantity, item.unit))}</td>
        <td class="num" data-col="reorder">${item.reorderThreshold}</td>
        <td class="num" data-col="deficit">${item.deficit}</td>
        <td data-col="status"><span class="reports-severity reports-severity--${item.severity}">${escapeHtml(severityLabel(item.severity))}</span></td>
        <td data-col="supplier">${escapeHtml(item.brand ?? "—")}</td>
        <td data-col="updated">${escapeHtml(formatDateTime(item.lastUpdated))}</td>
        <td data-col="action"><a class="reports-table__action" href="${escapeHtml(inventoryUrl)}">View in Stock</a></td>
      </tr>`,
    )
    .join("");

  return `<p class="reports-section-lead">${inv.lowStockCount} of ${inv.totalProducts} products need attention${inv.outOfStockCount > 0 ? ` · ${inv.outOfStockCount} out of stock` : ""}</p>
  <div class="reports-table-toolbar">
    <label class="reports-table-search">
      <span class="sr-only">Search products</span>
      <input class="form-input reports-table-search__input" type="search" placeholder="Search products…" data-table-search />
    </label>
  </div>
  <div class="reports-table-wrap">
    <table class="reports-table reports-table--inventory" data-reports-table>
      <thead>
        <tr>
          <th data-sort="product">Product</th>
          <th data-sort="category">Category</th>
          <th class="num" data-sort="quantity" data-sort-numeric="true">On hand</th>
          <th class="num" data-sort="reorder" data-sort-numeric="true">Reorder at</th>
          <th class="num" data-sort="deficit" data-sort-numeric="true">Deficit</th>
          <th data-sort="status">Status</th>
          <th data-sort="supplier">Supplier</th>
          <th data-sort="updated">Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderDetailPanel(detail: ReportDetail) {
  const head = detail.columns
    .map((c) => `<th class="${c.numeric ? "num" : ""}">${escapeHtml(c.label)}</th>`)
    .join("");
  const body =
    detail.rows.length === 0
      ? `<tr><td colspan="${detail.columns.length}">No records match.</td></tr>`
      : detail.rows
          .map(
            (row) =>
              `<tr>${detail.columns.map((c) => `<td class="${c.numeric ? "num" : ""}">${escapeHtml(String(row[c.key] ?? ""))}</td>`).join("")}</tr>`,
          )
          .join("");
  return `<div class="reports-detail__head">
    <div>
      <h3 class="reports-detail__title" id="reports-detail-title">${escapeHtml(detail.title)}</h3>
      <p class="reports-detail__desc">${escapeHtml(detail.description)}</p>
    </div>
    <button type="button" class="ui-btn ui-btn--secondary ui-btn--compact" data-detail-close>Close</button>
  </div>
  <div class="reports-table-wrap reports-detail__table">
    <table class="reports-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  ${detail.rows.length >= 500 ? `<p class="reports-table-foot">Showing the first 500 records.</p>` : ""}`;
}

// ---------------------------------------------------------------------------
// App controller
// ---------------------------------------------------------------------------

function initReports(root: HTMLElement) {
  const apiBase = root.dataset.apiBase ?? "";
  const inventoryUrl = root.dataset.inventoryUrl ?? "/inventory";

  const fromInput = root.querySelector<HTMLInputElement>("[data-range-from]");
  const toInput = root.querySelector<HTMLInputElement>("[data-range-to]");
  const applyBtn = root.querySelector<HTMLButtonElement>("[data-range-apply]");
  const customWrap = root.querySelector<HTMLElement>("[data-custom-range]");
  const compareSelect = root.querySelector<HTMLSelectElement>("[data-compare-mode]");
  const presetBtns = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-preset]"));
  const exportMenu = root.querySelector<HTMLDetailsElement>("[data-export-menu]");
  const errorEl = root.querySelector<HTMLElement>("[data-reports-error]");
  const rangeLabel = root.querySelector<HTMLElement>("[data-range-label]");
  const refreshedLabel = root.querySelector<HTMLElement>("[data-refreshed-label]");

  const overviewEl = root.querySelector<HTMLElement>("[data-overview-body]");
  const revenueEl = root.querySelector<HTMLElement>("[data-revenue-body]");
  const staffEl = root.querySelector<HTMLElement>("[data-staff-body]");
  const cancelEl = root.querySelector<HTMLElement>("[data-cancel-body]");
  const statusEl = root.querySelector<HTMLElement>("[data-status-body]");
  const inventoryEl = root.querySelector<HTMLElement>("[data-inventory-body]");
  const detailPanel = root.querySelector<HTMLElement>("[data-detail-panel]");
  const detailBody = root.querySelector<HTMLElement>("[data-detail-body]");

  const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
  const tabBtns = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-report-tab]"));
  const reportSections = Array.from(root.querySelectorAll<HTMLElement>(".reports-section"));

  let lastPayload: ReportsPayload | null = null;
  let activeSectionId: ReportSectionId = "reports-overview";
  let activeExportKey: ExportKey = "overview";
  let trendMetric: TrendMetric = "revenue";
  let compareMode: CompareMode = "previous";
  let detailReturnFocus: HTMLElement | null = null;
  const mobileMq = window.matchMedia("(max-width: 900px)");

  function currentRange() {
    const from = fromInput?.value || root.dataset.from || "";
    const to = toInput?.value || root.dataset.to || "";
    return { from, to };
  }

  function buildUrl(extra?: Record<string, string>) {
    const { from, to } = currentRange();
    const params = new URLSearchParams({ from, to });
    if (compareMode !== "none") params.set("compare", compareMode);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return `${apiBase}?${params}`;
  }

  function stickyOffset() {
    const bar = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--team-bar-height"),
    );
    const toolbar = root.querySelector<HTMLElement>(".reports-toolbar");
    const toolbarH = toolbar?.offsetHeight ?? 0;
    return (Number.isFinite(bar) ? bar : 52) + toolbarH + 12;
  }

  function setActivePreset(value: PresetValue | null) {
    for (const btn of presetBtns) {
      const pressed = btn.dataset.preset === value;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.classList.toggle("is-active", pressed);
    }
    if (customWrap) customWrap.hidden = value !== "custom";
  }

  function setActiveSection(id: ReportSectionId, exportKey?: ExportKey) {
    activeSectionId = id;
    if (exportKey) activeExportKey = exportKey;
    for (const link of navLinks) link.classList.toggle("is-active", link.dataset.navLink === id);
    for (const btn of tabBtns) {
      const selected = btn.dataset.reportTab === id;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
    }
    if (mobileMq.matches) {
      for (const section of reportSections) {
        section.classList.toggle("is-mobile-hidden", section.id !== id);
      }
    } else {
      for (const section of reportSections) section.classList.remove("is-mobile-hidden");
    }
    updateExportMenu();
  }

  function updateExportMenu() {
    if (!exportMenu) return;
    const hint = exportMenu.querySelector<HTMLElement>("[data-export-hint]");
    const hasData = lastPayload ? sectionHasExportData(activeExportKey, lastPayload) : false;
    if (hint) {
      hint.textContent = hasData
        ? `Export ${EXPORT_LABELS[activeExportKey]} for ${lastPayload?.range.label ?? "this range"}.`
        : "Export unavailable because this section contains no rows.";
    }
    for (const btn of Array.from(exportMenu.querySelectorAll<HTMLButtonElement>("[data-export-section]"))) {
      const key = btn.dataset.exportSection as ExportKey;
      const ok = lastPayload ? sectionHasExportData(key, lastPayload) : false;
      btn.disabled = !ok;
      btn.title = ok ? `Download ${EXPORT_LABELS[key]} CSV` : "No rows to export for this section.";
    }
  }

  function showLoading() {
    if (errorEl) errorEl.hidden = true;
    const skel = Array.from({ length: 8 }, () => '<div class="reports-skeleton__card"></div>').join("");
    if (overviewEl) overviewEl.innerHTML = `<div class="reports-skeleton">${skel}</div>`;
    for (const el of [revenueEl, staffEl, cancelEl, statusEl, inventoryEl]) {
      if (el) el.innerHTML = stateMarkup("loading", "Loading…");
    }
  }

  function showError(message: string) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    const isPermission = /unauthorized|403|permission|manager/i.test(message);
    const err = stateMarkup(
      isPermission ? "permission" : "error",
      isPermission ? "Reports are manager-only" : "Couldn't load reports",
      isPermission ? "Ask your salon owner for access." : "Check your connection and try Refresh.",
    );
    for (const el of [overviewEl, revenueEl, staffEl, cancelEl, statusEl, inventoryEl]) {
      if (el) el.innerHTML = err;
    }
    updateExportMenu();
  }

  function enhanceTables(scope: ParentNode) {
    const wired = new Set<HTMLTableElement>();
    for (const wrap of Array.from(scope.querySelectorAll<HTMLElement>(".reports-table-toolbar"))) {
      const search = wrap.querySelector<HTMLInputElement>("[data-table-search]");
      const table = wrap.parentElement?.querySelector<HTMLTableElement>("[data-reports-table]");
      if (search && table) wireTableSearch(search, table);
      if (table && !wired.has(table)) {
        wireSortableTable(table);
        wireColumnVisibility(wrap, table);
        wired.add(table);
      }
    }
    for (const table of Array.from(scope.querySelectorAll<HTMLTableElement>("[data-reports-table]"))) {
      if (!wired.has(table)) {
        wireSortableTable(table);
        wired.add(table);
      }
    }
  }

  function wireDrillTargets(scope: ParentNode) {
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>("[data-drill]"))) {
      const open = () => {
        const kind = el.dataset.drill!;
        let params: Record<string, string> = {};
        try {
          params = el.dataset.drillParams ? JSON.parse(el.dataset.drillParams) : {};
        } catch {
          /* ignore */
        }
        void openDetail(kind, params, el);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    }
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>("[data-scroll-to]"))) {
      const go = () => {
        const id = el.dataset.scrollTo!;
        const target = document.getElementById(id);
        if (target) {
          window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - stickyOffset(), behavior: "smooth" });
          setActiveSection(id as ReportSectionId);
        }
      };
      el.addEventListener("click", (e) => {
        if (el.tagName === "A") e.preventDefault();
        go();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }
  }

  function wireTrendControls() {
    if (!overviewEl) return;
    for (const btn of Array.from(overviewEl.querySelectorAll<HTMLButtonElement>("[data-trend-metric]"))) {
      btn.addEventListener("click", () => {
        trendMetric = btn.dataset.trendMetric as TrendMetric;
        if (lastPayload) renderAll(lastPayload);
      });
    }
  }

  function renderAll(p: ReportsPayload) {
    if (overviewEl) {
      overviewEl.innerHTML = renderOverview(p, trendMetric, () => {});
      wireTrendControls();
    }
    if (revenueEl) revenueEl.innerHTML = renderRevenueSection(p.revenue);
    if (staffEl) staffEl.innerHTML = renderStaffTable(p.appointmentsByStaff);
    if (cancelEl) cancelEl.innerHTML = renderCancellations(p.cancellations);
    if (statusEl) statusEl.innerHTML = renderStatus(p.appointmentStatus);
    if (inventoryEl) inventoryEl.innerHTML = renderInventory(p.inventory, inventoryUrl);
    enhanceTables(root);
    wireDrillTargets(root);
    updateExportMenu();
  }

  function setRefreshed() {
    if (!refreshedLabel) return;
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: SALON_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    refreshedLabel.textContent = `Updated ${time}`;
  }

  async function openDetail(kind: string, params: Record<string, string>, source: HTMLElement) {
    if (!detailPanel || !detailBody) return;
    detailReturnFocus = source;
    detailBody.innerHTML = stateMarkup("loading", "Loading records…");
    detailPanel.hidden = false;
    const closeBtn = detailPanel.querySelector<HTMLButtonElement>("[data-detail-close]");
    closeBtn?.focus();

    try {
      const url = buildUrl({ detail: kind, ...params });
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load detail");
      detailBody.innerHTML = renderDetailPanel(body.detail as ReportDetail);
      detailBody.querySelector<HTMLButtonElement>("[data-detail-close]")?.addEventListener("click", closeDetail);
    } catch (err) {
      detailBody.innerHTML = stateMarkup(
        "error",
        "Couldn't load records",
        err instanceof Error ? err.message : "Try again.",
      );
      detailBody.querySelector<HTMLButtonElement>("[data-detail-close]")?.addEventListener("click", closeDetail);
    }
  }

  function closeDetail() {
    if (!detailPanel) return;
    detailPanel.hidden = true;
    detailReturnFocus?.focus();
    detailReturnFocus = null;
  }

  async function loadReports() {
    const { from, to } = currentRange();
    if (rangeLabel && from && to) {
      rangeLabel.textContent = formatReportRangeLabel({ fromDate: from, toDate: to });
    }
    setActivePreset(detectPreset(from, to, salonLocalDate()));
    showLoading();
    try {
      const res = await fetch(buildUrl());
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load reports");
      lastPayload = body.reports as ReportsPayload;
      if (rangeLabel) rangeLabel.textContent = lastPayload.range.label;
      renderAll(lastPayload);
      setRefreshed();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load reports");
    }
  }

  // Scroll-spy: pick the section whose top is closest below the sticky offset.
  function setupScrollSpy() {
    const sections = navLinks
      .map((link) => document.getElementById(link.dataset.navLink ?? ""))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const offset = stickyOffset();
      let active = sections[0]!;
      let best = Number.POSITIVE_INFINITY;
      for (const section of sections) {
        const top = section.getBoundingClientRect().top - offset;
        if (top <= 8 && Math.abs(top) < best) {
          best = Math.abs(top);
          active = section;
        }
      }
      const tab = tabBtns.find((btn) => btn.dataset.reportTab === active.id);
      const exportKey = (tab?.dataset.exportKey ?? "overview") as ExportKey;
      setActiveSection(active.id as ReportSectionId, exportKey);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    for (const link of navLinks) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.dataset.navLink ?? "";
        const target = document.getElementById(id);
        if (target) {
          window.scrollTo({
            top: target.getBoundingClientRect().top + window.scrollY - stickyOffset(),
            behavior: "smooth",
          });
          const tab = tabBtns.find((btn) => btn.dataset.reportTab === id);
          setActiveSection(id as ReportSectionId, (tab?.dataset.exportKey ?? "overview") as ExportKey);
        }
      });
    }
  }

  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.reportTab ?? "reports-overview";
      setActiveSection(id as ReportSectionId, (btn.dataset.exportKey ?? "overview") as ExportKey);
      const target = document.getElementById(id);
      if (target && !mobileMq.matches) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - stickyOffset(),
          behavior: "smooth",
        });
      }
    });
  }

  mobileMq.addEventListener("change", () => setActiveSection(activeSectionId, activeExportKey));

  for (const btn of presetBtns) {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset as PresetValue;
      setActivePreset(preset);
      const range = computePresetRange(preset, salonLocalDate());
      if (range) {
        if (fromInput) fromInput.value = range.from;
        if (toInput) toInput.value = range.to;
        void loadReports();
      }
    });
  }

  for (const input of [fromInput, toInput]) {
    input?.addEventListener("change", () => setActivePreset("custom"));
  }

  applyBtn?.addEventListener("click", () => void loadReports());

  compareSelect?.addEventListener("change", () => {
    compareMode = (compareSelect.value as CompareMode) || "none";
    void loadReports();
  });

  if (exportMenu) {
    for (const btn of Array.from(exportMenu.querySelectorAll<HTMLButtonElement>("[data-export-section]"))) {
      btn.addEventListener("click", () => {
        if (!lastPayload || btn.disabled) return;
        downloadCsv(btn.dataset.exportSection as ExportKey, lastPayload);
        exportMenu.open = false;
      });
    }
  }

  detailPanel?.querySelector<HTMLButtonElement>("[data-detail-close]")?.addEventListener("click", closeDetail);

  setupScrollSpy();
  setActiveSection("reports-overview", "overview");
  setActivePreset(detectPreset(currentRange().from, currentRange().to, salonLocalDate()));
  void loadReports();
}

document.querySelectorAll<HTMLElement>("[data-reports-app]").forEach(initReports);
