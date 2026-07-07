import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  mapStaffRow,
  mapStaffUpdateBody,
  STAFF_MANAGE_SELECT,
  type StaffManageRow,
} from "../../../lib/staff-manage";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const id = context.params.id;
  if (!id) return jsonError("Missing employee id", 400);

  const { data, error } = await auth.supabase
    .from("staff")
    .select(STAFF_MANAGE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("staff load failed", error);
    return jsonError("Failed to load employee", 500);
  }

  if (!data) return jsonError("Employee not found", 404);

  return jsonOk({ staff: mapStaffRow(data as StaffManageRow) });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const id = context.params.id;
  if (!id) return jsonError("Missing employee id", 400);

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = mapStaffUpdateBody(body);
  if ("error" in parsed) {
    return jsonError(parsed.error, 400);
  }

  const { data, error } = await auth.supabase
    .from("staff")
    .update(parsed.data)
    .eq("id", id)
    .select(STAFF_MANAGE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("staff update failed", error);
    if (error.code === "23505") {
      return jsonError("An employee with that slug already exists", 409);
    }
    return jsonError("Failed to update employee", 500);
  }

  if (!data) return jsonError("Employee not found", 404);

  return jsonOk({ staff: mapStaffRow(data as StaffManageRow) });
};
