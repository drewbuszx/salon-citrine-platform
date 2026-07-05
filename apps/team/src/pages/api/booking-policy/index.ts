import type { APIRoute } from "astro";
import { patchBookingPolicySettingsSchema } from "@saloncitrine/shared";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  defaultPolicyResponse,
  mapPolicyRow,
  mapPolicyUpdates,
  POLICY_SELECT,
  type BookingPolicyRow,
} from "../../../lib/booking-policy";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("booking_policy_settings")
    .select(POLICY_SELECT)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("booking-policy GET failed", error);
    return jsonError("Failed to load booking policy", 500);
  }

  if (!data) {
    return jsonOk({ policy: defaultPolicyResponse() });
  }

  return jsonOk({ policy: mapPolicyRow(data as BookingPolicyRow) });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = patchBookingPolicySettingsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const { supabase } = auth;
  const { data: existing, error: loadError } = await supabase
    .from("booking_policy_settings")
    .select("id")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (loadError) {
    console.error("booking-policy PATCH load failed", loadError);
    return jsonError("Failed to load booking policy", 500);
  }

  const updates = mapPolicyUpdates(parsed.data);
  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  let policyId = existing?.id as string | undefined;

  if (!policyId) {
    const { data: created, error: createError } = await supabase
      .from("booking_policy_settings")
      .insert({
        slug: "default-phase1",
        title: "Salon Citrine Booking Policy",
        ...updates,
        is_active: true,
      })
      .select("id")
      .single();

    if (createError || !created) {
      console.error("booking-policy PATCH create failed", createError);
      return jsonError("Failed to save booking policy", 500);
    }
    policyId = created.id;
  } else {
    const { error: updateError } = await supabase
      .from("booking_policy_settings")
      .update(updates)
      .eq("id", policyId);

    if (updateError) {
      console.error("booking-policy PATCH update failed", updateError);
      return jsonError("Failed to save booking policy", 500);
    }
  }

  const { data: saved, error: reloadError } = await supabase
    .from("booking_policy_settings")
    .select(POLICY_SELECT)
    .eq("id", policyId)
    .maybeSingle();

  if (reloadError || !saved) {
    return jsonOk({ saved: true });
  }

  return jsonOk({ policy: mapPolicyRow(saved as BookingPolicyRow) });
};
