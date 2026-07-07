import type { APIRoute } from "astro";
import { createSupabaseServerClient, teamAbsoluteUrl, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();

  if (!email) {
    return redirect(teamUrl("/forgot-password?error=missing"));
  }

  try {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: teamAbsoluteUrl("/auth/confirm", request),
    });

    if (error) {
      return redirect(teamUrl("/forgot-password?error=send"));
    }
  } catch {
    return redirect(teamUrl("/forgot-password?error=connection"));
  }

  return redirect(teamUrl("/forgot-password?sent=1"));
};
