import type { APIRoute } from "astro";
import { teamUrl } from "../../lib/supabase-server";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { supabase, staff, user } = locals;

  if (!staff || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!name || !email) {
    return redirect(teamUrl("/account?error=save"));
  }

  const { error: staffError } = await supabase
    .from("staff")
    .update({
      name,
      bio: bio || null,
      phone: phone || null,
    })
    .eq("id", staff.id);

  if (staffError) {
    console.error("Staff profile update failed", staffError);
    return redirect(teamUrl("/account?error=save"));
  }

  let emailPending = false;
  const currentEmail = user.email?.toLowerCase() ?? "";

  if (email !== currentEmail) {
    const { error: emailError } = await supabase.auth.updateUser({ email });

    if (emailError) {
      console.error("Email update failed", emailError);
      return redirect(teamUrl("/account?error=email"));
    }

    emailPending = true;
  }

  const params = new URLSearchParams({ saved: "1" });
  if (emailPending) {
    params.set("email", "pending");
  }

  return redirect(teamUrl(`/account?${params.toString()}`));
};
