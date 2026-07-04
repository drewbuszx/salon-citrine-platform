import type { APIRoute } from "astro";
import { canManageStaffColumn, jsonError, jsonResponse, requireTeamStaff } from "../../lib/api-calendar";
import { isSalonManager, loadStaffProfile } from "../../lib/auth";
import { loadStaffServicesByStaff } from "../../lib/calendar";
import { createSupabaseServerClient, teamUrl } from "../../lib/supabase-server";

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const auth = await requireTeamStaff(request, cookies);
  if ("error" in auth && auth.error) {
    return auth.error;
  }
  const { supabase, staff } = auth;

  const staffId = url.searchParams.get("staff_id") ?? staff.id;
  if (!canManageStaffColumn(staff, staffId)) {
    return jsonError("Forbidden", 403);
  }

  try {
    const servicesByStaff = await loadStaffServicesByStaff(supabase, [staffId]);
    return jsonResponse({ services: servicesByStaff[staffId] ?? [] });
  } catch (error) {
    console.error("staff services load failed", error);
    return jsonError("Failed to load services", 500);
  }
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect(teamUrl("/login"));
  }

  const staff = await loadStaffProfile(supabase, user.id);
  if (!staff) {
    return redirect(teamUrl("/login?error=unlinked"));
  }

  const form = await request.formData();
  const serviceId = String(form.get("service_id") ?? "");
  const staffId = String(form.get("staff_id") ?? staff.id);
  const returningClientsOnly = form.get("returning_clients_only") === "1";
  const returnTo = String(form.get("return_to") ?? teamUrl("/my-services"));

  if (!serviceId) {
    return redirect(`${returnTo}?error=update`);
  }

  if (!isSalonManager(staff) && staffId !== staff.id) {
    return redirect(teamUrl("/"));
  }

  const { error } = await supabase
    .from("staff_services")
    .update({ returning_clients_only: returningClientsOnly })
    .eq("staff_id", staffId)
    .eq("service_id", serviceId);

  if (error) {
    console.error("staff_services update failed", error);
    return redirect(`${returnTo}?error=update`);
  }

  const separator = returnTo.includes("?") ? "&" : "?";
  return redirect(`${returnTo}${separator}saved=1`);
};
