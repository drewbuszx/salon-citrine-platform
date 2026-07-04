import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonOk,
  parseClientName,
  requireApiAuth,
} from "../../../lib/api-calendar";
import { parseDateTimeLocalInput } from "../../../lib/datetime";

type CreateAppointmentBody = {
  staff_id?: string;
  starts_at?: string;
  client_name?: string;
  client_first_name?: string;
  client_last_name?: string;
  phone?: string;
  email?: string;
  client_phone?: string;
  client_email?: string;
  service_ids?: string[];
  notes?: string;
  status?: string;
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  let body: CreateAppointmentBody;

  try {
    body = (await context.request.json()) as CreateAppointmentBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? "");
  const startsRaw = String(body.starts_at ?? "");
  const serviceIds = Array.isArray(body.service_ids)
    ? body.service_ids.map(String).filter(Boolean)
    : [];
  const status = body.status === "pending" ? "pending" : "confirmed";

  if (!staffId || !startsRaw || serviceIds.length === 0) {
    return jsonError("Missing required fields", 400);
  }

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  const parsedName = body.client_name
    ? parseClientName(String(body.client_name))
    : {
        firstName: String(body.client_first_name ?? "").trim(),
        lastName: String(body.client_last_name ?? "").trim(),
      };

  if (!parsedName?.firstName || !parsedName.lastName) {
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
  const serviceRows: Array<{ service_id: string; price_cents: number | null }> = [];

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

  const endsAt = new Date(startsAt.getTime() + totalMinutes * 60_000);
  const phone =
    String(body.phone ?? body.client_phone ?? "").trim() || null;
  const email =
    String(body.email ?? body.client_email ?? "").trim().toLowerCase() || null;
  const notes = String(body.notes ?? "").trim() || null;

  let clientId: string | null = null;

  if (phone) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data) clientId = data.id;
  }

  if (!clientId && email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data) clientId = data.id;
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
      status,
      notes,
    })
    .select("id")
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
    await supabase.from("appointments").delete().eq("id", appointment.id);
    return jsonError("Failed to attach services", 500);
  }

  return jsonOk({ id: appointment.id });
};
