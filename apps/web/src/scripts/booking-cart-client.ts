/**
 * Client-side Boulevard cart helpers (session + reserve before checkout).
 */

import { appendEmbedIfActive } from "../lib/booking-flow";

const CART_STORAGE_KEY = "sc-booking-cart-id";

export function getStoredCartId(): string | null {
  try {
    return sessionStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeCartId(cartId: string): void {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, cartId);
  } catch {
    // ignore private browsing
  }
}

export function clearStoredCartId(): void {
  try {
    sessionStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
}

type CartPayload = { cart?: { id?: string } };

export async function ensureBookingCart(input: {
  cartApiUrl: string;
  staffSlug: string;
  serviceIds: string[];
}): Promise<string> {
  const existing = getStoredCartId();
  if (existing) return existing;

  const response = await fetch(input.cartApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staffSlug: input.staffSlug,
      serviceIds: input.serviceIds,
    }),
  });

  const payload = (await response.json()) as CartPayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not start booking cart");
  }

  const cartId = payload.cart?.id;
  if (!cartId) throw new Error("Could not start booking cart");
  storeCartId(cartId);
  return cartId;
}

export async function reserveBookingCartSlot(input: {
  cartApiUrl: string;
  cartId: string;
  staffSlug: string;
  serviceIds: string[];
  startsAt: string;
}): Promise<void> {
  const response = await fetch(input.cartApiUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reserve",
      cartId: input.cartId,
      staffSlug: input.staffSlug,
      serviceIds: input.serviceIds,
      startsAt: input.startsAt,
    }),
  });

  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not hold this time");
  }
}

export async function lookupExistingClient(input: {
  lookupUrl: string;
  email?: string;
  phone?: string;
}): Promise<{
  found: boolean;
  client: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    intakeNotes: string | null;
    bookingPreferences: string | null;
    birthday: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
    preferredContactMethod: string | null;
    referralSources: string[];
  } | null;
}> {
  const params = new URLSearchParams();
  if (input.phone) params.set("phone", input.phone);
  else if (input.email) params.set("email", input.email);
  else return { found: false, client: null };

  const response = await fetch(`${input.lookupUrl}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Could not look up your profile");
  }

  return (await response.json()) as {
    found: boolean;
    client: {
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      intakeNotes: string | null;
      bookingPreferences: string | null;
      birthday: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      addressCity: string | null;
      addressState: string | null;
      addressZip: string | null;
      preferredContactMethod: string | null;
      referralSources: string[];
    } | null;
  };
}

export async function fetchCartExpiry(input: {
  cartApiUrl: string;
  cartId: string;
}): Promise<string | null> {
  const response = await fetch(`${input.cartApiUrl}?cartId=${encodeURIComponent(input.cartId)}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    cart?: { expiresAt?: string | null };
  };
  return payload.cart?.expiresAt ?? null;
}

export function formatReservationCountdown(expiresAtIso: string): string {
  const ms = new Date(expiresAtIso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60_000);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/* ── Service cart step (cart.astro) ── */

type ServiceCartItem = {
  id: string;
  name: string;
  durationMinutes: number;
  priceLabel: string;
  isPrimary?: boolean;
};

type SuggestionService = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceLabel: string;
};

type SuggestionSection = {
  key: string;
  title: string;
  description?: string;
  required?: boolean;
  services: SuggestionService[];
};

export function formatDurationClient(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  const hrLabel = hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hrLabel} ${minutes} min`;
}

export function estimatePriceClient(items: ServiceCartItem[]): string | null {
  let totalCents = 0;
  let hasNull = false;
  let hasVaries = false;

  for (const item of items) {
    const match = item.priceLabel.match(/^\$(\d+(?:\.\d+)?)/);
    if (!match) {
      if (item.priceLabel === "Complimentary") hasNull = true;
      continue;
    }
    totalCents += Math.round(parseFloat(match[1]) * 100);
    if (item.priceLabel.endsWith("+")) hasVaries = true;
  }

  if (totalCents === 0 && hasNull) return null;
  const dollars = totalCents / 100;
  const base = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  if (hasVaries || hasNull) return `${base}+`;
  return base;
}

function isPillSection(key: string): boolean {
  return key === "addons" || key === "related";
}

export function initServiceCart(): void {
  const root = document.querySelector<HTMLElement>("[data-service-cart]");
  if (!root) return;

  let cart: ServiceCartItem[] = JSON.parse(root.dataset.cartJson ?? "[]");
  const suggestionSections: SuggestionSection[] = JSON.parse(
    root.dataset.suggestionsJson ?? "[]",
  );
  const stylistSlug = root.dataset.stylistSlug ?? "";
  const primaryServiceId = root.dataset.primaryServiceId ?? "";
  const existingAck = root.dataset.existingAck === "true";
  const existingClientAckParam = root.dataset.existingClientAckParam ?? "";
  const continueUrl = root.dataset.continueUrl ?? "";
  const returningAck = new URLSearchParams(window.location.search).get("returning") === "1";

  function appendSessionParams(params: URLSearchParams): void {
    if (existingAck && existingClientAckParam) {
      params.set(existingClientAckParam, "1");
    }
    if (returningAck) params.set("returning", "1");
    appendEmbedIfActive(params);
  }

  const itemsEl = root.querySelector("[data-cart-items]");
  const durationEls = root.querySelectorAll("[data-total-duration]");
  const priceEls = root.querySelectorAll("[data-total-price]");
  const priceRowEls = root.querySelectorAll("[data-total-price-row]");
  const continueBtns = root.querySelectorAll<HTMLButtonElement>("[data-continue-btn]");

  function setBusy(busy: boolean): void {
    if (busy) {
      root!.setAttribute("aria-busy", "true");
      root!.classList.add("cart--busy");
    } else {
      root!.removeAttribute("aria-busy");
      root!.classList.remove("cart--busy");
    }
  }

  function cartHas(id: string): boolean {
    return cart.some((item) => item.id === id);
  }

  function addToCart(service: SuggestionService): void {
    if (cartHas(service.id)) return;
    setBusy(true);
    cart.push({ ...service, isPrimary: service.id === primaryServiceId });
    window.requestAnimationFrame(() => {
      render();
      setBusy(false);
    });
  }

  function removeFromCart(id: string): void {
    if (id === primaryServiceId) return;
    setBusy(true);
    cart = cart.filter((item) => item.id !== id);
    window.requestAnimationFrame(() => {
      render();
      setBusy(false);
    });
  }

  function renderCartItems(): void {
    if (!itemsEl) return;
    itemsEl.innerHTML = "";

    for (const item of cart) {
      const li = document.createElement("li");
      li.className = "cart-item";
      li.dataset.cartItem = item.id;

      const body = document.createElement("div");
      body.className = "cart-item__body";

      const name = document.createElement("h3");
      name.className = "cart-item__name";
      name.textContent = item.name;
      body.appendChild(name);

      const meta = document.createElement("p");
      meta.className = "cart-item__meta";
      const price = document.createElement("span");
      price.className = "cart-item__price";
      price.textContent = item.priceLabel;
      const duration = document.createElement("span");
      duration.className = "cart-item__duration";
      duration.textContent = formatDurationClient(item.durationMinutes);
      meta.append(price, document.createTextNode(" · "), duration);
      body.appendChild(meta);

      li.appendChild(body);

      if (!item.isPrimary && item.id !== primaryServiceId) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "cart-item__remove";
        removeBtn.setAttribute("aria-label", `Remove ${item.name}`);
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => removeFromCart(item.id));
        li.appendChild(removeBtn);
      } else {
        const badge = document.createElement("span");
        badge.className = "cart-item__badge";
        badge.textContent = "Primary";
        li.appendChild(badge);
      }

      itemsEl.appendChild(li);
    }
  }

  function renderSuggestionOption(
    service: SuggestionService,
    section: SuggestionSection,
    list: Element,
  ): void {
    const inCart = cartHas(service.id);
    const usePill = isPillSection(section.key);

    if (usePill) {
      const li = document.createElement("li");
      li.className = "suggestion-pill-wrap";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = inCart
        ? "suggestion-pill suggestion-pill--selected"
        : "suggestion-pill";
      btn.setAttribute("aria-pressed", inCart ? "true" : "false");
      btn.disabled = inCart;

      const name = document.createElement("span");
      name.className = "suggestion-pill__name";
      name.textContent = service.name;

      const price = document.createElement("span");
      price.className = "suggestion-pill__price";
      price.textContent = service.priceLabel;

      const duration = document.createElement("span");
      duration.className = "suggestion-pill__duration";
      duration.textContent = formatDurationClient(service.durationMinutes);

      btn.append(name, price, duration);
      if (!inCart) {
        btn.addEventListener("click", () => addToCart(service));
      }

      li.appendChild(btn);
      list.appendChild(li);
      return;
    }

    const li = document.createElement("li");
    li.className = inCart
      ? "suggestion-card suggestion-card--selected"
      : "suggestion-card";

    const body = document.createElement("div");
    body.className = "suggestion-card__body";

    const name = document.createElement("h4");
    name.className = "suggestion-card__name";
    name.textContent = service.name;
    body.appendChild(name);

    if (service.description) {
      const desc = document.createElement("p");
      desc.className = "suggestion-card__description";
      desc.textContent = service.description;
      body.appendChild(desc);
    }

    const meta = document.createElement("p");
    meta.className = "suggestion-card__meta";
    const price = document.createElement("span");
    price.className = "suggestion-card__price";
    price.textContent = service.priceLabel;
    const duration = document.createElement("span");
    duration.className = "suggestion-card__duration";
    duration.textContent = formatDurationClient(service.durationMinutes);
    meta.append(price, document.createTextNode(" · "), duration);
    body.appendChild(meta);

    li.appendChild(body);

    const action = document.createElement("button");
    action.type = "button";
    action.className = inCart
      ? "suggestion-card__action suggestion-card__action--added"
      : "suggestion-card__action";
    action.setAttribute("aria-pressed", inCart ? "true" : "false");
    action.textContent = inCart ? "Added" : "Add";
    action.disabled = inCart;
    if (!inCart) {
      action.addEventListener("click", () => addToCart(service));
    }
    li.appendChild(action);

    list.appendChild(li);
  }

  function renderSuggestions(): void {
    for (const section of suggestionSections) {
      const list = root?.querySelector(`[data-section-list="${section.key}"]`);
      if (!list) continue;
      list.innerHTML = "";

      if (isPillSection(section.key)) {
        list.classList.add("suggestion-list--pills");
      }

      for (const service of section.services) {
        renderSuggestionOption(service, section, list);
      }
    }
  }

  function renderTotals(): void {
    const totalMinutes = cart.reduce(
      (sum, item) => sum + item.durationMinutes,
      0,
    );
    const durationLabel = formatDurationClient(totalMinutes);
    durationEls.forEach((el) => {
      el.textContent = durationLabel;
    });

    const estimated = estimatePriceClient(cart);
    priceEls.forEach((el) => {
      if (estimated) {
        el.textContent = estimated;
      }
    });
    priceRowEls.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.hidden = !estimated;
      }
    });
  }

  function syncUrl(): void {
    const params = new URLSearchParams();
    params.set("services", cart.map((item) => item.id).join(","));
    if (stylistSlug) params.set("stylist", stylistSlug);
    appendSessionParams(params);
    window.history.replaceState({}, "", `?${params.toString()}`);
  }

  function render(): void {
    renderCartItems();
    renderSuggestions();
    renderTotals();
    syncUrl();
  }

  function handleContinue(): void {
    const requiredSection = suggestionSections.find((section) => section.required);
    if (requiredSection) {
      const hasRequired = requiredSection.services.some((service) =>
        cartHas(service.id),
      );
      if (!hasRequired) {
        root?.querySelector('[data-section="required"]')?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
    }

    const params = new URLSearchParams();
    params.set("services", cart.map((item) => item.id).join(","));
    if (stylistSlug) params.set("stylist", stylistSlug);
    appendSessionParams(params);
    const separator = continueUrl.includes("?") ? "&" : "?";
    window.location.href = `${continueUrl}${separator}${params.toString()}`;
  }

  continueBtns.forEach((btn) => {
    btn.addEventListener("click", handleContinue);
  });

  render();
}

if (document.querySelector("[data-service-cart]")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initServiceCart);
  } else {
    initServiceCart();
  }
}
