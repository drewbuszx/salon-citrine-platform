import type { APIRoute } from "astro";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  teamUrl,
} from "../../../lib/supabase-server";
import { isPendingInvite } from "../../../lib/staff-access-admin";
import { grantPasswordSetupContext } from "../../../lib/password-setup-context";

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { access_token?: string; refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accessToken = body.access_token?.trim();
  const refreshToken = body.refresh_token?.trim();
  if (!accessToken || !refreshToken) {
    return new Response(JSON.stringify({ error: "missing" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data: sessionData, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !sessionData.user) {
      await supabase.auth.signOut();
      return new Response(JSON.stringify({ error: "session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Do not activate staff here. Only mark a verified password-setup context and
    // let the reset-password handler activate atomically after the password is set.
    let pending = false;
    try {
      pending = await isPendingInvite(
        createSupabaseAdminClient(),
        sessionData.user.id,
      );
    } catch {
      pending = false;
    }
    grantPasswordSetupContext(cookies, pending ? "invite" : "recovery");

    return new Response(
      JSON.stringify({
        ok: true,
        redirect: teamUrl(pending ? "/reset-password?flow=invite" : "/reset-password"),
      }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch {
    return new Response(JSON.stringify({ error: "config" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
};
