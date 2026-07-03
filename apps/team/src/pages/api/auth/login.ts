import type { APIRoute } from "astro";
import { mustChangePassword } from "../../../lib/auth";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return redirect(teamUrl("/login?error=invalid"));
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(teamUrl("/login?error=invalid"));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (mustChangePassword(user)) {
    return redirect(teamUrl("/change-password"));
  }

  return redirect(teamUrl("/"));
};
