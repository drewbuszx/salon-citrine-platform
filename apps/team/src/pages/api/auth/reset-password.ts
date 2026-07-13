import type { APIRoute } from "astro";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  teamUrl,
} from "../../../lib/supabase-server";
import { confirmStaffInvite } from "../../../lib/staff-access-admin";
import {
  clearPasswordSetupContext,
  hasPasswordSetupContext,
} from "../../../lib/password-setup-context";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Only a verified recovery/invite context may set a password without the current
  // one. An ordinary authenticated session lacks this server-set cookie.
  if (!hasPasswordSetupContext(cookies)) {
    return redirect(teamUrl("/login?error=reset_expired"));
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    clearPasswordSetupContext(cookies);
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

  // Password is established. Now activate a pending invited staff row atomically,
  // deriving the subject from the authenticated Auth UUID and database state only.
  try {
    await confirmStaffInvite(
      createSupabaseAdminClient(),
      user,
      request.headers.get("X-Request-Id"),
    );
  } catch (activationError) {
    console.error("invite activation after password setup failed", activationError);
    clearPasswordSetupContext(cookies);
    await supabase.auth.signOut();
    return redirect(teamUrl("/login?error=invite_activation"));
  }

  clearPasswordSetupContext(cookies);
  return redirect(teamUrl("/"));
};
