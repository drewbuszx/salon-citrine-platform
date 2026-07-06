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
  const params = context.url.searchParams;
  const q = String(params.get("q") ?? "").trim();
  const term = q.replace(/,/g, " ").trim();
  const tag = String(params.get("tag") ?? "").trim();
  const referral = String(params.get("referral") ?? "").trim();
  const providerId = String(params.get("provider") ?? "").trim();
  const purchased = params.get("purchased") === "1";

  const { count: totalCount, error: countError } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("client count failed", countError);
    return jsonError("Failed to load clients", 500);
  }

  if (term.length > 0 && term.length < 2) {
    return jsonOk({ clients: [], total: totalCount ?? 0, query: term, filtersApplied: 0 });
  }

  let clientIds: string[] | null = null;

  if (providerId) {
    const { data: apptRows, error: apptError } = await supabase
      .from("appointments")
      .select("client_id")
      .eq("staff_id", providerId);

    if (apptError) {
      console.error("client provider filter failed", apptError);
      return jsonError("Failed to filter by provider", 500);
    }

    clientIds = [...new Set((apptRows ?? []).map((row) => row.client_id as string))];
    if (clientIds.length === 0) {
      return jsonOk({ clients: [], total: totalCount ?? 0, query: term, filtersApplied: 1 });
    }
  }

  let query = supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email, tags, referral_sources, lifetime_value_cents")
    .order("last_name")
    .order("first_name");

  if (term.length >= 2) {
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  if (clientIds) {
    query = query.in("id", clientIds);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (referral) {
    query = query.contains("referral_sources", [referral]);
  }

  if (purchased) {
    query = query.gt("lifetime_value_cents", 0);
  }

  const { data, error } = await query.limit(term.length >= 2 ? SEARCH_LIMIT : LIST_LIMIT);

  if (error) {
    console.error("client search failed", error);
    return jsonError("Failed to search clients", 500);
  }

  const clients = (data ?? []).map(mapClientRow);
  let filtersApplied = 0;
  if (tag) filtersApplied += 1;
  if (referral) filtersApplied += 1;
  if (providerId) filtersApplied += 1;
  if (purchased) filtersApplied += 1;

  return jsonOk({
    clients,
    total: totalCount ?? clients.length,
    query: term,
    filtersApplied,
  });
};
