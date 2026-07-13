import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  mapStaffRow,
  mapStaffUpdateBody,
  STAFF_MANAGE_SELECT,
  type StaffManageRow,
} from "../../../lib/staff-manage";

async function loadPrivateDetails(
  supabase: App.Locals["supabase"],
  staffId: string,
) {
  const { data } = await supabase
    .from("staff_private_details")
    .select("emergency_contact_name, emergency_contact_phone")
    .eq("staff_id", staffId)
    .maybeSingle();
  return data ?? null;
}

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

  const privateDetails = await loadPrivateDetails(auth.supabase, id);

  return jsonOk({
    staff: mapStaffRow(data as StaffManageRow),
    privateDetails,
  });
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

  const hasEmergency =
    typeof body.emergencyContactName === "string" ||
    typeof body.emergencyContactPhone === "string";

  const parsed = mapStaffUpdateBody(body);
  if ("error" in parsed && parsed.error !== "No updates provided") {
    return jsonError(parsed.error ?? "Invalid employee update", 400);
  }
  const staffUpdates = "error" in parsed ? null : parsed.data;
  if (!staffUpdates && !hasEmergency) {
    return jsonError("No updates provided", 400);
  }

  if (staffUpdates) {
    const { error } = await auth.supabase.rpc("manager_update_staff", {
      p_staff_id: id,
      p_updates: staffUpdates,
      p_request_id: context.request.headers.get("X-Request-Id"),
    });

    if (error) {
      console.error("staff update failed", error);
      if (error.code === "23505") {
        return jsonError("An employee with that slug already exists", 409);
      }
      return jsonError("Failed to update employee", 500);
    }
  }

  if (hasEmergency) {
    const { error: pdError } = await auth.supabase
      .from("staff_private_details")
      .upsert(
        {
          staff_id: id,
          emergency_contact_name:
            typeof body.emergencyContactName === "string"
              ? body.emergencyContactName.trim() || null
              : null,
          emergency_contact_phone:
            typeof body.emergencyContactPhone === "string"
              ? body.emergencyContactPhone.trim() || null
              : null,
        },
        { onConflict: "staff_id" },
      );
    if (pdError) {
      console.error("emergency contact update failed", pdError);
      return jsonError("Failed to save emergency contact", 500);
    }
  }

  const { data, error: loadError } = await auth.supabase
    .from("staff")
    .select(STAFF_MANAGE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (loadError || !data) return jsonError("Employee not found", 404);

  const privateDetails = await loadPrivateDetails(auth.supabase, id);

  return jsonOk({ staff: mapStaffRow(data as StaffManageRow), privateDetails });
};