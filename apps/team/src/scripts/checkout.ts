import { calculateCheckoutTotals, formatCents, type CheckoutLineItem } from "@saloncitrine/shared";
import { showToast, friendlyError } from "../lib/toast";

type RetailProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  retailPriceCents: number;
  quantity: number;
};

type CheckoutPayload = {
  appointment: {
    id: string;
    status: string;
    startsAt: string;
    endsAt: string;
    staffName: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    hasCardOnFile: boolean;
  } | null;
  order: {
    id: string;
    status: string;
    subtotalCents: number;
    tipCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
    depositAppliedCents: number;
    amountDueCents: number;
    amountPaidCents: number;
    lineItems: CheckoutLineItem[];
  };
  products: RetailProduct[];
};

function initCheckout(root: HTMLElement) {
  const apiUrl = root.dataset.apiUrl ?? "";
  const calendarUrl = root.dataset.calendarUrl ?? "/";

  const loadingEl = root.querySelector<HTMLElement>("[data-checkout-loading]");
  const bodyEl = root.querySelector<HTMLElement>("[data-checkout-body]");
  const receiptEl = root.querySelector<HTMLElement>("[data-checkout-receipt]");
  const errorEl = root.querySelector<HTMLElement>("[data-checkout-error]");
  const statusEl = root.querySelector<HTMLElement>("[data-checkout-status]");
  const titleEl = root.querySelector<HTMLElement>("[data-checkout-title]");
  const metaEl = root.querySelector<HTMLElement>("[data-checkout-meta]");
  const linesEl = root.querySelector<HTMLElement>("[data-line-items]");
  const summaryEl = root.querySelector<HTMLElement>("[data-checkout-summary]");
  const receiptSummaryEl = root.querySelector<HTMLElement>("[data-receipt-summary]");
  const receiptLeadEl = root.querySelector<HTMLElement>("[data-receipt-lead]");
  const clientCard = root.querySelector<HTMLElement>("[data-client-card]");
  const clientNameEl = root.querySelector<HTMLElement>("[data-client-name]");
  const clientCardStatusEl = root.querySelector<HTMLElement>("[data-client-card-status]");
  const tipSection = root.querySelector<HTMLElement>("[data-tip-section]");
  const tipCustom = root.querySelector<HTMLInputElement>("[data-tip-custom]");
  const tipPresets = root.querySelector<HTMLElement>("[data-tip-presets]");
  const completeBtn = root.querySelector<HTMLButtonElement>("[data-complete-checkout]");
  const addProductBtn = root.querySelector<HTMLButtonElement>("[data-add-product]");
  const productModal = root.querySelector<HTMLDialogElement>("[data-product-modal]");
  const productForm = root.querySelector<HTMLFormElement>("[data-product-form]");
  const productSelect = root.querySelector<HTMLSelectElement>("[data-product-select]");

  let payload: CheckoutPayload | null = null;
  let lineItems: CheckoutLineItem[] = [];
  let tipCents = 0;
  let products: RetailProduct[] = [];
  let saving = false;
  let completing = false;
  let saveTimer: number | undefined;

  function showError(message: string) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function showStatus(message: string, success = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = !message;
    statusEl.classList.toggle("notice--success", success && Boolean(message));
    statusEl.classList.toggle("notice--error", !success && Boolean(message));
  }

  function formatMoney(cents: number) {
    return formatCents(cents);
  }

  function formatApptMeta(appt: CheckoutPayload["appointment"]) {
    const when = new Date(appt.startsAt).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${when} · ${appt.staffName}`;
  }

  function serviceSubtotalCents() {
    return lineItems
      .filter((item) => item.kind === "service" || item.kind === "product")
      .reduce((sum, item) => sum + item.totalCents, 0);
  }

  function computeTotals() {
    return calculateCheckoutTotals({
      lineItems,
      tipCents,
      depositAppliedCents: payload?.order.depositAppliedCents ?? 0,
    });
  }

  function renderSummary(target: HTMLElement, totals: ReturnType<typeof computeTotals>, paid?: number) {
    const deposit = payload?.order.depositAppliedCents ?? 0;
    target.innerHTML = `
      <div class="checkout-summary__row"><dt>Subtotal</dt><dd>${formatMoney(totals.subtotalCents)}</dd></div>
      <div class="checkout-summary__row"><dt>Tip</dt><dd>${formatMoney(totals.tipCents)}</dd></div>
      ${
        deposit > 0
          ? `<div class="checkout-summary__row"><dt>Deposit applied</dt><dd>−${formatMoney(deposit)}</dd></div>`
          : ""
      }
      <div class="checkout-summary__row checkout-summary__row--total"><dt>Total</dt><dd>${formatMoney(totals.totalCents)}</dd></div>
      <div class="checkout-summary__row checkout-summary__row--due"><dt>Amount due</dt><dd>${formatMoney(totals.amountDueCents)}</dd></div>
      ${
        paid != null
          ? `<div class="checkout-summary__row"><dt>Paid</dt><dd>${formatMoney(paid)}</dd></div>`
          : ""
      }`;
  }

  function renderLines() {
    if (!linesEl) return;
    if (lineItems.length === 0) {
      linesEl.innerHTML = `<tr><td colspan="5" class="empty-state">No line items</td></tr>`;
      return;
    }

    linesEl.innerHTML = lineItems
      .map((item, index) => {
        const removable = item.kind === "product";
        return `
        <tr data-line-index="${index}">
          <td>${escapeHtml(item.name)}<span class="label-meta"> · ${item.kind}</span></td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatMoney(item.unitPriceCents)}</td>
          <td class="num">${formatMoney(item.totalCents)}</td>
          <td>${
            removable
              ? `<button type="button" class="checkout-line-remove" data-remove-line="${index}" aria-label="Remove">×</button>`
              : ""
          }</td>
        </tr>`;
      })
      .join("");

    linesEl.querySelectorAll<HTMLButtonElement>("[data-remove-line]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeLine);
        lineItems = lineItems.filter((_, i) => i !== idx);
        renderLines();
        scheduleSave();
        updateTotalsUI();
      });
    });
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function updateTotalsUI() {
    const totals = computeTotals();
    if (summaryEl) renderSummary(summaryEl, totals);
  }

  function setTipPreset(percent: number) {
    tipPresets?.querySelectorAll<HTMLButtonElement>("[data-tip-preset]").forEach((btn) => {
      btn.classList.toggle(
        "team-filter-pill--active",
        Number(btn.dataset.tipPreset) === percent,
      );
    });
    if (percent === 0) {
      tipCents = 0;
      if (tipCustom) tipCustom.value = "";
    } else {
      tipCents = Math.round((serviceSubtotalCents() * percent) / 100);
      if (tipCustom) tipCustom.value = (tipCents / 100).toFixed(2);
    }
    updateTotalsUI();
    scheduleSave();
  }

  function scheduleSave() {
    if (!payload || payload.order.status !== "open") return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveDraft(), 400);
  }

  async function saveDraft() {
    if (!payload || saving || payload.order.status !== "open") return;
    saving = true;
    showStatus("Saving…");
    try {
      const res = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, tipCents }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Save failed");
      payload.order = body.order;
      showStatus("");
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      saving = false;
    }
  }

  function populateProductSelect() {
    if (!productSelect) return;
    productSelect.innerHTML = products
      .map(
        (p) =>
          `<option value="${p.id}" data-price="${p.retailPriceCents}" data-stock="${p.quantity}">${escapeHtml(p.name)}${p.brand ? ` · ${escapeHtml(p.brand)}` : ""} — ${formatMoney(p.retailPriceCents)}</option>`,
      )
      .join("");
  }

  function showReceipt(order: CheckoutPayload["order"]) {
    bodyEl?.setAttribute("hidden", "");
    receiptEl?.removeAttribute("hidden");
    if (receiptLeadEl) {
      receiptLeadEl.textContent = "Checkout complete. Appointment marked completed.";
    }
    if (receiptSummaryEl) {
      renderSummary(
        receiptSummaryEl,
        calculateCheckoutTotals({
          lineItems: order.lineItems,
          tipCents: order.tipCents,
          depositAppliedCents: order.depositAppliedCents,
        }),
        order.amountPaidCents,
      );
    }
    if (titleEl && payload) {
      titleEl.textContent = `${payload.client?.firstName ?? ""} ${payload.client?.lastName ?? ""}`.trim();
    }
    showStatus("Payment captured successfully.", true);
    showToast("Payment captured successfully.", "success");
    receiptEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showCompletedReadOnly(order: CheckoutPayload["order"]) {
    lineItems = order.lineItems;
    tipCents = order.tipCents;
    renderLines();
    tipSection?.setAttribute("hidden", "");
    addProductBtn?.setAttribute("hidden", "");
    completeBtn?.setAttribute("hidden", "");
    if (summaryEl) {
      renderSummary(
        summaryEl,
        calculateCheckoutTotals({
          lineItems: order.lineItems,
          tipCents: order.tipCents,
          depositAppliedCents: order.depositAppliedCents,
        }),
        order.amountPaidCents,
      );
    }
    showReceipt(order);
  }

  async function completeCheckout() {
    if (!payload || completing) return;
    if (payload.order.status === "completed") {
      showCompletedReadOnly(payload.order);
      return;
    }

    if (!payload.client?.hasCardOnFile && computeTotals().amountDueCents > 0) {
      showError(
        "Client has no card on file. Collect payment or add a card before completing checkout.",
      );
      return;
    }

    completing = true;
    showError("");
    if (completeBtn) {
      completeBtn.disabled = true;
      completeBtn.textContent = "Processing…";
    }

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, tipCents }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Checkout failed");
      }
      payload.order = body.order;
      showCompletedReadOnly(body.order);
    } catch (err) {
      const msg = friendlyError(err, "Checkout failed");
      showError(msg);
      showToast(msg, "error");
      if (completeBtn) {
        completeBtn.disabled = false;
        completeBtn.textContent = "Complete checkout";
      }
    } finally {
      completing = false;
    }
  }

  async function loadCheckout() {
    try {
      const res = await fetch(apiUrl);
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load checkout");

      payload = body as CheckoutPayload;
      products = payload.products ?? [];
      lineItems = payload.order.lineItems.map((item) => ({ ...item }));
      tipCents = payload.order.tipCents;

      if (loadingEl) loadingEl.hidden = true;
      bodyEl?.removeAttribute("hidden");

      const clientName = payload.client
        ? `${payload.client.firstName} ${payload.client.lastName}`.trim()
        : "Walk-in";
      if (titleEl) titleEl.textContent = clientName;
      if (metaEl) metaEl.textContent = formatApptMeta(payload.appointment);

      if (clientCard && clientNameEl && clientCardStatusEl && payload.client) {
        clientCard.hidden = false;
        clientNameEl.textContent = clientName;
        clientCardStatusEl.textContent = payload.client.hasCardOnFile
          ? "Card on file — charge at checkout"
          : "No card on file";
      }

      populateProductSelect();
      if (addProductBtn && products.length > 0 && payload.order.status === "open") {
        addProductBtn.removeAttribute("hidden");
      }
      renderLines();
      updateTotalsUI();
      setTipPreset(
        tipCents > 0 && serviceSubtotalCents() > 0
          ? Math.round((tipCents / serviceSubtotalCents()) * 100)
          : 0,
      );

      if (payload.order.status === "completed") {
        showCompletedReadOnly(payload.order);
      }
    } catch (err) {
      if (loadingEl) loadingEl.hidden = true;
      showError(err instanceof Error ? err.message : "Failed to load checkout");
    }
  }

  tipPresets?.querySelectorAll<HTMLButtonElement>("[data-tip-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTipPreset(Number(btn.dataset.tipPreset ?? 0));
    });
  });

  tipCustom?.addEventListener("input", () => {
    tipPresets?.querySelectorAll(".team-filter-pill--active").forEach((el) => {
      el.classList.remove("team-filter-pill--active");
    });
    tipCents = Math.round(Number(tipCustom.value || 0) * 100);
    updateTotalsUI();
    scheduleSave();
  });

  addProductBtn?.addEventListener("click", () => {
    if (products.length === 0) {
      showError("No retail products with prices configured.");
      return;
    }
    productModal?.showModal();
  });

  productForm?.querySelectorAll<HTMLButtonElement>("[data-product-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => productModal?.close());
  });

  productForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(productForm);
    const productId = String(formData.get("productId") ?? "");
    const qty = Math.max(1, Number(formData.get("quantity") ?? 1));
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const existing = lineItems.find(
      (item) => item.kind === "product" && item.productId === productId,
    );
    if (existing) {
      existing.quantity += qty;
      existing.totalCents = existing.unitPriceCents * existing.quantity;
    } else {
      lineItems.push({
        kind: "product",
        productId: product.id,
        name: product.name,
        quantity: qty,
        unitPriceCents: product.retailPriceCents,
        totalCents: product.retailPriceCents * qty,
      });
    }

    productModal?.close();
    productForm.reset();
    renderLines();
    updateTotalsUI();
    scheduleSave();
  });

  completeBtn?.addEventListener("click", () => void completeCheckout());

  root.querySelector<HTMLButtonElement>("[data-print-receipt]")?.addEventListener("click", () => {
    window.print();
  });

  void loadCheckout();
}

document.querySelectorAll<HTMLElement>("[data-checkout-app]").forEach(initCheckout);
