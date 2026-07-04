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
  notes: string | null;
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

function apiUrl(path: string) {
  const base = document.body.dataset.apiBase ?? "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function initInventory(root: HTMLElement) {
  const isManager = root.dataset.isManager === "1";
  const listEl = root.querySelector<HTMLElement>("[data-product-list]");
  const searchInput = root.querySelector<HTMLInputElement>("[data-search]");
  const lowStockEl = root.querySelector<HTMLElement>("[data-low-stock-banner]");
  const statusEl = root.querySelector<HTMLElement>("[data-status]");

  const scanModal = root.querySelector<HTMLElement>("[data-scan-modal]");
  const scanVideo = root.querySelector<HTMLVideoElement>("[data-scan-video]");
  const scanError = root.querySelector<HTMLElement>("[data-scan-error]");
  const manualBarcodeInput = root.querySelector<HTMLInputElement>(
    "[data-manual-barcode]",
  );

  const detailModal = root.querySelector<HTMLElement>("[data-detail-modal]");
  const detailTitle = root.querySelector<HTMLElement>("[data-detail-title]");
  const detailMeta = root.querySelector<HTMLElement>("[data-detail-meta]");
  const detailQty = root.querySelector<HTMLElement>("[data-detail-qty]");
  const detailHistory = root.querySelector<HTMLElement>("[data-detail-history]");
  const detailNotes = root.querySelector<HTMLTextAreaElement>("[data-detail-notes]");

  const txModal = root.querySelector<HTMLElement>("[data-tx-modal]");
  const txTitle = root.querySelector<HTMLElement>("[data-tx-title]");
  const txQtyInput = root.querySelector<HTMLInputElement>("[data-tx-qty]");
  const txNotes = root.querySelector<HTMLTextAreaElement>("[data-tx-notes]");
  const txSubmit = root.querySelector<HTMLButtonElement>("[data-tx-submit]");

  const addModal = root.querySelector<HTMLElement>("[data-add-modal]");
  const addForm = root.querySelector<HTMLFormElement>("[data-add-form]");

  let products: Product[] = [];
  let selectedProduct: Product | null = null;
  let pendingTxType: TransactionType | null = null;
  let scanner: { stop: () => void } | null = null;
  let searchTimer: number | undefined;
  let scanCheckInMode = false;
  let txFromScan = false;

  function setStatus(message: string, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = !message;
    statusEl.classList.toggle("notice--error", isError);
    statusEl.classList.toggle("notice--success", !isError && Boolean(message));
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
    if (!root.querySelector(".inventory-modal.is-open")) {
      document.body.classList.remove("inventory-modal-open");
    }
  }

  function closeAllModals() {
    closeModal(scanModal);
    closeModal(detailModal);
    closeModal(txModal);
    closeModal(addModal);
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
    const res = await fetch(apiUrl(`/api/inventory/products?${params}`));
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Failed to load products");
    }
    products = data.products as Product[];
    renderProducts();
    if (lowStockEl) {
      const count = data.lowStockCount as number;
      lowStockEl.hidden = count === 0;
      lowStockEl.textContent =
        count === 1
          ? "1 product is at or below reorder threshold."
          : `${count} products are at or below reorder threshold.`;
    }
  }

  function renderProducts() {
    if (!listEl) return;
    if (products.length === 0) {
      listEl.innerHTML =
        '<p class="empty-state">No products found. Try a different search or add a product.</p>';
      return;
    }

    listEl.innerHTML = products
      .map(
        (p) => `
        <button type="button" class="inventory-card" data-product-id="${p.id}">
          <div class="inventory-card__main">
            <span class="inventory-card__name">${escapeHtml(p.name)}</span>
            <span class="label-meta">${escapeHtml([p.brand, p.category].filter(Boolean).join(" · ") || "Uncategorized")}</span>
          </div>
          <div class="inventory-card__meta">
            <span class="inventory-card__qty">${formatQty(p.quantity)} ${escapeHtml(p.unit)}</span>
            ${p.isLowStock ? '<span class="inventory-badge inventory-badge--low">Low stock</span>' : ""}
          </div>
        </button>`,
      )
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>("[data-product-id]").forEach(
      (btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.productId;
          const product = products.find((item) => item.id === id);
          if (product) openProductDetail(product);
        });
      },
    );
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function loadHistory(productId: string) {
    if (!detailHistory) return;
    detailHistory.innerHTML = '<p class="inventory-history__loading">Loading…</p>';
    const res = await fetch(
      apiUrl(`/api/inventory/transactions?productId=${encodeURIComponent(productId)}&limit=8`),
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      detailHistory.innerHTML =
        '<p class="inventory-history__loading">Could not load history.</p>';
      return;
    }
    const rows = data.transactions as Transaction[];
    if (rows.length === 0) {
      detailHistory.innerHTML =
        '<p class="inventory-history__loading">No transactions yet.</p>';
      return;
    }
    detailHistory.innerHTML = rows
      .map(
        (row) => `
        <div class="inventory-history__row">
          <span>${escapeHtml(transactionLabel(row.type, row.quantityChange))}</span>
          <span class="label-meta">${escapeHtml(row.staffName ?? "Staff")} · ${formatDate(row.createdAt)}</span>
        </div>`,
      )
      .join("");
  }

  function openProductDetail(product: Product) {
    selectedProduct = product;
    if (detailTitle) detailTitle.textContent = product.name;
    if (detailMeta) {
      detailMeta.textContent = [
        product.brand,
        product.category,
        product.barcode ? `Barcode ${product.barcode}` : null,
        product.sku ? `SKU ${product.sku}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (detailQty) {
      detailQty.textContent = `${formatQty(product.quantity)} ${product.unit}`;
      detailQty.classList.toggle(
        "inventory-detail__qty--low",
        product.isLowStock,
      );
    }
    if (detailNotes) detailNotes.value = "";
    void loadHistory(product.id);
    openModal(detailModal);
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
    if (txSubmit) {
      txSubmit.textContent =
        type === "receive" && txFromScan ? "Check in" : "Save";
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
    closeModal(detailModal);
    pendingTxType = null;
    txFromScan = false;

    await fetchProducts(searchInput?.value ?? "");

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

  root.querySelector("[data-scan-open]")?.addEventListener("click", () => {
    void openScanner();
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
      } else if (target === "detail") closeModal(detailModal);
      else if (target === "tx") closeModal(txModal);
      else if (target === "add") closeModal(addModal);
      else closeAllModals();
    });
  });

  root.querySelectorAll("[data-tx-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!selectedProduct) return;
      const type = (btn as HTMLElement).dataset.txAction as TransactionType;
      openTransactionModal(type, selectedProduct);
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

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      void fetchProducts(searchInput.value).catch((err) => {
        setStatus(err instanceof Error ? err.message : "Load failed", true);
      });
    }, 250);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllModals();
  });

  void fetchProducts().catch((err) => {
    setStatus(err instanceof Error ? err.message : "Load failed", true);
  });
}

document.querySelectorAll<HTMLElement>("[data-inventory-root]").forEach(initInventory);
