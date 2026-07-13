import type { APIRoute } from "astro";
import { jsonError, jsonOk, jsonResponse, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  mapStaffCreateBody,
  mapStaffRow,
  STAFF_MANAGE_SELECT,
  type StaffManageRow,
} from "../../../lib/staff-manage";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const { data, error } = await auth.supabase
    .from("staff")
    .select(STAFF_MANAGE_SELECT)
    .order("name");

  if (error) {
    console.error("staff list failed", error);
    return jsonError("Failed to load employees", 500);
  }

  return jsonOk({
    staff: (data ?? []).map((row) => mapStaffRow(row as StaffManageRow)),
  });
};

export const POST: APIRoute = async (context) => {
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

  const parsed = mapStaffCreateBody(body);
  if ("error" in parsed) {
    return jsonError(parsed.error ?? "Invalid employee", 400);
  }

  const { data, error } = await auth.supabase
    .from("staff")
    .insert(parsed.data)
    .select(STAFF_MANAGE_SELECT)
    .single();

  if (error) {
    console.error("staff create failed", error);
    if (error.code === "23505") {
      return jsonError("An employee with that slug already exists", 409);
    }
    return jsonError("Failed to create employee", 500);
  }

  return jsonResponse({ ok: true, staff: mapStaffRow(data as StaffManageRow) }, 201);
};
