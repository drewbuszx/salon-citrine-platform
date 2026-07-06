import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";

const LIST_LIMIT = 100;
const SEARCH_LIMIT = 50;

function mapClientRow(row: {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
}) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    phone: row.phone,
    email: row.email,
  };
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase } = auth;
  const q = String(context.url.searchParams.get("q") ?? "").trim();
  const term = q.replace(/,/g, " ").trim();

  const { count: totalCount, error: countError } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("client count failed", countError);
    return jsonError("Failed to load clients", 500);
  }

  if (term.length > 0 && term.length < 2) {
    return jsonOk({ clients: [], total: totalCount ?? 0, query: term });
  }

  let query = supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email")
    .order("last_name")
    .order("first_name");

  if (term.length >= 2) {
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data, error } = await query.limit(term.length >= 2 ? SEARCH_LIMIT : LIST_LIMIT);

  if (error) {
    console.error("client search failed", error);
    return jsonError("Failed to search clients", 500);
  }

  const clients = (data ?? []).map(mapClientRow);

  return jsonOk({
    clients,
    total: totalCount ?? clients.length,
    query: term,
  });
};
