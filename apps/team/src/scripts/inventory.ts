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
  const lowStockFilter = root.querySelector<HTMLInputElement>("[data-low-stock-filter]");
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
  const editModal = root.querySelector<HTMLElement>("[data-edit-modal]");
  const editForm = root.querySelector<HTMLFormElement>("[data-edit-form]");

  let products: Product[] = [];
  let categories: ProductCategoryGroup[] = [];
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
    renderProducts();
    if (lowStockEl) {
      const count = data.lowStockCount as number;
      lowStockEl.hidden = count === 0 || Boolean(lowStockFilter?.checked);
      lowStockEl.textContent =
        count === 1
          ? "1 product is at or below reorder threshold."
          : `${count} products are at or below reorder threshold.`;
    }
  }

  function renderProductImage(product: Product) {
    if (product.imageUrl) {
      return `<img class="inventory-tile__img" src="${escapeAttr(product.imageUrl)}" alt="" loading="lazy" />`;
    }
    const initial = (product.category?.trim()?.[0] ?? product.name.trim()[0] ?? "?")
      .toUpperCase();
    return `<span class="inventory-tile__placeholder" aria-hidden="true">${escapeHtml(initial)}</span>`;
  }

  function escapeAttr(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
      .replaceAll("<", "&lt;");
  }

  function renderProductTile(product: Product) {
    return `
      <button type="button" class="inventory-tile${product.isLowStock ? " inventory-tile--low" : ""}" data-product-id="${product.id}">
        <span class="inventory-tile__media">
          ${renderProductImage(product)}
          ${product.isLowStock ? '<span class="inventory-badge inventory-badge--low inventory-tile__badge">Low</span>' : ""}
        </span>
        <span class="inventory-tile__name">${escapeHtml(product.name)}</span>
        <span class="inventory-tile__meta label-meta">${escapeHtml([product.brand, formatQty(product.quantity) + " " + product.unit].filter(Boolean).join(" · "))}</span>
      </button>`;
  }

  function renderProducts() {
    if (!listEl) return;
    if (categories.length === 0) {
      listEl.innerHTML =
        '<p class="empty-state">No products found. Try a different search or add a product.</p>';
      return;
    }

    listEl.innerHTML = categories
      .map((category) => {
        const lowLabel =
          category.lowStockCount > 0
            ? ` · ${category.lowStockCount} low`
            : "";
        return `
        <section class="inventory-category">
          <h2 class="inventory-category__title">
            ${escapeHtml(category.name)}
            <span class="inventory-category__count label-meta">${category.products.length} item${category.products.length === 1 ? "" : "s"}${lowLabel}</span>
          </h2>
          <div class="inventory-grid">
            ${category.products.map((product) => renderProductTile(product)).join("")}
          </div>
        </section>`;
      })
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
        product.reorderThreshold > 0
          ? `Reorder at ${formatQty(product.reorderThreshold)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    const detailImage = root.querySelector<HTMLImageElement>("[data-detail-image]");
    const detailImageWrap = root.querySelector<HTMLElement>("[data-detail-image-wrap]");
    if (detailImage && detailImageWrap) {
      if (product.imageUrl) {
        detailImage.src = product.imageUrl;
        detailImage.alt = product.name;
        detailImageWrap.hidden = false;
      } else {
        detailImage.removeAttribute("src");
        detailImageWrap.hidden = true;
      }
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
    closeModal(detailModal);
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

  root.querySelector("[data-edit-open]")?.addEventListener("click", () => {
    if (selectedProduct) openEditModal(selectedProduct);
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
      else if (target === "edit") closeModal(editModal);
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
      await fetchProducts(searchInput?.value ?? "");
      const refreshed = products.find((item) => item.id === updated.id) ?? updated;
      openProductDetail(refreshed);
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
    void fetchProducts(searchInput?.value ?? "").catch((err) => {
      setStatus(err instanceof Error ? err.message : "Load failed", true);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllModals();
  });

  void fetchProducts().catch((err) => {
    setStatus(err instanceof Error ? err.message : "Load failed", true);
  });
}

document.querySelectorAll<HTMLElement>("[data-inventory-root]").forEach(initInventory);
