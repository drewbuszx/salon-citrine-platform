import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Manager access required", 403);
  }

  const id = context.params.id;
  if (!id) return jsonError("Missing waitlist id", 400);

  let body: { status?: string; notes?: string };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const allowed = ["active", "notified", "booked", "expired", "cancelled"];
  if (body.status && !allowed.includes(body.status)) {
    return jsonError("Invalid status", 400);
  }

  try {
    const patch: Record<string, string> = {};
    if (body.status) patch.status = body.status;
    if (body.notes != null) patch.notes = body.notes;

    if (Object.keys(patch).length === 0) {
      return jsonError("Nothing to update", 400);
    }

    const { data, error } = await auth.supabase
      .from("waitlist_entries")
      .update(patch)
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) return jsonError("Waitlist entry not found", 404);

    return jsonOk({ entry: data });
  } catch (error) {
    console.error("waitlist PATCH", error);
    return jsonError("Failed to update waitlist entry", 500);
  }
};
