export const prerender = false;

import type { APIRoute } from "astro";
import { getAvailableDatesInRange } from "../../../lib/availability";
import { parseServiceIdsFromParams } from "../../../lib/booking-data";

export const GET: APIRoute = async ({ url }) => {
  const staffId = url.searchParams.get("staff");
  const servicesParam = url.searchParams.get("services");
  const serviceParam = url.searchParams.get("service");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const serviceIds = parseServiceIdsFromParams(servicesParam, serviceParam);

  if (!staffId || serviceIds.length === 0 || !start || !end) {
    return Response.json({ error: "Missing required query params" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const dates = await getAvailableDatesInRange(staffId, serviceIds, start, end);
    return Response.json({ dates });
  } catch (error) {
    console.error("availability/dates", error);
    return Response.json({ error: "Failed to load availability" }, { status: 500 });
  }
};
