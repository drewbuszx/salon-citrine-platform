import {
  ensureBookingCart,
  reserveBookingCartSlot,
} from "./booking-cart-client";
import { bookingApi } from "../lib/booking-flow";

function formValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el.value.trim() : "";
}

function initDatetimePicker() {
  const root = document.querySelector<HTMLElement>("[data-datetime-picker]");
  if (!root) return;

  root.addEventListener(
    "submit",
    async (event) => {
      const form = (event.target as Element)?.closest("form[data-time-form]");
      if (!(form instanceof HTMLFormElement)) return;
      if (!root.contains(form)) return;
    event.preventDefault();

    const startsAt = formValue(form, "startsAt");
    if (!startsAt) return;

    const servicesParam =
      root.dataset.servicesParam ?? root.dataset.serviceIds ?? "";
    const serviceIds = servicesParam.split(",").filter(Boolean);
    const staffSlug = root.dataset.stylistSlug ?? "";
    if (!staffSlug || serviceIds.length === 0) return;

    const submitBtn = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    submitBtn?.setAttribute("disabled", "true");
    form.setAttribute("aria-busy", "true");

    try {
      const cartId = await ensureBookingCart({
        cartApiUrl: bookingApi.cart,
        staffSlug,
        serviceIds,
      });

      await reserveBookingCartSlot({
        cartApiUrl: bookingApi.cart,
        cartId,
        staffSlug,
        serviceIds,
        startsAt,
      });

      const params = new URLSearchParams(new FormData(form));
      params.set("cartId", cartId);
      params.delete("time");
      const detailsUrl = root.dataset.detailsUrl ?? "";
      window.location.href = `${detailsUrl}?${params.toString()}`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not hold this time";
      const panel = root.querySelector("[data-time-panel]");
      let errEl = panel?.querySelector<HTMLElement>("[data-reserve-error]");
      if (!errEl && panel) {
        errEl = document.createElement("p");
        errEl.className = "time-section__empty";
        errEl.dataset.reserveError = "";
        errEl.style.color = "#b42318";
        panel.prepend(errEl);
      }
      if (errEl) errEl.textContent = message;
      submitBtn?.removeAttribute("disabled");
      form.removeAttribute("aria-busy");
    }
  },
    true,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDatetimePicker);
} else {
  initDatetimePicker();
}
