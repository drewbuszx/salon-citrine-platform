import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase } = auth;
  const q = String(context.url.searchParams.get("q") ?? "").trim();

  const term = q.replace(/,/g, " ").trim();
  if (term.length < 2) {
    return jsonOk({ clients: [] });
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email")
    .or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    )
    .order("last_name")
    .order("first_name")
    .limit(10);

  if (error) {
    console.error("client search failed", error);
    return jsonError("Failed to search clients", 500);
  }

  const clients = (data ?? []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    phone: row.phone,
    email: row.email,
  }));

  return jsonOk({ clients });
};
