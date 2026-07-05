export const prerender = false;

import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "../../../../lib/api-booking";
import { createSupabaseServiceClient } from "../../../../lib/supabase-server";
import { z } from "zod";

const lookupSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone is required",
  });

export const GET: APIRoute = async ({ url }) => {
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? undefined;
  const phone = url.searchParams.get("phone")?.trim() ?? undefined;

  const parsed = lookupSchema.safeParse({ email, phone });
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const supabase = createSupabaseServiceClient();
    let query = supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, intake_notes, booking_preferences")
      .limit(1);

    if (parsed.data.phone) {
      query = query.eq("phone", parsed.data.phone);
    } else if (parsed.data.email) {
      query = query.eq("email", parsed.data.email);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (!data) {
      return jsonOk({ found: false, client: null });
    }

    return jsonOk({
      found: true,
      client: {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        phone: data.phone,
        intakeNotes: data.intake_notes,
        bookingPreferences: data.booking_preferences,
      },
    });
  } catch (error) {
    console.error("booking/clients/lookup", error);
    return jsonError("Client lookup failed", 500);
  }
};
