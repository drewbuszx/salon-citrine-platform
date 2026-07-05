export const prerender = false;

import type { APIRoute } from "astro";
import {
  CART_RESERVATION_MINUTES,
  getAvailableDatesInRange,
  toBookableDates,
} from "../../../lib/availability";
import { parseServiceIdsFromParams } from "../../../lib/booking-data";

export const GET: APIRoute = async ({ url }) => {
  const staffId = url.searchParams.get("staff");
  const staffVariant = url.searchParams.get("staffVariant");
  const locationId = url.searchParams.get("location");
  const servicesParam = url.searchParams.get("services");
  const serviceParam = url.searchParams.get("service");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const searchRangeLower = url.searchParams.get("searchRangeLower") ?? start;
  const searchRangeUpper = url.searchParams.get("searchRangeUpper") ?? end;

  const serviceIds = parseServiceIdsFromParams(servicesParam, serviceParam);
  const resolvedStaffId = staffVariant ?? staffId;

  if (!resolvedStaffId || serviceIds.length === 0 || !searchRangeLower || !searchRangeUpper) {
    return Response.json({ error: "Missing required query params" }, { status: 400 });
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(searchRangeLower) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(searchRangeUpper)
  ) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const dates = await getAvailableDatesInRange(
      resolvedStaffId,
      serviceIds,
      searchRangeLower,
      searchRangeUpper,
    );
    return Response.json({
      dates,
      bookableDates: toBookableDates(dates),
      locationId: locationId ?? null,
      reservationExpiresInMinutes: CART_RESERVATION_MINUTES,
    });
  } catch (error) {
    console.error("availability/dates", error);
    return Response.json({ error: "Failed to load availability" }, { status: 500 });
  }
};
