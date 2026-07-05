/**
 * Client-side Boulevard cart helpers (session + reserve before checkout).
 */

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
