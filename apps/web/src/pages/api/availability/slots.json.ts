export const prerender = false;

import type { APIRoute } from "astro";
import {
  CART_RESERVATION_MINUTES,
  getAvailableSlots,
  toBookableTimes,
} from "../../../lib/availability";
import { parseServiceIdsFromParams } from "../../../lib/booking-data";

export const GET: APIRoute = async ({ url }) => {
  const staffId = url.searchParams.get("staff");
  const staffVariant = url.searchParams.get("staffVariant");
  const locationId = url.searchParams.get("location");
  const servicesParam = url.searchParams.get("services");
  const serviceParam = url.searchParams.get("service");
  const date = url.searchParams.get("date");

  const serviceIds = parseServiceIdsFromParams(servicesParam, serviceParam);
  const resolvedStaffId = staffVariant ?? staffId;

  if (!resolvedStaffId || serviceIds.length === 0 || !date) {
    return Response.json({ error: "Missing required query params" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots(resolvedStaffId, serviceIds, date);
    return Response.json({
      slots,
      bookableTimes: toBookableTimes(slots),
      locationId: locationId ?? null,
      reservationExpiresInMinutes: CART_RESERVATION_MINUTES,
    });
  } catch (error) {
    console.error("availability/slots", error);
    return Response.json({ error: "Failed to load availability" }, { status: 500 });
  }
};
