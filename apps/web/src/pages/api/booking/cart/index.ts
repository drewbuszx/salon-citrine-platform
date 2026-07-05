export const prerender = false;

import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../../lib/api-booking";
import {
  createBookingCart,
  getDefaultLocationId,
  loadBookingCart,
  reserveBookingCart,
  updateBookingCartClient,
} from "../../../../lib/booking-cart";
import { getStaffBySlug } from "../../../../lib/booking-data";
import {
  isBookingSlotAvailableByStartsAt,
  resolveBookingSlot,
} from "../../../../lib/availability";
import { formatDateInTimezone } from "../../../../lib/datetime-utils";
import { z } from "zod";

const createCartSchema = z.object({
  staffSlug: z.string(),
  serviceIds: z.array(z.string().uuid()).min(1),
  sessionToken: z.string().optional(),
});

const reserveCartSchema = z.object({
  cartId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  staffSlug: z.string(),
  serviceIds: z.array(z.string().uuid()).min(1),
});

const updateCartSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  clientMessage: z.string().max(1200).optional(),
  referralSource: z.string().max(200).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createCartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const staff = await getStaffBySlug(parsed.data.staffSlug);
    if (!staff) return jsonError("Stylist not found", 400);

    const cart = await createBookingCart({
      staffId: staff.id,
      serviceIds: parsed.data.serviceIds,
      sessionToken: parsed.data.sessionToken,
    });

    return jsonOk({ cart });
  } catch (error) {
    console.error("booking/cart POST", error);
    return jsonError(
      error instanceof Error ? error.message : "Failed to create cart",
      500,
    );
  }
};

export const GET: APIRoute = async ({ url }) => {
  const cartId = url.searchParams.get("cartId");
  if (!cartId) return jsonError("Missing cartId", 400);

  try {
    const cart = await loadBookingCart(cartId);
    if (!cart) return jsonError("Cart not found", 404);
    return jsonOk({ cart });
  } catch (error) {
    console.error("booking/cart GET", error);
    return jsonError("Failed to load cart", 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const action = (body as { action?: string }).action;

  if (action === "reserve") {
    const parsed = reserveCartSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
    }

    try {
      const staff = await getStaffBySlug(parsed.data.staffSlug);
      if (!staff) return jsonError("Stylist not found", 400);

      const dateStr = formatDateInTimezone(new Date(parsed.data.startsAt));
      const slot = await resolveBookingSlot(
        staff.id,
        parsed.data.serviceIds,
        dateStr,
        null,
        parsed.data.startsAt,
      );
      if (!slot) {
        return jsonError("That time is no longer available", 409);
      }

      const available = await isBookingSlotAvailableByStartsAt(
        staff.id,
        parsed.data.serviceIds,
        dateStr,
        parsed.data.startsAt,
      );
      if (!available) {
        return jsonError("That time is no longer available", 409);
      }

      const cart = await reserveBookingCart({
        cartId: parsed.data.cartId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      return jsonOk({ cart });
    } catch (error) {
      console.error("booking/cart reserve", error);
      return jsonError(
        error instanceof Error ? error.message : "Failed to reserve cart",
        500,
      );
    }
  }

  const parsed = updateCartSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const cartId = (body as { cartId?: string }).cartId;
  if (!cartId) return jsonError("Missing cartId", 400);

  try {
    const cart = await updateBookingCartClient({
      cartId,
      ...parsed.data,
    });
    return jsonOk({ cart });
  } catch (error) {
    console.error("booking/cart PATCH", error);
    return jsonError("Failed to update cart", 500);
  }
};

export const OPTIONS: APIRoute = async () => {
  try {
    const locationId = await getDefaultLocationId();
    return jsonOk({ locationId });
  } catch (error) {
    console.error("booking/cart OPTIONS", error);
    return jsonError("Location unavailable", 503);
  }
};
