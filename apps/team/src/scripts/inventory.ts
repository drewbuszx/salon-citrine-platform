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

const PLACEHOLDER_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M4 9h16M9 4v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function apiUrl(path: string) {
  const base = document.body.dataset.apiBase ?? "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function initInventory(root: HTMLElement) {
  const isManager = root.dataset.isManager === "1";
  const listEl = root.querySelector<HTMLElement>("[data-product-list]");
  const searchInput = root.querySelector<HTMLInputElement>("[data-search]");
  const lowStockFilter = root.querySelector<HTMLInputElement>("[data-low-stock-filter]");
  const lowStockEl = root.querySelector<HTMLElement>("[data-low-stock-banner]");
  const statusEl = root.querySelector<HTMLElement>("[data-status]");
  const totalEl = root.querySelector<HTMLElement>("[data-total-count]");
  const lowStockCountEl = root.querySelector<HTMLElement>("[data-low-stock-count]");
  const filterCountEl = root.querySelector<HTMLElement>("[data-filter-count]");
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

  let products: Product[] = [];
  let categories: ProductCategoryGroup[] = [];
  let selectedProduct: Product | null = null;
  let expandedProductId: string | null = null;
  let pendingTxType: TransactionType | null = null;
  let scanner: { stop: () => void } | null = null;
  let searchTimer: number | undefined;
  let toastTimer: number | undefined;
  let scanCheckInMode = false;
  let txFromScan = false;
  let totalCount = 0;
  let lowStockCount = 0;

  function setStatus(message: string, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = !message;
    statusEl.classList.toggle("stock-page__notice--error", isError);
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

  function updateFilterCount() {
    if (filterCountEl) {
      filterCountEl.textContent = lowStockFilter?.checked ? "1" : "0";
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
    if (lowStockFilter?.checked) params.set("lowStockOnly", "1");
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

    if (expandedProductId && !products.some((p) => p.id === expandedProductId)) {
      expandedProductId = null;
    }

    renderProducts();

    if (lowStockEl) {
      lowStockEl.hidden = lowStockCount === 0 || Boolean(lowStockFilter?.checked);
      if (lowStockCount > 0 && !lowStockFilter?.checked) {
        lowStockEl.classList.add("stock-page__notice--actionable");
        lowStockEl.innerHTML = `
          <span>${lowStockCount === 1 ? "1 product is" : `${lowStockCount} products are`} at or below reorder threshold.</span>
          <button type="button" class="stock-page__btn-secondary" data-low-stock-view>View low stock</button>`;
        lowStockEl.querySelector<HTMLButtonElement>("[data-low-stock-view]")?.addEventListener(
          "click",
          () => {
            if (lowStockFilter) {
              lowStockFilter.checked = true;
              updateFilterCount();
              void fetchProducts(searchInput?.value ?? "");
            }
          },
        );
      } else {
        lowStockEl.classList.remove("stock-page__notice--actionable");
        lowStockEl.textContent = "";
      }
    }
  }

  function renderProductThumb(product: Product) {
    if (product.imageUrl) {
      return `<img class="stock-card__img" src="${escapeAttr(product.imageUrl)}" alt="" loading="lazy" />`;
    }
    return `<span class="stock-card__placeholder">${PLACEHOLDER_SVG}</span>`;
  }

  function renderCollapsedMeta(product: Product) {
    const parts = [
      product.sku ? `SKU ${product.sku}` : null,
      product.brand,
      `${formatQty(product.quantity)} ${product.unit}`,
      product.retailPriceCents != null ? formatPrice(product.retailPriceCents) : null,
    ].filter(Boolean);
    return escapeHtml(parts.join(" · "));
  }

  function renderExpandedBody(product: Product) {
    const detailItems = [
      { label: "Category", value: product.category ?? "—" },
      { label: "Brand", value: product.brand ?? "—" },
      { label: "SKU", value: product.sku ?? "—" },
      { label: "Barcode", value: product.barcode ?? "—" },
      { label: "Retail price", value: formatPrice(product.retailPriceCents) },
      {
        label: "Reorder at",
        value: product.reorderThreshold > 0 ? formatQty(product.reorderThreshold) : "—",
      },
    ];

    const heroImage = product.imageUrl
      ? `<img class="stock-card__hero-img" src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" />`
      : "";

    const notesBlock = product.notes
      ? `<p class="stock-card__notes">${escapeHtml(product.notes)}</p>`
      : "";

    const editBtn = isManager
      ? `<button type="button" class="stock-page__btn-secondary stock-card__edit-btn" data-edit-product="${product.id}">Edit product</button>`
      : "";

    return `
      <button type="button" class="stock-card__close" data-collapse-card="${product.id}" aria-label="Collapse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Close
      </button>
      ${heroImage}
      <div class="stock-card__detail-grid">
        ${detailItems
          .map(
            (item) => `
          <div class="stock-card__detail-item">
            <span class="stock-card__detail-label">${item.label}</span>
            <span class="stock-card__detail-value">${escapeHtml(item.value)}</span>
          </div>`,
          )
          .join("")}
        <div class="stock-card__detail-item">
          <span class="stock-card__detail-label">On hand</span>
          <span class="stock-card__detail-value stock-card__detail-value--qty${product.isLowStock ? " stock-card__detail-value--qty-low" : ""}">
            ${formatQty(product.quantity)} ${escapeHtml(product.unit)}
            ${product.isLowStock ? " · Low stock" : ""}
          </span>
        </div>
      </div>
      ${notesBlock}
      <div class="stock-card__actions">
        <button type="button" class="stock-page__btn-primary" data-tx-action="receive" data-product-id="${product.id}">Check in</button>
        <button type="button" class="stock-page__btn-secondary" data-tx-action="use" data-product-id="${product.id}">Use</button>
        <button type="button" class="stock-page__btn-secondary" data-tx-action="adjust" data-product-id="${product.id}">Adjust</button>
        <button type="button" class="stock-page__btn-secondary" data-tx-action="count" data-product-id="${product.id}">Set count</button>
        ${editBtn}
      </div>
      <h4 class="stock-card__history-title">Recent activity</h4>
      <div class="stock-card__history" data-history="${product.id}">
        <p class="stock-card__history-loading">Loading…</p>
      </div>`;
  }

  function renderProductCard(product: Product) {
    const isExpanded = expandedProductId === product.id;
    return `
      <article class="stock-card${product.isLowStock ? " stock-card--low" : ""}${isExpanded ? " stock-card--expanded" : ""}" data-product-card="${product.id}">
        <button
          type="button"
          class="stock-card__header"
          aria-expanded="${isExpanded}"
          data-toggle-card="${product.id}"
        >
          <span class="stock-card__thumb">
            ${renderProductThumb(product)}
            ${product.isLowStock ? '<span class="stock-card__badge">Low</span>' : ""}
          </span>
          <span class="stock-card__summary">
            <span class="stock-card__name">${escapeHtml(product.name)}</span>
            <span class="stock-card__meta">${renderCollapsedMeta(product)}</span>
          </span>
          <svg class="stock-card__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
        <div class="stock-card__expand">
          <div class="stock-card__body">
            <div class="stock-card__body-inner">
              ${isExpanded ? renderExpandedBody(product) : ""}
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderProducts() {
    if (!listEl) return;
    if (categories.length === 0) {
      listEl.innerHTML =
        '<p class="stock-page__empty">No products found. Try a different search or add a product.</p>';
      return;
    }

    listEl.innerHTML = categories
      .map((category) => {
        const lowLabel =
          category.lowStockCount > 0 ? ` · ${category.lowStockCount} low` : "";
        return `
        <section class="stock-category">
          <h3 class="stock-category__title">
            ${escapeHtml(category.name)}
            <span class="stock-category__count">${category.products.length} item${category.products.length === 1 ? "" : "s"}${lowLabel}</span>
          </h3>
          <div class="stock-grid">
            ${category.products.map((product) => renderProductCard(product)).join("")}
          </div>
        </section>`;
      })
      .join("");

    bindCardEvents();
  }

  function toggleCard(productId: string) {
    if (expandedProductId === productId) {
      expandedProductId = null;
    } else {
      expandedProductId = productId;
      const product = products.find((p) => p.id === productId);
      if (product) {
        selectedProduct = product;
        window.requestAnimationFrame(() => void loadHistory(productId));
      }
    }
    renderProducts();
  }

  function collapseCard() {
    expandedProductId = null;
    renderProducts();
  }

  function bindCardEvents() {
    listEl?.querySelectorAll<HTMLButtonElement>("[data-toggle-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.toggleCard;
        if (id) toggleCard(id);
      });
    });

    listEl?.querySelectorAll<HTMLButtonElement>("[data-collapse-card]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        collapseCard();
      });
    });

    listEl?.querySelectorAll<HTMLButtonElement>("[data-tx-action]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = btn.dataset.productId;
        const type = btn.dataset.txAction as TransactionType;
        const product = products.find((p) => p.id === id);
        if (product) openTransactionModal(type, product);
      });
    });

    listEl?.querySelectorAll<HTMLButtonElement>("[data-edit-product]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = btn.dataset.editProduct;
        const product = products.find((p) => p.id === id);
        if (product) openEditModal(product);
      });
    });
  }

  async function loadHistory(productId: string) {
    const historyEl = listEl?.querySelector<HTMLElement>(`[data-history="${productId}"]`);
    if (!historyEl) return;

    const res = await fetch(
      apiUrl(`/api/inventory/transactions?productId=${encodeURIComponent(productId)}&limit=8`),
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      historyEl.innerHTML = '<p class="stock-card__history-loading">Could not load history.</p>';
      return;
    }
    const rows = data.transactions as Transaction[];
    if (rows.length === 0) {
      historyEl.innerHTML = '<p class="stock-card__history-loading">No transactions yet.</p>';
      return;
    }
    historyEl.innerHTML = rows
      .map(
        (row) => `
        <div class="stock-card__history-row">
          <span>${escapeHtml(transactionLabel(row.type, row.quantityChange))}</span>
          <span class="stock-card__history-meta">${escapeHtml(row.staffName ?? "Staff")} · ${formatDate(row.createdAt)}</span>
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
        receive: txFromScan ? "Check in" : "Receive stock",
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
    const expandedId = expandedProductId;

    closeModal(txModal);
    pendingTxType = null;
    txFromScan = false;

    await fetchProducts(searchInput?.value ?? "");

    if (expandedId) {
      expandedProductId = expandedId;
      renderProducts();
      void loadHistory(expandedId);
    }

    if (keepScanning && product) {
      setStatus(
        `Checked in ${formatQty(qtyCheckedIn)} ${product.unit} of ${product.name}. Scan the next item.`,
      );
      void openScanner();
      return;
    }

    setStatus(txType === "receive" ? "Stock checked in." : "Stock updated.");
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
      const barcodeField = addForm.querySelector<HTMLInputElement>(
        'input[name="barcode"]',
      );
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
      else closeAllModals();
    });
  });

  root.querySelector("[data-tx-submit]")?.addEventListener("click", () => {
    void submitTransaction();
  });

  root.querySelector("[data-manual-barcode-submit]")?.addEventListener(
    "click",
    () => {
      void lookupBarcode(manualBarcodeInput?.value ?? "");
    },
  );

  root.querySelectorAll("[data-coming-soon]").forEach((el) => {
    el.addEventListener("click", () => showToast("Coming soon"));
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
      setStatus("Product added.");
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

      const res = await fetch(
        apiUrl(`/api/inventory/products/${selectedProduct.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? "Could not update product", true);
        return;
      }

      const updated = data.product as Product;
      closeModal(editModal);
      setStatus("Product updated.");
      expandedProductId = updated.id;
      await fetchProducts(searchInput?.value ?? "");
    })();
  });

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void fetchProducts(searchInput.value).catch((err) => {
        setStatus(err instanceof Error ? err.message : "Load failed", true);
      });
    }, 250);
  });

  lowStockFilter?.addEventListener("change", () => {
    updateFilterCount();
    void fetchProducts(searchInput?.value ?? "").catch((err) => {
      setStatus(err instanceof Error ? err.message : "Load failed", true);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.querySelector(".inventory-modal.is-open")) {
        closeAllModals();
      } else if (expandedProductId) {
        collapseCard();
      }
    }
  });

  void fetchProducts().catch((err) => {
    setStatus(err instanceof Error ? err.message : "Load failed", true);
  });
}

document.querySelectorAll<HTMLElement>("[data-inventory-root]").forEach(initInventory);
