import type { APIRoute } from "astro";
import { createSupabaseServerClient, teamUrl } from "../../../lib/supabase-server";

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { access_token?: string; refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
  }

  const accessToken = body.access_token?.trim();
  const refreshToken = body.refresh_token?.trim();
  if (!accessToken || !refreshToken) {
    return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient(request, cookies);
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return new Response(JSON.stringify({ error: "session" }), { status: 401 });
    }

    return new Response(JSON.stringify({ ok: true, redirect: teamUrl("/reset-password") }));
  } catch {
    return new Response(JSON.stringify({ error: "config" }), { status: 503 });
  }
};
