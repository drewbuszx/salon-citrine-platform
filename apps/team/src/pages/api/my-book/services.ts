import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonOk,
  requireApiAuth,
} from "../../../lib/api-calendar";

export type ClientBookingBlock = "none" | "soft" | "hard";

const BLOCK_VALUES = new Set<ClientBookingBlock>(["none", "soft", "hard"]);

type PatchServiceBody = {
  staff_id?: string;
  service_id?: string;
  client_booking_block?: ClientBookingBlock;
};

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const staffId = context.url.searchParams.get("staff_id") ?? staff.id;

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  const { data, error } = await supabase
    .from("staff_services")
    .select(
      "service_id, returning_clients_only, client_booking_block, services(id, category, name, duration_minutes)",
    )
    .eq("staff_id", staffId)
    .order("services(category)", { ascending: true });

  if (error) {
    console.error("staff_services load failed", error);
    return jsonError("Failed to load services", 500);
  }

  const services = (data ?? []).flatMap((row) => {
    const raw = row.services as
      | { id: string; category: string; name: string; duration_minutes: number }
      | Array<{ id: string; category: string; name: string; duration_minutes: number }>
      | null;
    const svc = Array.isArray(raw) ? raw[0] : raw;
    if (!svc) return [];

    return [
      {
        serviceId: svc.id,
        category: svc.category,
        name: svc.name,
        durationMinutes: svc.duration_minutes,
        returningClientsOnly: row.returning_clients_only === true,
        clientBookingBlock: (row.client_booking_block ?? "none") as ClientBookingBlock,
      },
    ];
  });

  return jsonOk({ services });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  let body: PatchServiceBody;

  try {
    body = (await context.request.json()) as PatchServiceBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? staff.id);
  const serviceId = String(body.service_id ?? "");
  const block = body.client_booking_block;

  if (!serviceId) {
    return jsonError("service_id is required", 400);
  }

  if (!block || !BLOCK_VALUES.has(block)) {
    return jsonError("client_booking_block must be none, soft, or hard", 400);
  }

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  const { error } = await supabase
    .from("staff_services")
    .update({ client_booking_block: block })
    .eq("staff_id", staffId)
    .eq("service_id", serviceId);

  if (error) {
    console.error("staff_services block update failed", error);
    return jsonError("Failed to update service", 500);
  }

  return jsonOk({ serviceId, clientBookingBlock: block });
};
