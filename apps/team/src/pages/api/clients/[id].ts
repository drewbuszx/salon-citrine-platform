import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase } = auth;
  const clientId = String(context.params.id ?? "");

  if (!clientId) {
    return jsonError("Client id required", 400);
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    console.error("client load failed", clientError);
    return jsonError("Failed to load client", 500);
  }

  if (!client) {
    return jsonError("Client not found", 404);
  }

  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select(
      `
      id,
      starts_at,
      status,
      appointment_services (
        services ( name )
      )
    `,
    )
    .eq("client_id", clientId)
    .in("status", ["confirmed", "completed"])
    .order("starts_at", { ascending: false })
    .limit(20);

  if (apptError) {
    console.error("client appointments load failed", apptError);
    return jsonError("Failed to load client history", 500);
  }

  const pastServices: Array<{ date: string; serviceName: string }> = [];

  for (const appt of appointments ?? []) {
    const rows = appt.appointment_services as
      | Array<{ services: { name: string } | Array<{ name: string }> | null }>
      | null;

    for (const row of rows ?? []) {
      const raw = row.services;
      const svc = Array.isArray(raw) ? raw[0] : raw;
      if (!svc?.name) continue;
      pastServices.push({
        date: appt.starts_at,
        serviceName: svc.name,
      });
    }
  }

  const { data: referrals, error: referralError } = await supabase
    .from("referrals")
    .select("id, referred_client_id, discount_applied, created_at")
    .eq("referrer_client_id", clientId);

  if (referralError) {
    console.error("referrals load failed", referralError);
    return jsonError("Failed to load referral info", 500);
  }

  const referralCount = referrals?.length ?? 0;
  const pendingReferralDiscount =
    referrals?.some((row) => !row.discount_applied) ?? false;

  return jsonOk({
    client: {
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      fullName: `${client.first_name} ${client.last_name}`.trim(),
      phone: client.phone,
      email: client.email,
    },
    pastServices,
    referrals: {
      count: referralCount,
      pendingDiscount: pendingReferralDiscount,
    },
  });
};
