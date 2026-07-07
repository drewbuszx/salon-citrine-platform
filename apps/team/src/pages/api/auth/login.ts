import type { APIRoute } from "astro";
import { mustChangePassword } from "../../../lib/auth";
import {
  REMEMBER_MAX_AGE,
  SESSION_MAX_AGE,
  SESSION_MODE_COOKIE,
  sessionModeFromRemember,
} from "../../../lib/auth-session";
import { mapSupabaseAuthError } from "../../../lib/login-errors";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

function loginRedirect(
  error: string,
  email: string,
  redirect: (location: string, status?: number) => Response,
) {
  const params = new URLSearchParams({ error });
  if (email) params.set("email", email);
  return redirect(teamUrl(`/login?${params.toString()}`));
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "").trim();
  const remember = form.get("remember") === "on";

  if (!email || !password) {
    return loginRedirect("invalid", email, redirect);
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient(request, cookies, {
      maxAge: remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE,
    });
  } catch {
    return loginRedirect("config", email, redirect);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return loginRedirect(mapSupabaseAuthError(error.message), email, redirect);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return loginRedirect("connection", email, redirect);
  }

  const bannedUntil =
    "banned_until" in user && typeof user.banned_until === "string"
      ? user.banned_until
      : null;

  if (bannedUntil && new Date(bannedUntil) > new Date()) {
    await supabase.auth.signOut();
    return loginRedirect("locked", email, redirect);
  }

  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("supabase_user_id", user.id)
    .maybeSingle();

  if (!staffRow) {
    await supabase.auth.signOut();
    return loginRedirect("unlinked", email, redirect);
  }

  const sessionMode = sessionModeFromRemember(remember);
  const sessionMaxAge = remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  cookies.set(SESSION_MODE_COOKIE, sessionMode, {
    path: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
    maxAge: sessionMaxAge,
    sameSite: "lax",
    httpOnly: false,
    secure: import.meta.env.PROD,
  });

  if (mustChangePassword(user)) {
    return redirect(teamUrl("/change-password"));
  }

  return redirect(teamUrl("/"));
};
