import type { APIRoute } from "astro";
import {
  canManageStaffColumn,
  jsonError,
  jsonOk,
  requireApiAuth,
} from "../../../lib/api-calendar";

type PatchProfileBody = {
  staff_id?: string;
  accepting_new_clients?: boolean;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  let body: PatchProfileBody;

  try {
    body = (await context.request.json()) as PatchProfileBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const staffId = String(body.staff_id ?? staff.id);

  if (typeof body.accepting_new_clients !== "boolean") {
    return jsonError("accepting_new_clients must be a boolean", 400);
  }

  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  const { error } = await supabase
    .from("staff")
    .update({ accepting_new_clients: body.accepting_new_clients })
    .eq("id", staffId);

  if (error) {
    console.error("staff accepting_new_clients update failed", error);
    return jsonError("Failed to update profile", 500);
  }

  return jsonOk({
    acceptingNewClients: body.accepting_new_clients,
  });
};
