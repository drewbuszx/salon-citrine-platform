export const prerender = false;

import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../lib/api-booking";
import { getDefaultLocationId } from "../../../lib/booking-cart";
import { getStaffBySlug } from "../../../lib/booking-data";
import { createSupabaseServiceClient } from "../../../lib/supabase-server";
import { z } from "zod";

const waitlistSchema = z.object({
  staffSlug: z.string().optional(),
  serviceIds: z.array(z.string().uuid()).min(1),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  client: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  clientMessage: z.string().max(1200).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const supabase = createSupabaseServiceClient();
    const locationId = await getDefaultLocationId();
    let staffId: string | null = null;

    if (parsed.data.staffSlug) {
      const staff = await getStaffBySlug(parsed.data.staffSlug);
      if (!staff) return jsonError("Stylist not found", 400);
      staffId = staff.id;
    }

    const { data, error } = await supabase
      .from("waitlist_entries")
      .insert({
        location_id: locationId,
        staff_id: staffId,
        service_ids: parsed.data.serviceIds,
        preferred_date: parsed.data.preferredDate ?? null,
        client_email: parsed.data.client.email.trim().toLowerCase(),
        client_phone: parsed.data.client.phone?.trim() || null,
        client_first_name: parsed.data.client.firstName.trim(),
        client_last_name: parsed.data.client.lastName.trim(),
        client_message: parsed.data.clientMessage?.trim() || null,
        status: "active",
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("waitlist insert failed", error);
      return jsonError("Failed to join waitlist", 500);
    }

    return jsonOk({ id: data.id, status: "active" });
  } catch (error) {
    console.error("booking/waitlist", error);
    return jsonError("Failed to join waitlist", 500);
  }
};
