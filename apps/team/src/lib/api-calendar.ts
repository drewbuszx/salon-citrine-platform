import type { AstroCookies } from "astro";
import type { StaffProfile } from "../env.d.ts";
import { isSalonManager, loadStaffProfile } from "./auth";
import { createSupabaseServerClient } from "./supabase-server";

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

export async function requireTeamStaff(request: Request, cookies: AstroCookies) {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: jsonError("Unauthorized", 401) as Response };
  }

  const staff = await loadStaffProfile(supabase, user.id);
  if (!staff) {
    return { error: jsonError("Staff profile not linked", 403) as Response };
  }

  return { supabase, staff };
}

export function canManageStaffColumn(
  actor: StaffProfile,
  targetStaffId: string,
) {
  return isSalonManager(actor) || actor.id === targetStaffId;
}

export function parseClientName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return null;
  }
  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { firstName: trimmed, lastName: "." };
  }
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim() || ".",
  };
}
