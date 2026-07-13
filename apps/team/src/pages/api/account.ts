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
  const emergencyName = String(form.get("emergency_contact_name") ?? "").trim();
  const emergencyPhone = String(form.get("emergency_contact_phone") ?? "").trim();

  if (!name || !email) {
    return redirect(teamUrl("/account?error=save"));
  }

  const { error: staffError } = await supabase.rpc("update_own_staff_profile", {
    p_name: name,
    p_bio: bio || null,
    p_phone: phone || null,
  });

  if (staffError) {
    console.error("Staff profile update failed", staffError);
    return redirect(teamUrl("/account?error=save"));
  }

  const { error: emergencyError } = await supabase
    .from("staff_private_details")
    .upsert(
      {
        staff_id: staff.id,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
      },
      { onConflict: "staff_id" },
    );

  if (emergencyError) {
    console.error("Emergency contact update failed", emergencyError);
    return redirect(teamUrl("/account?error=save"));
  }

  let emailPending = false;
  const currentEmail = user.email?.toLowerCase() ?? "";

  if (email !== currentEmail) {
    const { error: emailError } = await supabase.auth.updateUser({ email });

    if (emailError) {
      console.error("Email update failed", emailError);
      const { error: compensationError } = await supabase.rpc(
        "update_own_staff_profile",
        {
          p_name: staff.name,
          p_bio: staff.bio ?? null,
          p_phone: staff.phone ?? null,
        },
      );
      if (compensationError) {
        console.error("Staff profile compensation failed", compensationError);
      }
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