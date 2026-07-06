import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIMEZONE } from "@saloncitrine/shared";
import { formatTimeInSalon } from "../../../lib/calendar";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";

const LIST_LIMIT = 100;
const SEARCH_LIMIT = 50;
const ACTIVE_APPOINTMENT_STATUSES = ["booked", "pending", "confirmed", "arrived"];

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  tags?: string[] | null;
  visit_count?: number | null;
  lifetime_value_cents?: number | null;
  last_visit_at?: string | null;
  booking_preferences?: string | null;
};

type AppointmentMeta = {
  providerName: string | null;
  upcomingLabel: string | null;
};

function formatLtv(cents: number | null | undefined) {
  const value = (cents ?? 0) / 100;
  if (value <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatVisitDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatUpcomingLabel(startsAt: string) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(startsAt));
  return `${date} at ${formatTimeInSalon(startsAt)}`;
}

function preferredNameFromPreferences(firstName: string, bookingPreferences: string | null | undefined) {
  const raw = bookingPreferences?.trim();
  if (!raw) return null;
  const goesBy = raw.match(/^goes by\s+(.+)$/i);
  if (goesBy?.[1]) return goesBy[1].trim();
  if (raw.includes("\n") || raw.length > 24) return null;
  if (raw.toLowerCase() === firstName.toLowerCase()) return null;
  return raw;
}

async function loadAppointmentMeta(
  supabase: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, AppointmentMeta>> {
  const meta = new Map<string, AppointmentMeta>();
  if (clientIds.length === 0) return meta;

  const now = new Date().toISOString();

  const [upcomingResult, recentResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("client_id, starts_at, staff ( name )")
      .in("client_id", clientIds)
      .gte("starts_at", now)
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .order("starts_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("client_id, staff ( name )")
      .in("client_id", clientIds)
      .order("starts_at", { ascending: false }),
  ]);

  for (const row of upcomingResult.data ?? []) {
    const clientId = row.client_id as string;
    if (meta.has(clientId)) continue;
    const staff = row.staff as { name: string } | null;
    meta.set(clientId, {
      providerName: staff?.name ?? null,
      upcomingLabel: formatUpcomingLabel(row.starts_at as string),
    });
  }

  for (const row of recentResult.data ?? []) {
    const clientId = row.client_id as string;
    const existing = meta.get(clientId);
    const staff = row.staff as { name: string } | null;
    if (existing) {
      if (!existing.providerName && staff?.name) {
        existing.providerName = staff.name;
      }
      continue;
    }
    meta.set(clientId, {
      providerName: staff?.name ?? null,
      upcomingLabel: null,
    });
  }

  return meta;
}

function mapClientRow(row: ClientRow, meta: AppointmentMeta | undefined) {
  const tags = (row.tags ?? []).filter(Boolean);
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    preferredName: preferredNameFromPreferences(row.first_name, row.booking_preferences),
    phone: row.phone,
    email: row.email,
    tags,
    tagLabels: tags.slice(0, 3),
    visitCount: row.visit_count ?? 0,
    ltvLabel: formatLtv(row.lifetime_value_cents),
    lastVisitLabel: formatVisitDate(row.last_visit_at),
    providerName: meta?.providerName ?? null,
    upcomingLabel: meta?.upcomingLabel ?? null,
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
  const hasVisits = params.get("hasVisits") === "1";

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
    .select(
      "id, first_name, last_name, phone, email, tags, referral_sources, lifetime_value_cents, visit_count, last_visit_at, booking_preferences",
    )
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

  if (hasVisits) {
    query = query.gt("visit_count", 0);
  }

  const { data, error } = await query.limit(term.length >= 2 ? SEARCH_LIMIT : LIST_LIMIT);

  if (error) {
    console.error("client search failed", error);
    return jsonError("Failed to search clients", 500);
  }

  const rows = (data ?? []) as ClientRow[];
  const appointmentMeta = await loadAppointmentMeta(
    supabase,
    rows.map((row) => row.id),
  );
  const clients = rows.map((row) => mapClientRow(row, appointmentMeta.get(row.id)));

  let filtersApplied = 0;
  if (tag) filtersApplied += 1;
  if (referral) filtersApplied += 1;
  if (providerId) filtersApplied += 1;
  if (purchased) filtersApplied += 1;
  if (hasVisits) filtersApplied += 1;

  return jsonOk({
    clients,
    total: totalCount ?? clients.length,
    query: term,
    filtersApplied,
  });
};
