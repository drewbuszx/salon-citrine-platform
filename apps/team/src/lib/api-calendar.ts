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
  return jsonResponse({ ok: false, error: message }, status);
}

export function jsonOk(data: Record<string, unknown> = {}) {
  return jsonResponse({ ok: true, ...data });
}

export async function requireApiAuth(
  context: { request: Request; cookies: AstroCookies; locals: App.Locals },
) {
  const { locals, request, cookies } = context;

  if (locals.staff && locals.user && locals.supabase) {
    return {
      ok: true as const,
      supabase: locals.supabase,
      staff: locals.staff,
      user: locals.user,
    };
  }

  const result = await requireTeamStaff(request, cookies);
  if ("error" in result && result.error) {
    return { ok: false as const, response: result.error };
  }

  return {
    ok: true as const,
    supabase: result.supabase,
    staff: result.staff,
    user: (await result.supabase.auth.getUser()).data.user!,
  };
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
