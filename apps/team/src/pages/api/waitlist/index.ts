import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";

const waitlistPostSchema = z.object({
  staffId: z.string().uuid().optional(),
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

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const status = context.url.searchParams.get("status") ?? "active";

  try {
    let query = auth.supabase
      .from("waitlist_entries")
      .select(
        `
        id,
        staff_id,
        service_ids,
        preferred_date,
        preferred_time_start,
        preferred_time_end,
        client_email,
        client_phone,
        client_first_name,
        client_last_name,
        client_message,
        status,
        notes,
        inserted_at,
        staff ( name )
      `,
      )
      .order("inserted_at", { ascending: false })
      .limit(50);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const serviceIdSet = new Set<string>();
    for (const row of data ?? []) {
      for (const id of (row.service_ids as string[]) ?? []) {
        serviceIdSet.add(id);
      }
    }

    const serviceNameById = new Map<string, string>();
    if (serviceIdSet.size > 0) {
      const { data: services } = await auth.supabase
        .from("services")
        .select("id, name")
        .in("id", [...serviceIdSet]);
      for (const service of services ?? []) {
        serviceNameById.set(service.id as string, service.name as string);
      }
    }

    const entries = (data ?? []).map((row) => {
      const serviceIds = (row.service_ids as string[]) ?? [];
      return {
        id: row.id as string,
        staffName: (row.staff as { name?: string } | null)?.name ?? "Any professional",
        serviceIds,
        serviceNames: serviceIds.map((id) => serviceNameById.get(id) ?? "Service"),
        preferredDate: row.preferred_date as string | null,
        preferredTimeStart: row.preferred_time_start as string | null,
        preferredTimeEnd: row.preferred_time_end as string | null,
        clientEmail: row.client_email as string,
        clientPhone: row.client_phone as string | null,
        clientFirstName: row.client_first_name as string | null,
        clientLastName: row.client_last_name as string | null,
        clientMessage: row.client_message as string | null,
        status: row.status as string,
        notes: row.notes as string | null,
        insertedAt: row.inserted_at as string,
      };
    });

    return jsonOk({ entries });
  } catch (error) {
    console.error("waitlist GET", error);
    return jsonError("Failed to load waitlist", 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Manager access required", 403);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = waitlistPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  try {
    const { data: location, error: locationError } = await auth.supabase
      .from("locations")
      .select("id")
      .eq("is_active", true)
      .order("name")
      .limit(1)
      .maybeSingle();

    if (locationError) throw locationError;
    if (!location) return jsonError("No active location configured", 500);

    const { data, error } = await auth.supabase
      .from("waitlist_entries")
      .insert({
        location_id: location.id,
        staff_id: parsed.data.staffId ?? null,
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

    if (error) throw error;
    return jsonOk({ id: data.id, status: "active" });
  } catch (error) {
    console.error("waitlist POST", error);
    return jsonError("Failed to add waitlist entry", 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Manager access required", 403);
  }

  let body: { ids?: string[]; status?: string; notes?: string };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const ids = body.ids ?? [];
  const status = body.status;
  if (ids.length === 0 || !status) {
    return jsonError("ids and status are required", 400);
  }

  const allowed = ["active", "notified", "booked", "expired", "cancelled"];
  if (!allowed.includes(status)) {
    return jsonError("Invalid status", 400);
  }

  try {
    const patch: Record<string, string> = { status };
    if (body.notes != null) patch.notes = body.notes;

    const { error } = await auth.supabase
      .from("waitlist_entries")
      .update(patch)
      .in("id", ids);

    if (error) throw error;
    return jsonOk({ updated: ids.length });
  } catch (error) {
    console.error("waitlist PATCH bulk", error);
    return jsonError("Failed to update waitlist", 500);
  }
};
