import {
  formatCategoryLabel,
  formatQty,
  formatQuantity,
} from "@saloncitrine/shared";
import { startBarcodeScanner } from "./barcode-scanner";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category: string | null;
  unit: string;
  reorderThreshold: number;
  quantity: number;
  isLowStock: boolean;
  imageUrl: string | null;
  retailPriceCents: number | null;
  notes: string | null;
};

type ProductCategoryGroup = {
  name: string;
  products: Product[];
  lowStockCount: number;
};

type Transaction = {
  id: string;
  type: string;
  quantityChange: number;
  quantityAfter: number;
  staffName?: string;
  notes: string | null;
  createdAt: string;
};

type TransactionType = "receive" | "use" | "adjust" | "count";
type ViewMode = "grid" | "table";
type SortMode = "name" | "name-desc" | "stock-asc" | "stock-desc" | "low" | "category";

const VIEW_KEY = "stock:view";
const GROUP_KEY = "stock:group";
const SORT_KEY = "stock:sort";

function apiUrl(path: string) {
  const base = document.body.dataset.apiBase ?? "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((word) => word.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

function formatPrice(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function transactionLabel(type: string, change: number) {
  const abs = Math.abs(change);
  if (type === "receive") return `+${formatQty(abs)} received`;
  if (type === "use") return `−${formatQty(abs)} used`;
  if (type === "count") return `Count set (${formatQty(change >= 0 ? change : abs)} Δ)`;
  return `${change >= 0 ? "+" : "−"}${formatQty(abs)} adjusted`;
}

function statusMeta(product: Product) {
  if (product.quantity <= 0) return { label: "Out of stock", short: "Out", cls: "out" };
  if (product.isLowStock) return { label: "Low stock", short: "Low", cls: "low" };
  return { label: "In stock", short: "In stock", cls: "in" };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;");
}

const MENU_ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>`;

function initInventory(root: HTMLElement) {
  const isManager = root.dataset.isManager === "1";
  const listEl = root.querySelector<HTMLElement>("[data-product-list]");
  const searchInput = root.querySelector<HTMLInputElement>("[data-search]");
  const categoryFilters = root.querySelectorAll<HTMLInputElement>("[data-filter-category]");
  const brandFilters = root.querySelectorAll<HTMLInputElement>("[data-filter-brand]");
  const stockFilters = root.querySelectorAll<HTMLInputElement>("[data-filter-stock]");
  const minPriceInput = root.querySelector<HTMLInputElement>("[data-filter-min-price]");
  const maxPriceInput = root.querySelector<HTMLInputElement>("[data-filter-max-price]");
  const clearFiltersBtn = root.querySelector<HTMLButtonElement>("[data-clear-filters-btn]");
  const lowStockEl = root.querySelector<HTMLElement>("[data-low-stock-banner]");
  const statusEl = root.querySelector<HTMLElement>("[data-status]");
  const totalEl = root.querySelector<HTMLElement>("[data-total-count]");
  const lowStockCountEl = root.querySelector<HTMLElement>("[data-low-stock-count]");
  const filterCountEl = root.querySelector<HTMLElement>("[data-filter-count]");
  const sortSelect = root.querySelector<HTMLSelectElement>("[data-sort]");
  const viewButtons = root.querySelectorAll<HTMLButtonElement>("[data-view]");
  const groupToggle = root.querySelector<HTMLButtonElement>("[data-group-toggle]");
  const toast = document.querySelector<HTMLElement>("[data-toast]");

  const scanModal = root.querySelector<HTMLElement>("[data-scan-modal]");
  const scanVideo = root.querySelector<HTMLVideoElement>("[data-scan-video]");
  const scanError = root.querySelector<HTMLElement>("[data-scan-error]");
  const manualBarcodeInput = root.querySelector<HTMLInputElement>("[data-manual-barcode]");

  const txModal = root.querySelector<HTMLElement>("[data-tx-modal]");
  const txTitle = root.querySelector<HTMLElement>("[data-tx-title]");
  const txQtyInput = root.querySelector<HTMLInputElement>("[data-tx-qty]");
  const txNotes = root.querySelector<HTMLTextAreaElement>("[data-tx-notes]");

  const addModal = root.querySelector<HTMLElement>("[data-add-modal]");
  const addForm = root.querySelector<HTMLFormElement>("[data-add-form]");
  const editModal = root.querySelector<HTMLElement>("[data-edit-modal]");
  const editForm = root.querySelector<HTMLFormElement>("[data-edit-form]");

  const detailModal = root.querySelector<HTMLElement>("[data-detail-modal]");
  const detailBody = root.querySelector<HTMLElement>("[data-detail-body]");
  const detailTitle = root.querySelector<HTMLElement>("[data-detail-title]");

  let products: Product[] = [];
  let categories: ProductCategoryGroup[] = [];
  let selectedProduct: Product | null = null;
  let detailProductId: string | null = null;
  let pendingTxType: TransactionType | null = null;
  let scanner: { stop: () => void } | null = null;
  let searchTimer: number | undefined;
  let toastTimer: number | undefined;
  let scanCheckInMode = false;
  let txFromScan = false;
  let totalCount = 0;
  let lowStockCount = 0;

  const readStored = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const writeStored = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore quota / privacy mode */
    }
  };

  let viewMode: ViewMode = readStored(VIEW_KEY) === "table" ? "table" : "grid";
  let groupByCategory = readStored(GROUP_KEY) === "1";
  const storedSort = readStored(SORT_KEY) as SortMode | null;
  let sortMode: SortMode =
    storedSort &&
    ["name", "name-desc", "stock-asc", "stock-desc", "low", "category"].includes(storedSort)
      ? storedSort
      : "name";

  function setStatus(message: string, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = !message;
    statusEl.classList.toggle("team-list-layout__notice--error", isError);
  }

  function showToast(message: string) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  }

  function getSidebarFilters() {
    const category =
      root.querySelector<HTMLInputElement>("[data-filter-category]:checked")?.value?.trim() ?? "";
    const brand =
      root.querySelector<HTMLInputElement>("[data-filter-brand]:checked")?.value?.trim() ?? "";
    const stockLevel =
      root.querySelector<HTMLInputElement>("[data-filter-stock]:checked")?.value?.trim() ?? "";
    const minPrice = minPriceInput?.value.trim() ?? "";
    const maxPrice = maxPriceInput?.value.trim() ?? "";
    return { category, brand, stockLevel, minPrice, maxPrice };
  }

  function countActiveFilters() {
    const { category, brand, stockLevel, minPrice, maxPrice } = getSidebarFilters();
    let count = 0;
    if (category) count += 1;
    if (brand) count += 1;
    if (stockLevel) count += 1;
    if (minPrice) count += 1;
    if (maxPrice) count += 1;
    return count;
  }

  function updateFilterCount(showToastOnChange = false) {
    const count = countActiveFilters();
    if (filterCountEl) {
      filterCountEl.textContent = String(count);
      filterCountEl.closest("[data-filter-stats]")?.classList.toggle(
        "stock-page__filter-stats--active",
        count > 0,
      );
    }
    if (clearFiltersBtn) {
      const hasSearch = Boolean(searchInput?.value.trim());
      clearFiltersBtn.disabled = count === 0 && !hasSearch;
    }
    if (showToastOnChange) {
      showToast(
        count === 0
          ? "Filters cleared"
          : count === 1
            ? "1 filter applied"
            : `${count} filters applied`,
      );
    }
  }

  function openModal(modal: HTMLElement | null) {
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
    document.body.classList.add("inventory-modal-open");
  }

  function closeModal(modal: HTMLElement | null) {
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("is-open");
    if (!document.querySelector(".inventory-modal.is-open")) {
      document.body.classList.remove("inventory-modal-open");
    }
  }

  function closeAllModals() {
    closeModal(scanModal);
    closeModal(txModal);
    closeModal(addModal);
    closeModal(editModal);
    closeModal(detailModal);
    detailProductId = null;
    scanCheckInMode = false;
    stopScanner();
  }

  function stopScanner() {
    scanner?.stop();
    scanner = null;
    if (scanError) scanError.textContent = "";
  }

  async function fetchProducts(query = "") {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const { category, brand, stockLevel, minPrice, maxPrice } = getSidebarFilters();
    if (category) params.set("category", category);
    if (brand) params.set("brand", brand);
    if (stockLevel === "low") params.set("stockLevel", "low");
    else if (stockLevel === "in") params.set("stockLevel", "in");
    else if (stockLevel === "out") params.set("stockLevel", "out");
    if (minPrice) params.set("minPrice", String(Math.round(Number(minPrice) * 100)));
    if (maxPrice) params.set("maxPrice", String(Math.round(Number(maxPrice) * 100)));
    const res = await fetch(apiUrl(`/api/inventory/products?${params}`));
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Failed to load products");
    }
    products = data.products as Product[];
    categories = data.categories as ProductCategoryGroup[];
    totalCount = products.length;
    lowStockCount = data.lowStockCount as number;

    if (totalEl) totalEl.textContent = String(totalCount);
    if (lowStockCountEl) lowStockCountEl.textContent = String(lowStockCount);
    updateFilterCount();

    renderProducts();
    renderLowStockAlert(stockLevel === "low");

    if (detailProductId) {
      const updated = products.find((p) => p.id === detailProductId);
      if (updated) renderDetail(updated);
      else closeModal(detailModal);
    }
  }

  function renderLowStockAlert(showingLowStock: boolean) {
    if (!lowStockEl) return;
    lowStockEl.hidden = lowStockCount === 0 || showingLowStock;
    if (lowStockCount > 0 && !showingLowStock) {
      lowStockEl.classList.add("team-list-layout__notice--actionable");
      lowStockEl.innerHTML = `
        <span class="stock-alert__text">${lowStockCount} product${lowStockCount === 1 ? "" : "s"} need${lowStockCount === 1 ? "s" : ""} restocking</span>
        <button type="button" class="stock-alert__view" data-low-stock-view>View</button>`;
      lowStockEl
        .querySelector<HTMLButtonElement>("[data-low-stock-view]")
        ?.addEventListener("click", () => {
          const lowRadio = root.querySelector<HTMLInputElement>(
            '[data-filter-stock][value="low"]',
          );
          if (lowRadio) {
            lowRadio.checked = true;
            updateFilterCount();
            void fetchProducts(searchInput?.value ?? "");
          }
        });
    } else {
      lowStockEl.classList.remove("team-list-layout__notice--actionable");
      lowStockEl.textContent = "";
    }
  }

  function sortProducts(list: Product[]) {
    const copy = [...list];
    switch (sortMode) {
      case "name-desc":
        return copy.sort((a, b) => b.name.localeCompare(a.name));
      case "stock-asc":
        return copy.sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));
      case "stock-desc":
        return copy.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
      case "low": {
        const rank = (p: Product) => (p.quantity <= 0 ? 0 : p.isLowStock ? 1 : 2);
        return copy.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
      }
      case "category":
        return copy.sort(
          (a, b) =>
            formatCategoryLabel(a.category).localeCompare(formatCategoryLabel(b.category)) ||
            a.name.localeCompare(b.name),
        );
      default:
        return copy.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  function renderThumb(product: Product, variant: "sm" | "lg") {
    const fallback = `
      <span class="stock-thumb__fallback">
        <span class="stock-thumb__initials">${escapeHtml(initials(product.name))}</span>
        <span class="stock-thumb__cat">${escapeHtml(formatCategoryLabel(product.category))}</span>
      </span>`;
    const img = product.imageUrl
      ? `<img class="stock-thumb__img" src="${escapeAttr(product.imageUrl)}" alt="" loading="lazy" data-thumb-img />`
      : "";
    return `<span class="stock-thumb stock-thumb--${variant}${product.imageUrl ? "" : " is-empty"}">${fallback}${img}</span>`;
  }

  function renderStatusPill(product: Product) {
    const meta = statusMeta(product);
    return `<span class="stock-status stock-status--${meta.cls}">${meta.short}</span>`;
  }

  function renderReorder(product: Product) {
    if (product.reorderThreshold > 0) {
      return `Reorder at ${formatQty(product.reorderThreshold)}`;
    }
    return "No reorder alert";
  }

  function renderMenu(product: Product) {
    const editItem = isManager
      ? `<button type="button" class="stock-menu__item" data-menu-action="edit" data-product-id="${product.id}">Edit product</button>`
      : "";
    return `
      <details class="stock-menu">
        <summary class="stock-menu__btn" aria-label="Product actions">${MENU_ICON}</summary>
        <div class="stock-menu__list">
          <button type="button" class="stock-menu__item" data-menu-action="receive" data-product-id="${product.id}">Restock</button>
          <button type="button" class="stock-menu__item" data-menu-action="use" data-product-id="${product.id}">Use</button>
          <button type="button" class="stock-menu__item" data-menu-action="adjust" data-product-id="${product.id}">Adjust</button>
          <button type="button" class="stock-menu__item" data-menu-action="count" data-product-id="${product.id}">Set count</button>
          ${editItem}
        </div>
      </details>`;
  }

  function renderGridCard(product: Product) {
    const meta = statusMeta(product);
    const sub = [product.brand, formatCategoryLabel(product.category)].filter(Boolean).join(" · ");
    const qtyLabel =
      product.quantity <= 0 ? "Out of stock" : formatQuantity(product.quantity, product.unit);
    return `
      <article class="stock-card stock-card--${meta.cls}" data-product-card="${product.id}" tabindex="0" role="button" aria-label="${escapeAttr(product.name)}">
        ${renderThumb(product, "sm")}
        <div class="stock-card__info">
          <p class="stock-card__name">${escapeHtml(product.name)}</p>
          <p class="stock-card__sub">${escapeHtml(sub || "—")}</p>
          <p class="stock-card__sku">${product.sku ? `SKU ${escapeHtml(product.sku)}` : "No SKU"}</p>
          <div class="stock-card__foot">
            <span class="stock-qty stock-qty--${meta.cls}">${escapeHtml(qtyLabel)}</span>
            ${renderStatusPill(product)}
          </div>
          <p class="stock-card__reorder">${escapeHtml(renderReorder(product))}</p>
        </div>
        ${renderMenu(product)}
      </article>`;
  }

  function renderGrid(list: Product[]) {
    return `<div class="stock-grid">${list.map(renderGridCard).join("")}</div>`;
  }

  function renderTableRow(product: Product) {
    const meta = statusMeta(product);
    const qtyLabel =
      product.quantity <= 0 ? "Out of stock" : formatQuantity(product.quantity, product.unit);
    return `
      <tr class="stock-row stock-row--${meta.cls}" data-product-card="${product.id}">
        <td class="stock-row__product">
          ${renderThumb(product, "sm")}
          <span class="stock-row__name">${escapeHtml(product.name)}</span>
        </td>
        <td>${escapeHtml(formatCategoryLabel(product.category))}</td>
        <td>${escapeHtml(product.brand ?? "—")}</td>
        <td>${product.sku ? escapeHtml(product.sku) : "—"}</td>
        <td class="stock-row__qty">${escapeHtml(qtyLabel)}</td>
        <td>${product.reorderThreshold > 0 ? formatQty(product.reorderThreshold) : "—"}</td>
        <td>${renderStatusPill(product)}</td>
        <td class="stock-row__actions">${renderMenu(product)}</td>
      </tr>`;
  }

  function renderTable(list: Product[]) {
    return `
      <div class="stock-table-wrap">
        <table class="stock-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Category</th>
              <th scope="col">Brand</th>
              <th scope="col">SKU</th>
              <th scope="col">Stock</th>
              <th scope="col">Reorder</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="stock-visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>${list.map(renderTableRow).join("")}</tbody>
        </table>
      </div>`;
  }

  function renderGroupHeading(name: string, count: number, low: number) {
    const lowLabel = low > 0 ? ` · <span class="stock-group__low">${low} low stock</span>` : "";
    return `
      <div class="stock-group__head">
        <h3 class="stock-group__title">${escapeHtml(formatCategoryLabel(name))}</h3>
        <span class="stock-group__count">${count} product${count === 1 ? "" : "s"}${lowLabel}</span>
      </div>`;
  }

  function renderProducts() {
    if (!listEl) return;

    if (products.length === 0) {
      const hasQuery = Boolean(searchInput?.value.trim()) || countActiveFilters() > 0;
      listEl.innerHTML = hasQuery
        ? `<div class="stock-page__empty">
            <p>No products match your search or filters.</p>
            <button type="button" class="team-list-layout__btn-secondary" data-clear-filters>Clear search &amp; filters</button>
          </div>`
        : `<div class="stock-page__empty">
            <p>No products yet.${isManager ? " Add your first product or scan a barcode to get started." : " Ask a manager to add products, or scan a barcode to check items in."}</p>
          </div>`;
      listEl
        .querySelector<HTMLButtonElement>("[data-clear-filters]")
        ?.addEventListener("click", resetFilters);
      return;
    }

    if (groupByCategory) {
      listEl.innerHTML = categories
        .map((group) => {
          const sorted = sortProducts(group.products);
          const inner = viewMode === "table" ? renderTable(sorted) : renderGrid(sorted);
          return `<section class="stock-group">${renderGroupHeading(group.name, group.products.length, group.lowStockCount)}${inner}</section>`;
        })
        .join("");
    } else {
      const sorted = sortProducts(products);
      listEl.innerHTML = viewMode === "table" ? renderTable(sorted) : renderGrid(sorted);
    }

    bindThumbFallbacks();
  }

  function bindThumbFallbacks() {
    listEl?.querySelectorAll<HTMLImageElement>("[data-thumb-img]").forEach((img) => {
      const thumb = img.closest(".stock-thumb");
      img.addEventListener("load", () => thumb?.classList.add("is-loaded"));
      img.addEventListener("error", () => thumb?.classList.add("is-broken"));
      if (img.complete && img.naturalWidth === 0) {
        thumb?.classList.add("is-broken");
      } else if (img.complete) {
        thumb?.classList.add("is-loaded");
      }
    });
  }

  function closeMenus(except?: Element | null) {
    listEl?.querySelectorAll<HTMLDetailsElement>("details.stock-menu[open]").forEach((menu) => {
      if (menu !== except) menu.open = false;
    });
  }

  function handleMenuAction(action: string, productId: string | undefined) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (action === "edit") {
      openEditModal(product);
    } else {
      openTransactionModal(action as TransactionType, product);
    }
  }

  function openDetail(productId: string | undefined) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    selectedProduct = product;
    detailProductId = product.id;
    renderDetail(product);
    openModal(detailModal);
    window.requestAnimationFrame(() => void loadHistory(product.id));
  }

  function renderDetail(product: Product) {
    if (!detailBody) return;
    if (detailTitle) detailTitle.textContent = product.name;
    const meta = statusMeta(product);
    const qtyLabel =
      product.quantity <= 0 ? "Out of stock" : formatQuantity(product.quantity, product.unit);

    const detailItems = [
      { label: "Brand", value: product.brand ?? "—" },
      { label: "Category", value: formatCategoryLabel(product.category) },
      { label: "SKU", value: product.sku ?? "—" },
      { label: "Barcode", value: product.barcode ?? "—" },
      { label: "Retail price", value: formatPrice(product.retailPriceCents) },
      {
        label: "Reorder at",
        value:
          product.reorderThreshold > 0
            ? formatQuantity(product.reorderThreshold, product.unit)
            : "No alert set",
      },
    ];

    const notesBlock = product.notes
      ? `<p class="stock-detail__notes">${escapeHtml(product.notes)}</p>`
      : "";
    const editBtn = isManager
      ? `<button type="button" class="team-list-layout__btn-secondary" data-menu-action="edit" data-product-id="${product.id}">Edit product</button>`
      : "";

    detailBody.innerHTML = `
      <div class="stock-detail__top">
        ${renderThumb(product, "lg")}
        <div class="stock-detail__headline">
          <div class="stock-detail__qty-row">
            <span class="stock-qty stock-qty--${meta.cls} stock-qty--lg">${escapeHtml(qtyLabel)}</span>
            ${renderStatusPill(product)}
          </div>
          <p class="stock-detail__reorder">${escapeHtml(renderReorder(product))}</p>
        </div>
      </div>
      <dl class="stock-detail__grid">
        ${detailItems
          .map(
            (item) => `
          <div class="stock-detail__item">
            <dt>${item.label}</dt>
            <dd>${escapeHtml(item.value)}</dd>
          </div>`,
          )
          .join("")}
      </dl>
      ${notesBlock}
      <div class="stock-detail__actions">
        <button type="button" class="team-list-layout__btn-primary" data-menu-action="receive" data-product-id="${product.id}">Restock</button>
        <button type="button" class="team-list-layout__btn-secondary" data-menu-action="use" data-product-id="${product.id}">Use</button>
        <button type="button" class="team-list-layout__btn-secondary" data-menu-action="adjust" data-product-id="${product.id}">Adjust</button>
        <button type="button" class="team-list-layout__btn-secondary" data-menu-action="count" data-product-id="${product.id}">Set count</button>
        ${editBtn}
      </div>
      <h4 class="stock-detail__history-title">Recent activity</h4>
      <div class="stock-detail__history" data-history="${product.id}">
        <p class="stock-detail__history-loading">Loading…</p>
      </div>`;

    detailBody.querySelectorAll<HTMLButtonElement>("[data-menu-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.menuAction;
        const id = btn.dataset.productId;
        if (action) handleMenuAction(action, id);
      });
    });

    bindThumbFallbacks();
  }

  function resetFilters() {
    if (searchInput) searchInput.value = "";
    root
      .querySelectorAll<HTMLInputElement>(
        "[data-filter-category], [data-filter-brand], [data-filter-stock]",
      )
      .forEach((input) => {
        input.checked = input.value === "";
      });
    if (minPriceInput) minPriceInput.value = "";
    if (maxPriceInput) maxPriceInput.value = "";
    updateFilterCount();
    void fetchProducts().catch((err) => {
      setStatus(err instanceof Error ? err.message : "Load failed", true);
    });
  }

  async function loadHistory(productId: string) {
    const historyEl = detailBody?.querySelector<HTMLElement>(`[data-history="${productId}"]`);
    if (!historyEl) return;

    const res = await fetch(
      apiUrl(`/api/inventory/transactions?productId=${encodeURIComponent(productId)}&limit=8`),
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      historyEl.innerHTML = '<p class="stock-detail__history-loading">Could not load history.</p>';
      return;
    }
    const rows = data.transactions as Transaction[];
    if (rows.length === 0) {
      historyEl.innerHTML = '<p class="stock-detail__history-loading">No transactions yet.</p>';
      return;
    }
    historyEl.innerHTML = rows
      .map(
        (row) => `
        <div class="stock-detail__history-row">
          <span>${escapeHtml(transactionLabel(row.type, row.quantityChange))}</span>
          <span class="stock-detail__history-meta">${escapeHtml(row.staffName ?? "Staff")} · ${formatDate(row.createdAt)}</span>
        </div>`,
      )
      .join("");
  }

  function openEditModal(product: Product) {
    if (!editForm) return;
    selectedProduct = product;
    const setField = (name: string, value: string) => {
      const input = editForm.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (input) input.value = value;
    };
    setField("name", product.name);
    setField("barcode", product.barcode ?? "");
    setField("category", product.category ?? "");
    setField("reorder_threshold", String(product.reorderThreshold));
    setField("image_url", product.imageUrl ?? "");
    openModal(editModal);
  }

  function openTransactionModal(
    type: TransactionType,
    product: Product,
    options?: { fromScan?: boolean },
  ) {
    pendingTxType = type;
    selectedProduct = product;
    txFromScan = options?.fromScan ?? false;

    if (txTitle) {
      const labels: Record<TransactionType, string> = {
        receive: txFromScan ? "Check in" : "Restock",
        use: "Log use",
        adjust: "Adjust quantity",
        count: "Set count",
      };
      txTitle.textContent = `${labels[type]} — ${product.name}`;
    }
    if (txQtyInput) {
      if (type === "count") {
        txQtyInput.value = String(product.quantity);
        txQtyInput.min = "0";
        txQtyInput.step = "any";
      } else if (type === "use" || type === "receive") {
        txQtyInput.value = "1";
        txQtyInput.min = "0.01";
        txQtyInput.step = "any";
      } else {
        txQtyInput.value = "0";
        txQtyInput.step = "any";
      }
    }
    if (txNotes) txNotes.value = "";
    openModal(txModal);
    window.requestAnimationFrame(() => txQtyInput?.focus());
  }

  async function submitTransaction() {
    if (!selectedProduct || !pendingTxType || !txQtyInput) return;
    const qty = Number(txQtyInput.value);
    const notes = txNotes?.value.trim() ?? "";

    const body: Record<string, unknown> = {
      product_id: selectedProduct.id,
      type: pendingTxType,
      notes: notes || undefined,
    };

    if (pendingTxType === "count") {
      body.count = qty;
    } else if (pendingTxType === "adjust") {
      body.quantity_change = qty;
    } else {
      body.quantity = qty;
    }

    const res = await fetch(apiUrl("/api/inventory/transactions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatus(data.error ?? "Transaction failed", true);
      return;
    }

    const product = selectedProduct;
    const txType = pendingTxType;
    const qtyCheckedIn = qty;
    const keepScanning = txFromScan && txType === "receive";

    closeModal(txModal);
    pendingTxType = null;
    txFromScan = false;

    await fetchProducts(searchInput?.value ?? "");

    if (keepScanning && product) {
      setStatus(
        `Checked in ${formatQuantity(qtyCheckedIn, product.unit)} of ${product.name}. Scan the next item.`,
      );
      void openScanner();
      return;
    }

    showToast(txType === "receive" ? "Stock checked in." : "Stock updated.");
  }

  async function lookupBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    const res = await fetch(
      apiUrl(`/api/inventory/products/by-barcode?code=${encodeURIComponent(trimmed)}`),
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatus(data.error ?? "Lookup failed", true);
      return;
    }

    closeModal(scanModal);
    stopScanner();

    if (data.product) {
      openTransactionModal("receive", data.product as Product, {
        fromScan: scanCheckInMode,
      });
      return;
    }

    setStatus(
      `Product not found for code “${trimmed}”. Search below or ask a manager to add it.`,
      true,
    );
    searchInput?.focus();
    if (isManager && addModal && addForm) {
      const barcodeField = addForm.querySelector<HTMLInputElement>('input[name="barcode"]');
      if (barcodeField) barcodeField.value = trimmed;
      openModal(addModal);
    }
  }

  async function openScanner() {
    if (!scanModal || !scanVideo) return;
    scanCheckInMode = true;
    openModal(scanModal);
    if (scanError) scanError.textContent = "";
    if (manualBarcodeInput) manualBarcodeInput.value = "";

    scanner = await startBarcodeScanner(
      scanVideo,
      (code) => void lookupBarcode(code),
      (message) => {
        if (scanError) scanError.textContent = message;
      },
    );
  }

  function setView(next: ViewMode) {
    viewMode = next;
    writeStored(VIEW_KEY, next);
    viewButtons.forEach((btn) => {
      const active = btn.dataset.view === next;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderProducts();
  }

  function setGroup(next: boolean) {
    groupByCategory = next;
    writeStored(GROUP_KEY, next ? "1" : "0");
    if (groupToggle) {
      groupToggle.classList.toggle("is-active", next);
      groupToggle.setAttribute("aria-pressed", next ? "true" : "false");
    }
    renderProducts();
  }

  // ---- Event wiring ----------------------------------------------------------

  listEl?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>("[data-menu-action]");
    if (actionEl) {
      event.preventDefault();
      handleMenuAction(actionEl.dataset.menuAction ?? "", actionEl.dataset.productId);
      closeMenus();
      return;
    }
    if (target.closest("details.stock-menu")) {
      closeMenus(target.closest("details.stock-menu"));
      return;
    }
    const clearBtn = target.closest("[data-clear-filters]");
    if (clearBtn) return;
    const card = target.closest<HTMLElement>("[data-product-card]");
    if (card) openDetail(card.dataset.productCard);
  });

  listEl?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target as HTMLElement;
    if (target.closest("details.stock-menu") || target.closest("[data-menu-action]")) return;
    const card = target.closest<HTMLElement>('.stock-card[data-product-card]');
    if (card && target === card) {
      event.preventDefault();
      openDetail(card.dataset.productCard);
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target as HTMLElement).closest("details.stock-menu")) {
      closeMenus();
    }
  });

  sortSelect?.addEventListener("change", () => {
    sortMode = sortSelect.value as SortMode;
    writeStored(SORT_KEY, sortMode);
    renderProducts();
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view === "table" ? "table" : "grid"));
  });

  groupToggle?.addEventListener("click", () => setGroup(!groupByCategory));

  clearFiltersBtn?.addEventListener("click", resetFilters);

  root.querySelectorAll("[data-scan-open]").forEach((el) => {
    el.addEventListener("click", () => void openScanner());
  });

  root.querySelector("[data-add-open]")?.addEventListener("click", () => {
    addForm?.reset();
    openModal(addModal);
  });

  root.querySelectorAll("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = (btn as HTMLElement).dataset.modalClose;
      if (target === "scan") {
        scanCheckInMode = false;
        closeModal(scanModal);
        stopScanner();
      } else if (target === "tx") closeModal(txModal);
      else if (target === "add") closeModal(addModal);
      else if (target === "edit") closeModal(editModal);
      else if (target === "detail") {
        closeModal(detailModal);
        detailProductId = null;
      } else closeAllModals();
    });
  });

  root.querySelector("[data-tx-submit]")?.addEventListener("click", () => {
    void submitTransaction();
  });

  root.querySelector("[data-manual-barcode-submit]")?.addEventListener("click", () => {
    void lookupBarcode(manualBarcodeInput?.value ?? "");
  });

  addForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      const formData = new FormData(addForm);
      const payload = {
        name: String(formData.get("name") ?? "").trim(),
        barcode: String(formData.get("barcode") ?? "").trim() || undefined,
        brand: String(formData.get("brand") ?? "").trim() || undefined,
        category: String(formData.get("category") ?? "").trim() || undefined,
        unit: String(formData.get("unit") ?? "each").trim() || "each",
        reorder_threshold: Number(formData.get("reorder_threshold") ?? 0),
        image_url: String(formData.get("image_url") ?? "").trim() || undefined,
        initial_quantity: Number(formData.get("initial_quantity") ?? 0),
        notes: String(formData.get("notes") ?? "").trim() || undefined,
      };

      const res = await fetch(apiUrl("/api/inventory/products"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? "Could not create product", true);
        return;
      }

      closeModal(addModal);
      showToast("Product added.");
      await fetchProducts(searchInput?.value ?? "");
    })();
  });

  editForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      if (!selectedProduct) return;
      const formData = new FormData(editForm);
      const payload = {
        name: String(formData.get("name") ?? "").trim(),
        barcode: String(formData.get("barcode") ?? "").trim() || null,
        category: String(formData.get("category") ?? "").trim() || null,
        reorder_threshold: Number(formData.get("reorder_threshold") ?? 0),
        image_url: String(formData.get("image_url") ?? "").trim() || null,
      };

      const res = await fetch(apiUrl(`/api/inventory/products/${selectedProduct.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? "Could not update product", true);
        return;
      }

      closeModal(editModal);
      showToast("Product updated.");
      await fetchProducts(searchInput?.value ?? "");
    })();
  });

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    updateFilterCount();
    searchTimer = window.setTimeout(() => {
      void fetchProducts(searchInput.value).catch((err) => {
        setStatus(err instanceof Error ? err.message : "Load failed", true);
      });
    }, 250);
  });

  function scheduleFetch() {
    updateFilterCount(true);
    void fetchProducts(searchInput?.value ?? "").catch((err) => {
      setStatus(err instanceof Error ? err.message : "Load failed", true);
    });
  }

  categoryFilters.forEach((el) => el.addEventListener("change", scheduleFetch));
  brandFilters.forEach((el) => el.addEventListener("change", scheduleFetch));
  stockFilters.forEach((el) => el.addEventListener("change", scheduleFetch));
  minPriceInput?.addEventListener("change", scheduleFetch);
  maxPriceInput?.addEventListener("change", scheduleFetch);

  root.closest(".team-list-layout")?.addEventListener("team-filters-restored", scheduleFetch);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".inventory-modal.is-open")) {
      closeAllModals();
    }
  });

  // ---- Initial state ---------------------------------------------------------

  if (sortSelect) sortSelect.value = sortMode;
  setView(viewMode);
  setGroup(groupByCategory);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("lowStock") === "1") {
    const lowRadio = root.querySelector<HTMLInputElement>('[data-filter-stock][value="low"]');
    if (lowRadio) {
      lowRadio.checked = true;
      updateFilterCount();
    }
  }

  void fetchProducts().catch((err) => {
    setStatus(err instanceof Error ? err.message : "Load failed", true);
  });
}

document.querySelectorAll<HTMLElement>("[data-inventory-root]").forEach(initInventory);
