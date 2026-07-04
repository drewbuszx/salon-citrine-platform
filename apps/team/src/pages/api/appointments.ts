import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonResponse,
  parseClientName,
  requireTeamStaff,
} from "../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../lib/datetime";

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? "");
  const startsRaw = String(body.starts_at ?? "");
  const clientName = String(body.client_name ?? "").trim();
  const phone = String(body.phone ?? "").trim() || null;
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const notes = String(body.notes ?? "").trim() || null;
  const serviceIds = Array.isArray(body.service_ids)
    ? body.service_ids.map(String).filter(Boolean)
    : [];

  if (!staffId || !startsRaw || !clientName || serviceIds.length === 0) {
    return jsonError("Missing required fields", 400);
  }

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  const parsedName = parseClientName(clientName);
  if (!parsedName) {
    return jsonError("Client name is required", 400);
  }

  let startsAt: Date;
  try {
    startsAt = parseDateTimeLocalInput(startsRaw);
  } catch {
    return jsonError("Invalid start time", 400);
  }

  const { data: staffServices, error: staffServicesError } = await supabase
    .from("staff_services")
    .select("service_id, services(id, duration_minutes, base_price_cents)")
    .eq("staff_id", staffId)
    .in("service_id", serviceIds);

  if (staffServicesError) {
    console.error("staff_services lookup failed", staffServicesError);
    return jsonError("Failed to load services", 500);
  }

  const matched = staffServices ?? [];
  if (matched.length !== serviceIds.length) {
    return jsonError("One or more services are not offered by this provider", 400);
  }

  let totalMinutes = 0;
  const serviceRows: Array<{ service_id: string; price_cents: number | null }> =
    [];

  for (const serviceId of serviceIds) {
    const row = matched.find((item) => item.service_id === serviceId);
    if (!row) {
      return jsonError("Invalid service selection", 400);
    }
    const raw = row.services as
      | { id: string; duration_minutes: number; base_price_cents: number | null }
      | Array<{
          id: string;
          duration_minutes: number;
          base_price_cents: number | null;
        }>
      | null;
    const svc = Array.isArray(raw) ? raw[0] : raw;
    if (!svc) {
      return jsonError("Invalid service selection", 400);
    }
    totalMinutes += svc.duration_minutes;
    serviceRows.push({
      service_id: serviceId,
      price_cents: svc.base_price_cents,
    });
  }

  const endsAt = new Date(startsAt.getTime() + totalMinutes * 60 * 1000);

  let clientId: string | null = null;

  if (phone) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data) {
      clientId = data.id;
    }
  }

  if (!clientId && email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data) {
      clientId = data.id;
    }
  }

  if (!clientId) {
    const { data: createdClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        first_name: parsedName.firstName,
        last_name: parsedName.lastName,
        phone,
        email,
      })
      .select("id")
      .single();

    if (clientError || !createdClient) {
      console.error("client insert failed", clientError);
      return jsonError("Failed to create client", 500);
    }
    clientId = createdClient.id;
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      client_id: clientId,
      staff_id: staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      notes,
    })
    .select("id, staff_id, starts_at, ends_at, status")
    .single();

  if (appointmentError || !appointment) {
    console.error("appointment insert failed", appointmentError);
    return jsonError("Failed to create appointment", 500);
  }

  const { error: servicesError } = await supabase.from("appointment_services").insert(
    serviceRows.map((row) => ({
      appointment_id: appointment.id,
      service_id: row.service_id,
      price_cents: row.price_cents,
    })),
  );

  if (servicesError) {
    console.error("appointment_services insert failed", servicesError);
    return jsonError("Failed to attach services", 500);
  }

  return jsonResponse({ appointment }, 201);
};
