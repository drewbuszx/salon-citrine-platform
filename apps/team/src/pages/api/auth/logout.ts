import type { APIRoute } from "astro";
import { SESSION_MODE_COOKIE } from "../../../lib/auth-session";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  await supabase.auth.signOut();

  cookies.delete(SESSION_MODE_COOKIE, {
    path: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
  });

  return redirect(teamUrl("/login"));
};
