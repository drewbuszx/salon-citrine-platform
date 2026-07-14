import type { APIRoute } from "astro";
import { sanitizeBioInput } from "../../../lib/staff-bio";
import { teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { supabase, staff } = locals;

  if (!staff) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const bio = sanitizeBioInput(form.get("bio"));

  if (!bio) {
    return redirect(teamUrl("/account?error=bio"));
  }

  const { error } = await supabase.rpc("submit_own_staff_bio", {
    p_bio: bio,
  });

  if (error) {
    console.error("Bio submit failed", error);
    return redirect(teamUrl("/account?error=bio"));
  }

  return redirect(teamUrl("/account?saved=1&bio=pending#account-bio"));
};
