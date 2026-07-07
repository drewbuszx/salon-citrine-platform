import type { APIRoute } from "astro";
import { formatBookingPolicySummary } from "@saloncitrine/shared";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  defaultPolicyResponse,
  mapPolicyRow,
  POLICY_SELECT,
  type BookingPolicyRow,
} from "../../../lib/booking-policy";
import {
  DEFAULT_LOCATION_SLUG,
  defaultBusinessDetails,
  LOCATION_SELECT,
  mapBusinessUpdates,
  mapLocationRow,
  serializeBusinessHours,
  type LocationRow,
} from "../../../lib/business-settings";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const { supabase } = auth;
  const [{ data: location, error: locationError }, { data: policy, error: policyError }] =
    await Promise.all([
      supabase
        .from("locations")
        .select(LOCATION_SELECT)
        .eq("slug", DEFAULT_LOCATION_SLUG)
        .maybeSingle(),
      supabase
        .from("booking_policy_settings")
        .select(POLICY_SELECT)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (locationError) {
    console.error("business location load failed", locationError);
    return jsonError("Failed to load business details", 500);
  }

  if (policyError) {
    console.error("business policy load failed", policyError);
  }

  const business = location
    ? mapLocationRow(location as LocationRow)
    : defaultBusinessDetails();
  const policyData = policy
    ? mapPolicyRow(policy as BookingPolicyRow)
    : defaultPolicyResponse();

  return jsonOk({
    business,
    bookingPolicySummary: formatBookingPolicySummary(policyData),
  });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updates = mapBusinessUpdates(body);
  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  const { supabase } = auth;
  const { data: existing, error: loadError } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", DEFAULT_LOCATION_SLUG)
    .maybeSingle();

  if (loadError) {
    console.error("business location lookup failed", loadError);
    return jsonError("Failed to load business details", 500);
  }

  let locationId = existing?.id as string | undefined;

  if (!locationId) {
    const defaults = defaultBusinessDetails();
    const { data: created, error: createError } = await supabase
      .from("locations")
      .insert({
        slug: DEFAULT_LOCATION_SLUG,
        name: defaults.name,
        timezone: defaults.timezone,
        address_line1: defaults.addressLine1,
        city: defaults.city,
        state: defaults.state,
        postal_code: defaults.postalCode,
        phone: defaults.phone,
        email: defaults.email,
        booking_email: defaults.bookingEmail,
        tagline: defaults.tagline,
        instagram_url: defaults.instagramUrl,
        business_hours: updates.business_hours ?? serializeBusinessHours(defaults.businessHours),
        is_active: true,
        ...updates,
      })
      .select(LOCATION_SELECT)
      .single();

    if (createError || !created) {
      console.error("business location create failed", createError);
      return jsonError("Failed to save business details", 500);
    }

    return jsonOk({ business: mapLocationRow(created as LocationRow) });
  }

  const { data: saved, error: updateError } = await supabase
    .from("locations")
    .update(updates)
    .eq("id", locationId)
    .select(LOCATION_SELECT)
    .maybeSingle();

  if (updateError || !saved) {
    console.error("business location update failed", updateError);
    return jsonError("Failed to save business details", 500);
  }

  return jsonOk({ business: mapLocationRow(saved as LocationRow) });
};
