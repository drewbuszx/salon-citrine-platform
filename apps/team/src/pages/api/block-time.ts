import type { APIRoute } from "astro";
import { isSalonManager, loadStaffProfile } from "../../lib/auth";
import { parseDateTimeLocalInput } from "../../lib/datetime";
import { createSupabaseServerClient, teamUrl } from "../../lib/supabase-server";

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
  const staffId = String(form.get("staff_id") ?? "");
  const startsRaw = String(form.get("starts_at") ?? "");
  const endsRaw = String(form.get("ends_at") ?? "");
  const reasonRaw = String(form.get("reason") ?? "").trim();

  if (!staffId || !startsRaw || !endsRaw) {
    return redirect(teamUrl("/block-time?error=invalid"));
  }

  if (!isSalonManager(staff) && staffId !== staff.id) {
    return redirect(teamUrl("/block-time?error=invalid"));
  }

  try {
    const startsAt = parseDateTimeLocalInput(startsRaw);
    const endsAt = parseDateTimeLocalInput(endsRaw);

    if (startsAt >= endsAt) {
      return redirect(teamUrl("/block-time?error=invalid"));
    }

    const { error } = await supabase.from("blocked_times").insert({
      staff_id: staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason: reasonRaw || null,
    });

    if (error) {
      console.error("block-time insert failed", error);
      return redirect(teamUrl("/block-time?error=invalid"));
    }

    return redirect(teamUrl("/block-time?saved=1"));
  } catch {
    return redirect(teamUrl("/block-time?error=invalid"));
  }
};
