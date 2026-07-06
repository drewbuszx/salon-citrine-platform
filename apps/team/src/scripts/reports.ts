type ReportsPayload = {
  range: { from: string; to: string };
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
    booked: number;
  }>;
  cancellations: {
    total: number;
    cancelled: number;
    noShow: number;
    completed: number;
    cancellationRate: number;
    noShowRate: number;
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

function formatRangeLabel(from: string, to: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(new Date(from))} – ${fmt.format(new Date(to))}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initReports(root: HTMLElement) {
  const apiBase = root.dataset.apiBase ?? "";
  const inventoryUrl = root.dataset.inventoryUrl ?? "/inventory";
  const fromInput = root.querySelector<HTMLInputElement>("[data-range-from]");
  const toInput = root.querySelector<HTMLInputElement>("[data-range-to]");
  const applyBtn = root.querySelector<HTMLButtonElement>("[data-range-apply]");
  const exportBtn = root.querySelector<HTMLButtonElement>("[data-export-csv]");
  const errorEl = root.querySelector<HTMLElement>("[data-reports-error]");
  const rangeLabel = root.querySelector<HTMLElement>("[data-range-label]");
  const revenueEl = root.querySelector<HTMLElement>("[data-revenue-stats]");
  const staffTable = root.querySelector<HTMLElement>("[data-staff-table]");
  const cancelEl = root.querySelector<HTMLElement>("[data-cancel-stats]");
  const inventoryEl = root.querySelector<HTMLElement>("[data-inventory-stats]");

  function showLoadingSkeleton() {
    const skeleton = `
      <div class="team-stat-grid">
        ${Array.from({ length: 4 }, () => '<article class="team-stat-card skeleton skeleton--block"></article>').join("")}
      </div>`;
    if (revenueEl) revenueEl.innerHTML = skeleton;
    if (staffTable) staffTable.innerHTML = skeleton;
    if (cancelEl) cancelEl.innerHTML = skeleton;
    if (inventoryEl) inventoryEl.innerHTML = skeleton;
  }

  function showError(message: string) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function buildUrl(format?: "csv") {
    const from = fromInput?.value ?? root.dataset.from ?? "";
    const to = toInput?.value ?? root.dataset.to ?? "";
    const params = new URLSearchParams({ from, to });
    if (format === "csv") params.set("format", "csv");
    return `${apiBase}?${params}`;
  }

  function renderRevenue(revenue: ReportsPayload["revenue"]) {
    if (!revenueEl) return;
    revenueEl.innerHTML = `
      <article class="team-stat-card">
        <p class="team-stat-card__label">Completed checkouts</p>
        <p class="team-stat-card__value">${revenue.orderCount}</p>
      </article>
      <article class="team-stat-card">
        <p class="team-stat-card__label">Revenue</p>
        <p class="team-stat-card__value">${escapeHtml(revenue.formattedTotal)}</p>
        <p class="team-stat-card__meta">Tips ${escapeHtml(revenue.formattedTips)}</p>
      </article>
      <article class="team-stat-card">
        <p class="team-stat-card__label">Average ticket</p>
        <p class="team-stat-card__value">${escapeHtml(revenue.formattedAverage)}</p>
      </article>
    `;
  }

  function renderStaffTable(rows: ReportsPayload["appointmentsByStaff"]) {
    if (!staffTable) return;
    if (rows.length === 0) {
      staffTable.innerHTML = '<p class="empty-state">No appointments in this period.</p>';
      return;
    }
    staffTable.innerHTML = `
      <table class="team-data-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th class="num">Total</th>
            <th class="num">Completed</th>
            <th class="num">Pipeline</th>
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
              <td class="num">${row.booked}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderCancellations(stats: ReportsPayload["cancellations"]) {
    if (!cancelEl) return;
    if (stats.total === 0) {
      cancelEl.innerHTML = '<p class="empty-state">No appointments in this period.</p>';
      return;
    }
    cancelEl.innerHTML = `
      <div class="reports-cancel-grid">
        <article class="team-stat-card">
          <p class="team-stat-card__label">Total</p>
          <p class="team-stat-card__value">${stats.total}</p>
        </article>
        <article class="team-stat-card">
          <p class="team-stat-card__label">Cancelled</p>
          <p class="team-stat-card__value">${stats.cancelled}</p>
        </article>
        <article class="team-stat-card">
          <p class="team-stat-card__label">No-show</p>
          <p class="team-stat-card__value">${stats.noShow}</p>
          <p class="team-stat-card__meta">${stats.noShowRate}% rate</p>
        </article>
        <article class="team-stat-card">
          <p class="team-stat-card__label">Completed</p>
          <p class="team-stat-card__value">${stats.completed}</p>
        </article>
      </div>
      <div class="team-data-table-wrap">
        <table class="team-data-table">
          <thead>
            <tr><th>Status</th><th class="num">Count</th></tr>
          </thead>
          <tbody>
            ${stats.byStatus
              .map(
                (row) => `
              <tr>
                <td>${escapeHtml(row.status.replace(/_/g, " "))}</td>
                <td class="num">${row.count}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderInventory(inventory: ReportsPayload["inventory"]) {
    if (!inventoryEl) return;
    if (inventory.lowStockCount === 0) {
      inventoryEl.innerHTML =
        '<p class="empty-state">No products are currently at or below reorder threshold.</p>';
      return;
    }
    inventoryEl.innerHTML = `
      <p class="label-meta" style="margin-bottom:0.75rem">
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
                <td>${escapeHtml(item.category)}</td>
                <td class="num">${item.quantity} ${escapeHtml(item.unit)}</td>
                <td class="num">${item.reorderThreshold}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function loadReports() {
    showError("");
    showLoadingSkeleton();
    try {
      const res = await fetch(buildUrl());
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to load reports");
      }
      const reports = body.reports as ReportsPayload;
      if (rangeLabel) {
        rangeLabel.textContent = formatRangeLabel(reports.range.from, reports.range.to);
      }
      renderRevenue(reports.revenue);
      renderStaffTable(reports.appointmentsByStaff);
      renderCancellations(reports.cancellations);
      renderInventory(reports.inventory);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load reports");
    }
  }

  applyBtn?.addEventListener("click", () => void loadReports());
  exportBtn?.addEventListener("click", () => {
    window.location.href = buildUrl("csv");
  });

  void loadReports();
}

document.querySelectorAll<HTMLElement>("[data-reports-app]").forEach(initReports);
