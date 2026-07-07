import type { APIRoute } from "astro";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect(teamUrl("/login?error=reset_expired"));
  }

  const form = await request.formData();
  const newPassword = String(form.get("new_password") ?? "");
  const confirmPassword = String(form.get("confirm_password") ?? "");

  if (!newPassword || !confirmPassword) {
    return redirect(teamUrl("/reset-password?error=invalid"));
  }

  if (newPassword.length < 8) {
    return redirect(teamUrl("/reset-password?error=weak"));
  }

  if (newPassword !== confirmPassword) {
    return redirect(teamUrl("/reset-password?error=mismatch"));
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });

  if (error) {
    return redirect(teamUrl("/reset-password?error=update"));
  }

  return redirect(teamUrl("/"));
};
