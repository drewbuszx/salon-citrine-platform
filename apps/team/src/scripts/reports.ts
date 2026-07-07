import { formatCategoryLabel, formatQuantity } from "@saloncitrine/shared";
import {
  addDays,
  dayOfWeek,
  formatReportRangeLabel,
  lastDayOfMonth,
  reportRangeFilenameSuffix,
  salonLocalDate,
  SALON_TIME_ZONE,
} from "../lib/report-range";
import { showToast } from "../lib/toast";

type ReportsPayload = {
  range: {
    fromDate: string;
    toDate: string;
    startUtc: string;
    endExclusiveUtc: string;
    label: string;
  };
  revenue: {
    orderCount: number;
    totalCents: number;
    tipCents: number;
    averageOrderCents: number;
    formattedTotal: string;
    formattedTips: string;
    formattedAverage: string;
  };
  appointmentsByStaff: Array<{
    staffName: string;
    total: number;
    completed: number;
    upcoming: number;
  }>;
  cancellations: {
    scheduledTotal: number;
    cancelled: number;
    noShow: number;
    completed: number;
    cancellationRate: number;
    noShowRate: number;
  };
  appointmentStatus: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  inventory: {
    totalProducts: number;
    lowStockCount: number;
    items: Array<{
      id: string;
      name: string;
      category: string;
      quantity: number;
      unit: string;
      reorderThreshold: number;
    }>;
  };
};

type ReportSectionId =
  | "reports-overview"
  | "reports-appointments"
  | "reports-cancellations"
  | "reports-status"
  | "reports-inventory";

type ExportSection = "revenue" | "appointments" | "cancellations" | "inventory" | "all";

const REVENUE_DEFINITION =
  "Revenue = completed service and product sales before tips and tax. Tips and tax are shown separately.";

const EXPORT_LABELS: Record<ExportSection, string> = {
  revenue: "Export revenue CSV",
  appointments: "Export appointments CSV",
  cancellations: "Export cancellations CSV",
  inventory: "Export inventory CSV",
  all: "Export full report CSV",
};

const EXPORT_TOAST: Record<ExportSection, string> = {
  revenue: "Revenue CSV downloaded.",
  appointments: "Appointments CSV downloaded.",
  cancellations: "Cancellations CSV downloaded.",
  inventory: "Inventory CSV downloaded.",
  all: "Full report CSV downloaded.",
};

type PresetValue =
  | "today"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "ytd"
  | "custom";

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

/** Compute a preset's calendar range (salon-local). Returns null for "custom". */
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

function stateMarkup(kind: "loading" | "empty" | "not-configured" | "error" | "permission", title: string, hint?: string) {
  if (kind === "loading") {
    return `
      <div class="reports-state ui-empty ui-empty--compact" aria-busy="true">
        <p class="ui-empty__title">${escapeHtml(title)}</p>
      </div>`;
  }
  const errorClass = kind === "error" || kind === "permission" ? " ui-empty--error" : "";
  return `
    <div class="reports-state ui-empty ui-empty--compact${errorClass}">
      <p class="ui-empty__title">${escapeHtml(title)}</p>
      ${hint ? `<p class="ui-empty__hint">${escapeHtml(hint)}</p>` : ""}
    </div>`;
}

function info(label: string) {
  return `<span class="reports-info" role="img" tabindex="0" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">i</span>`;
}

function sectionHasExportData(section: ExportSection, payload: ReportsPayload): boolean {
  switch (section) {
    case "revenue":
      return payload.revenue.orderCount > 0 || payload.revenue.totalCents > 0;
    case "appointments":
      return payload.appointmentsByStaff.length > 0;
    case "cancellations":
      return payload.cancellations.scheduledTotal > 0 || payload.appointmentStatus.total > 0;
    case "inventory":
      return payload.inventory.lowStockCount > 0;
    case "all":
      return (
        sectionHasExportData("revenue", payload) ||
        sectionHasExportData("appointments", payload) ||
        sectionHasExportData("cancellations", payload) ||
        sectionHasExportData("inventory", payload)
      );
  }
}

function initReports(root: HTMLElement) {
  const apiBase = root.dataset.apiBase ?? "";
  const inventoryUrl = root.dataset.inventoryUrl ?? "/inventory";
  const fromInput = root.querySelector<HTMLInputElement>("[data-range-from]");
  const toInput = root.querySelector<HTMLInputElement>("[data-range-to]");
  const applyBtn = root.querySelector<HTMLButtonElement>("[data-range-apply]");
  const customWrap = root.querySelector<HTMLElement>("[data-custom-range]");
  const presetBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-preset]"),
  );
  const exportBtn = root.querySelector<HTMLButtonElement>("[data-export-btn]");
  const errorEl = root.querySelector<HTMLElement>("[data-reports-error]");
  const rangeLabel = root.querySelector<HTMLElement>("[data-range-label]");
  const refreshedLabel = root.querySelector<HTMLElement>("[data-refreshed-label]");
  const revenueEl = root.querySelector<HTMLElement>("[data-revenue-stats]");
  const staffTable = root.querySelector<HTMLElement>("[data-staff-table]");
  const cancelEl = root.querySelector<HTMLElement>("[data-cancel-stats]");
  const statusEl = root.querySelector<HTMLElement>("[data-status-stats]");
  const inventoryEl = root.querySelector<HTMLElement>("[data-inventory-stats]");
  const navLinks = Array.from(
    root.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"),
  );
  const tabBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-report-tab]"),
  );
  const reportSections = Array.from(
    root.querySelectorAll<HTMLElement>(".reports-section"),
  );

  let lastPayload: ReportsPayload | null = null;
  let activeSectionId: ReportSectionId = "reports-overview";
  let activeExportKey: ExportSection = "revenue";
  const mobileMq = window.matchMedia("(max-width: 900px)");

  function currentRange() {
    const from = fromInput?.value || root.dataset.from || "";
    const to = toInput?.value || root.dataset.to || "";
    return { from, to };
  }

  function buildUrl(format?: "csv") {
    const { from, to } = currentRange();
    const params = new URLSearchParams({ from, to });
    if (format === "csv") params.set("format", "csv");
    return `${apiBase}?${params}`;
  }

  function setActivePreset(value: PresetValue | null) {
    for (const btn of presetBtns) {
      const pressed = btn.dataset.preset === value;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.classList.toggle("is-active", pressed);
    }
    if (customWrap) customWrap.hidden = value !== "custom";
  }

  function setActiveSection(id: ReportSectionId, exportKey?: ExportSection) {
    activeSectionId = id;
    if (exportKey) activeExportKey = exportKey;

    for (const link of navLinks) {
      link.classList.toggle("is-active", link.dataset.navLink === id);
    }
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
      for (const section of reportSections) {
        section.classList.remove("is-mobile-hidden");
      }
    }

    updateExportButton();
  }

  function updateExportButton() {
    if (!exportBtn) return;
    const hasData = lastPayload ? sectionHasExportData(activeExportKey, lastPayload) : false;
    exportBtn.disabled = !hasData;
    exportBtn.textContent = hasData
      ? EXPORT_LABELS[activeExportKey]
      : "Nothing to export";
    exportBtn.title = hasData
      ? `Download ${activeExportKey} data for the selected date range as CSV.`
      : "No rows to export for this report and date range.";
  }

  function showLoading() {
    if (errorEl) errorEl.hidden = true;
    const cards = Array.from({ length: 4 }, () => '<div class="reports-skeleton__card"></div>').join("");
    if (revenueEl) revenueEl.innerHTML = `<div class="reports-skeleton">${cards}</div>`;
    for (const el of [staffTable, cancelEl, statusEl, inventoryEl]) {
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
      isPermission
        ? "Ask your salon owner for access."
        : "Check your connection and try Refresh.",
    );
    for (const el of [revenueEl, staffTable, cancelEl, statusEl, inventoryEl]) {
      if (el) el.innerHTML = err;
    }
    updateExportButton();
  }

  function renderRevenue(revenue: ReportsPayload["revenue"]) {
    if (!revenueEl) return;
    if (revenue.orderCount === 0 && revenue.totalCents === 0) {
      revenueEl.innerHTML = stateMarkup(
        "empty",
        "No activity for this period",
        "$0 revenue recorded — completed checkouts in this range, not a loading error.",
      );
      return;
    }
    revenueEl.innerHTML = `
      <p class="reports-revenue-def">${escapeHtml(REVENUE_DEFINITION)}</p>
      <article class="reports-metric">
        <p class="reports-metric__label">Completed checkouts ${info("Checkouts marked complete within this date range.")}</p>
        <p class="reports-metric__value">${revenue.orderCount}</p>
      </article>
      <article class="reports-metric">
        <p class="reports-metric__label">Revenue ${info("Service and product sales from completed checkouts. Excludes tips, tax, gift cards, refunds, and deposits.")}</p>
        <p class="reports-metric__value">${escapeHtml(revenue.formattedTotal)}</p>
        <p class="reports-metric__meta">Tips ${escapeHtml(revenue.formattedTips)} · shown separately from revenue</p>
      </article>
      <article class="reports-metric">
        <p class="reports-metric__label">Average ticket ${info("Revenue divided by the number of completed checkouts in this range.")}</p>
        <p class="reports-metric__value">${escapeHtml(revenue.formattedAverage)}</p>
      </article>`;
  }

  function renderStaffTable(rows: ReportsPayload["appointmentsByStaff"]) {
    if (!staffTable) return;
    if (rows.length === 0) {
      staffTable.innerHTML = stateMarkup(
        "empty",
        "No activity for this period",
        "Booked, completed, and cancelled appointments will appear here. Try a wider range.",
      );
      return;
    }
    staffTable.innerHTML = `
      <table class="team-data-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th class="num">Total</th>
            <th class="num">Completed</th>
            <th class="num">Upcoming</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              <td>${escapeHtml(row.staffName)}</td>
              <td class="num">${row.total}</td>
              <td class="num">${row.completed}</td>
              <td class="num">${row.upcoming}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p class="reports-metric__meta" style="margin-top:0.6rem">
        Upcoming = booked, confirmed, or arrived — not yet completed or cancelled.
      </p>`;
  }

  function renderCancellations(stats: ReportsPayload["cancellations"]) {
    if (!cancelEl) return;
    if (stats.scheduledTotal === 0) {
      cancelEl.innerHTML = stateMarkup(
        "empty",
        "No activity for this period",
        "Cancellation and no-show rates appear once appointments are booked.",
      );
      return;
    }
    cancelEl.innerHTML = `
      <div class="reports-cancel-row">
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
      </div>`;
  }

  function renderStatus(stats: ReportsPayload["appointmentStatus"]) {
    if (!statusEl) return;
    if (stats.total === 0) {
      statusEl.innerHTML = stateMarkup(
        "empty",
        "No activity for this period",
        "The status breakdown appears once appointments are booked.",
      );
      return;
    }
    statusEl.innerHTML = `
      <div class="team-data-table-wrap">
        <table class="team-data-table">
          <thead>
            <tr><th>Status</th><th class="num">Count</th><th class="num">Share</th></tr>
          </thead>
          <tbody>
            ${stats.byStatus
              .map((row) => {
                const share = stats.total > 0 ? Math.round((row.count / stats.total) * 100) : 0;
                const label = row.status.replace(/_/g, " ");
                return `
              <tr>
                <td style="text-transform:capitalize">${escapeHtml(label)}</td>
                <td class="num">${row.count}</td>
                <td class="num">${share}%</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderInventory(inventory: ReportsPayload["inventory"]) {
    if (!inventoryEl) return;
    if (inventory.totalProducts === 0) {
      inventoryEl.innerHTML = stateMarkup(
        "not-configured",
        "Inventory isn't set up yet",
        "Add products in Stock to track low-stock alerts here.",
      );
      return;
    }
    if (inventory.lowStockCount === 0) {
      inventoryEl.innerHTML = stateMarkup(
        "empty",
        "Everything is stocked",
        "No products are at or below their reorder threshold for this salon.",
      );
      return;
    }
    inventoryEl.innerHTML = `
      <p class="reports-metric__meta" style="margin-bottom:0.75rem">
        ${inventory.lowStockCount} of ${inventory.totalProducts} products need attention
        · <a href="${escapeHtml(inventoryUrl)}?lowStock=1">View in Stock</a>
      </p>
      <div class="team-data-table-wrap">
        <table class="team-data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th class="num">On hand</th>
              <th class="num">Reorder at</th>
            </tr>
          </thead>
          <tbody>
            ${inventory.items
              .map(
                (item) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(formatCategoryLabel(item.category))}</td>
                <td class="num">${escapeHtml(formatQuantity(item.quantity, item.unit))}</td>
                <td class="num">${item.reorderThreshold}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  function setRefreshed() {
    if (!refreshedLabel) return;
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: SALON_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
    refreshedLabel.textContent = `· Updated ${time}`;
  }

  async function loadReports() {
    const { from, to } = currentRange();
    if (rangeLabel && from && to) {
      rangeLabel.textContent = formatReportRangeLabel({ fromDate: from, toDate: to });
    }
    showLoading();
    try {
      const res = await fetch(buildUrl());
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to load reports");
      }
      const reports = body.reports as ReportsPayload;
      lastPayload = reports;
      if (rangeLabel) rangeLabel.textContent = reports.range.label;
      renderRevenue(reports.revenue);
      renderStaffTable(reports.appointmentsByStaff);
      renderCancellations(reports.cancellations);
      renderStatus(reports.appointmentStatus);
      renderInventory(reports.inventory);
      setRefreshed();
      updateExportButton();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load reports");
    }
  }

  // --- CSV export (client-side, section-specific) --------------------------
  function csvCell(value: string | number) {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  }

  function sectionCsv(section: ExportSection, p: ReportsPayload): string {
    const lines: string[] = [];
    lines.push("Salon Citrine Team Reports");
    lines.push(`Period,${p.range.fromDate},${p.range.toDate}`);
    lines.push(`Note,"${REVENUE_DEFINITION.replaceAll('"', '""')}"`);
    lines.push("");

    const revenue = () => {
      lines.push("Revenue Summary");
      lines.push("Metric,Value");
      lines.push(`Completed checkouts,${p.revenue.orderCount}`);
      lines.push(`Total revenue,${p.revenue.totalCents / 100}`);
      lines.push(`Tips,${p.revenue.tipCents / 100}`);
      lines.push(`Average ticket,${p.revenue.averageOrderCents / 100}`);
    };
    const appointments = () => {
      lines.push("Appointments by staff");
      lines.push("Staff,Total,Completed,Upcoming");
      for (const row of p.appointmentsByStaff) {
        lines.push(`${csvCell(row.staffName)},${row.total},${row.completed},${row.upcoming}`);
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
      lines.push("");
      lines.push("Appointment status");
      lines.push("Status,Count");
      for (const row of p.appointmentStatus.byStatus) {
        lines.push(`${csvCell(row.status.replace(/_/g, " "))},${row.count}`);
      }
    };
    const inventory = () => {
      lines.push("Low stock inventory");
      lines.push("Product,Category,On hand,Reorder at");
      for (const item of p.inventory.items) {
        lines.push(
          `${csvCell(item.name)},${csvCell(formatCategoryLabel(item.category))},${csvCell(formatQuantity(item.quantity, item.unit))},${item.reorderThreshold}`,
        );
      }
    };

    if (section === "revenue") revenue();
    else if (section === "appointments") appointments();
    else if (section === "cancellations") cancellations();
    else if (section === "inventory") inventory();
    else {
      revenue();
      lines.push("");
      appointments();
      lines.push("");
      cancellations();
      lines.push("");
      inventory();
    }
    return lines.join("\n");
  }

  function downloadCsv(section: ExportSection) {
    if (!lastPayload) return;
    const suffix = reportRangeFilenameSuffix({
      fromDate: lastPayload.range.fromDate,
      toDate: lastPayload.range.toDate,
    });
    const name = section === "all" ? "report" : section;
    const filename = `salon-citrine-${name}_${suffix}.csv`;
    const csv = sectionCsv(section, lastPayload);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(EXPORT_TOAST[section], "success");
  }

  // --- scroll-spy nav ------------------------------------------------------
  function setupScrollSpy() {
    const sections = navLinks
      .map((link) => document.getElementById(link.dataset.navLink ?? ""))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const visible = new Set<string>();

    const setActive = (id: string) => {
      const tab = tabBtns.find((btn) => btn.dataset.reportTab === id);
      const exportKey = (tab?.dataset.exportKey ?? "revenue") as ExportSection;
      setActiveSection(id as ReportSectionId, exportKey);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const firstVisible = sections.find((s) => visible.has(s.id));
        if (firstVisible) setActive(firstVisible.id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    setActive(sections[0]!.id);

    for (const link of navLinks) {
      link.addEventListener("click", () => {
        setActive(link.dataset.navLink ?? "");
      });
    }
  }

  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.reportTab ?? "reports-overview";
      const exportKey = (btn.dataset.exportKey ?? "revenue") as ExportSection;
      setActiveSection(id as ReportSectionId, exportKey);
    });
  }

  mobileMq.addEventListener("change", () => {
    setActiveSection(activeSectionId, activeExportKey);
  });

  // --- wire up -------------------------------------------------------------
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

  exportBtn?.addEventListener("click", () => {
    if (!lastPayload || exportBtn.disabled) return;
    downloadCsv(activeExportKey);
  });

  setupScrollSpy();
  setActiveSection("reports-overview", "revenue");
  void loadReports();
}

document.querySelectorAll<HTMLElement>("[data-reports-app]").forEach(initReports);
