import type { APIRoute } from "astro";
import { mustChangePassword } from "../../../lib/auth";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return redirect(teamUrl("/login"));
  }

  if (!mustChangePassword(user)) {
    return redirect(teamUrl("/"));
  }

  const form = await request.formData();
  const currentPassword = String(form.get("current_password") ?? "");
  const newPassword = String(form.get("new_password") ?? "");
  const confirmPassword = String(form.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return redirect(teamUrl("/change-password?error=invalid"));
  }

  if (newPassword.length < 8) {
    return redirect(teamUrl("/change-password?error=weak"));
  }

  if (newPassword !== confirmPassword) {
    return redirect(teamUrl("/change-password?error=mismatch"));
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    return redirect(teamUrl("/change-password?error=current"));
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });

  if (updateError) {
    return redirect(teamUrl("/change-password?error=update"));
  }

  return redirect(teamUrl("/"));
};
