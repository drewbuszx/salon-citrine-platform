import type { APIRoute } from "astro";
import { isSalonManager } from "../../../lib/auth";
import { teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { supabase, staff } = locals;

  if (!staff || !isSalonManager(staff)) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const staffId = String(form.get("staff_id") ?? "").trim();
  const action = String(form.get("action") ?? "").trim().toLowerCase();
  const note = String(form.get("note") ?? "").trim();

  if (!staffId || (action !== "approve" && action !== "decline")) {
    return redirect(teamUrl("/manage/bios?error=review"));
  }

  const { error } = await supabase.rpc("review_staff_bio", {
    p_staff_id: staffId,
    p_action: action,
    p_note: note || null,
  });

  if (error) {
    console.error("Bio review failed", error);
    return redirect(teamUrl("/manage/bios?error=review"));
  }

  const params = new URLSearchParams({ reviewed: "1", action });
  return redirect(teamUrl(`/manage/bios?${params.toString()}`));
};
