import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { parseCapabilityPatchRequest } from "../../../lib/api-contract";
import {
  CAPABILITY_ROLES,
  isKnownCapability,
  isKnownRole,
} from "../../../lib/capabilities";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;
  if (auth.staff.role !== "owner") return jsonError("Forbidden", 403);

  const [caps, grants] = await Promise.all([
    auth.supabase
      .from("capabilities")
      .select("key, label, description, sort_order")
      .order("sort_order"),
    auth.supabase.from("role_capabilities").select("role, capability"),
  ]);

  if (caps.error || grants.error) {
    console.error("capabilities load failed", caps.error ?? grants.error);
    return jsonError("Failed to load permissions", 500);
  }

  const matrix: Record<string, string[]> = {};
  for (const role of CAPABILITY_ROLES) matrix[role] = [];
  for (const grant of grants.data ?? []) {
    if (matrix[grant.role]) matrix[grant.role].push(grant.capability);
  }

  return jsonOk({
    capabilities: caps.data ?? [],
    roles: CAPABILITY_ROLES,
    grants: matrix,
  });
};

function friendlyCapabilityError(message: string): string {
  if (message.includes("owners must retain manage_team")) {
    return "Owners must always keep the manage team permission.";
  }
  if (message.includes("owner required")) {
    return "Only owners can edit permissions.";
  }
  return "Could not update permission.";
}

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;
  if (auth.staff.role !== "owner") return jsonError("Forbidden", 403);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = parseCapabilityPatchRequest(body, {
    isKnownRole,
    isKnownCapability,
  });
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { role, capability, enabled } = parsed.value;

  const { error } = await auth.supabase.rpc("set_role_capability", {
    p_role: role,
    p_capability: capability,
    p_enabled: enabled,
  });

  if (error) {
    console.error("set_role_capability failed", error);
    const status = error.code === "42501" ? 403 : 400;
    return jsonError(friendlyCapabilityError(String(error.message ?? "")), status);
  }

  return jsonOk({ role, capability, enabled });
};
