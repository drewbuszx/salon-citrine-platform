import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { isSalonManager } from "../../../lib/auth";
import {
  AUDIT_ACTIONS,
  mapAuditRow,
  STAFF_AUDIT_SELECT,
  type StaffAuditRow,
} from "../../../lib/staff-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!isSalonManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const params = context.url.searchParams;
  const action = params.get("action") ?? "";
  const employee = params.get("employee") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 100) || 100, 1), 200);

  let query = auth.supabase
    .from("staff_security_audit")
    .select(STAFF_AUDIT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action && (AUDIT_ACTIONS as readonly string[]).includes(action)) {
    query = query.eq("action", action);
  }
  if (employee && UUID_RE.test(employee)) {
    query = query.eq("target_staff_id", employee);
  }
  if (from && DATE_RE.test(from)) {
    query = query.gte("created_at", `${from}T00:00:00Z`);
  }
  if (to && DATE_RE.test(to)) {
    query = query.lte("created_at", `${to}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("audit load failed", error);
    return jsonError("Failed to load activity", 500);
  }

  return jsonOk({
    entries: (data ?? []).map((row) => mapAuditRow(row as unknown as StaffAuditRow)),
  });
};