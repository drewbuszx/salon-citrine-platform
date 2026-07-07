import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { loadTaskSummary, requireManager } from "../../../lib/api-tasks";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const manager = requireManager(staff);

  try {
    const summary = await loadTaskSummary(supabase, staff.id, manager);
    return jsonOk({ summary, manager });
  } catch (error) {
    console.error("tasks summary failed", error);
    return jsonError("Failed to load task summary", 500);
  }
};
