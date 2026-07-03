import type { APIRoute } from "astro";
import { isSalonManager, loadStaffProfile } from "../../../lib/auth";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const serviceId = params.id;
  if (!serviceId) {
    return redirect(teamUrl("/services?error=update"));
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect(teamUrl("/login"));
  }

  const staff = await loadStaffProfile(supabase, user.id);
  if (!staff || !isSalonManager(staff)) {
    return redirect(teamUrl("/"));
  }

  const form = await request.formData();
  const duration = Number(form.get("duration_minutes"));

  if (!Number.isFinite(duration) || duration < 15) {
    return redirect(teamUrl("/services?error=update"));
  }

  const { error } = await supabase
    .from("services")
    .update({ duration_minutes: Math.round(duration) })
    .eq("id", serviceId);

  if (error) {
    console.error("service update failed", error);
    return redirect(teamUrl("/services?error=update"));
  }

  return redirect(teamUrl("/services?saved=1"));
};
