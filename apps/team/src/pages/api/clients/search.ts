import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIMEZONE } from "@saloncitrine/shared";
import { formatTimeInSalon } from "../../../lib/calendar";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  clientInitials,
  formatLtvDisplay,
  formatPhoneDisplay,
  preferredNameFromPreferences,
} from "../../../lib/client-format";
import type { ClientSortKey } from "../../../lib/clients-types";

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;
const SEARCH_LIMIT = 50;
const ACTIVE_APPOINTMENT_STATUSES = ["booked", "pending", "confirmed", "arrived"];

const SORT_KEYS: ClientSortKey[] = [
  "name",
  "recently_added",
  "last_visit",
  "next_appointment",
  "visits",
  "ltv",
];

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
  created_at?: string | null;
};

type AppointmentMeta = {
  providerName: string | null;
  upcomingLabel: string | null;
  upcomingAt: string | null;
};

function salonMonthStartIso() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return new Date(`${year}-${month}-01T00:00:00`).toISOString();
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
      upcomingAt: row.starts_at as string,
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
      upcomingAt: null,
    });
  }

  return meta;
}

function mapClientRow(row: ClientRow, meta: AppointmentMeta | undefined) {
  const tags = (row.tags ?? []).filter(Boolean);
  const visitCount = row.visit_count ?? 0;
  const ltv = formatLtvDisplay(row.lifetime_value_cents, visitCount);
  const phoneDisplay = formatPhoneDisplay(row.phone);
  const emailDisplay = row.email?.trim() || null;

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    preferredName: preferredNameFromPreferences(row.first_name, row.booking_preferences),
    phone: row.phone,
    email: row.email,
    phoneDisplay,
    emailDisplay,
    tags,
    tagLabels: tags.slice(0, 3),
    visitCount,
    ltvCents: row.lifetime_value_cents ?? 0,
    ltvLabel: ltv.label,
    ltvTitle: ltv.title,
    ltvKind: ltv.kind,
    lastVisitLabel: formatVisitDate(row.last_visit_at),
    providerName: meta?.providerName ?? null,
    upcomingLabel: meta?.upcomingLabel ?? null,
    upcomingAt: meta?.upcomingAt ?? null,
    initials: clientInitials(row.first_name, row.last_name),
  };
}

function sortClients<T extends ReturnType<typeof mapClientRow>>(clients: T[], sort: ClientSortKey): T[] {
  const copy = [...clients];
  switch (sort) {
    case "recently_added":
      return copy;
    case "last_visit":
      return copy.sort((a, b) => {
        const aHas = a.lastVisitLabel ? 1 : 0;
        const bHas = b.lastVisitLabel ? 1 : 0;
        return bHas - aHas || b.visitCount - a.visitCount;
      });
    case "next_appointment":
      return copy.sort((a, b) => {
        if (a.upcomingAt && b.upcomingAt) {
          return a.upcomingAt.localeCompare(b.upcomingAt);
        }
        if (a.upcomingAt) return -1;
        if (b.upcomingAt) return 1;
        return a.fullName.localeCompare(b.fullName);
      });
    case "visits":
      return copy.sort((a, b) => b.visitCount - a.visitCount || a.fullName.localeCompare(b.fullName));
    case "ltv":
      return copy.sort((a, b) => b.ltvCents - a.ltvCents || b.visitCount - a.visitCount);
    case "name":
    default:
      return copy.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}

async function loadSummary(supabase: SupabaseClient, total: number) {
  const monthStart = salonMonthStartIso();
  const now = new Date().toISOString();

  const [newMonthResult, upcomingResult] = await Promise.all([
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .gte("created_at", monthStart),
    supabase
      .from("appointments")
      .select("client_id")
      .gte("starts_at", now)
      .in("status", ACTIVE_APPOINTMENT_STATUSES),
  ]);

  const upcomingIds = new Set(
    (upcomingResult.data ?? []).map((row) => row.client_id as string),
  );
  const withUpcoming = upcomingIds.size;

  return {
    total,
    newThisMonth: newMonthResult.count ?? 0,
    withUpcoming,
    withoutUpcoming: Math.max(0, total - withUpcoming),
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
  const sortParam = String(params.get("sort") ?? "name") as ClientSortKey;
  const sort: ClientSortKey = SORT_KEYS.includes(sortParam) ? sortParam : "name";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const perPageRaw = Number.parseInt(params.get("perPage") ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageRaw));
  const isSearch = term.length >= 2;

  const { count: totalCount, error: countError } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("client count failed", countError);
    return jsonError("Failed to load clients", 500);
  }

  const total = totalCount ?? 0;
  const summary = await loadSummary(supabase, total);

  if (term.length > 0 && term.length < 2) {
    return jsonOk({
      clients: [],
      total,
      filteredTotal: 0,
      query: term,
      filtersApplied: 0,
      sort,
      page: 1,
      perPage,
      totalPages: 0,
      rangeStart: 0,
      rangeEnd: 0,
      summary,
    });
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
      return jsonOk({
        clients: [],
        total,
        filteredTotal: 0,
        query: term,
        filtersApplied: 1,
        sort,
        page: 1,
        perPage,
        totalPages: 0,
        rangeStart: 0,
        rangeEnd: 0,
        summary,
      });
    }
  }

  let query = supabase
    .from("clients")
    .select(
      "id, first_name, last_name, phone, email, tags, referral_sources, lifetime_value_cents, visit_count, last_visit_at, booking_preferences, created_at",
    );

  if (sort === "recently_added") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "last_visit") {
    query = query.order("last_visit_at", { ascending: false, nullsFirst: false });
  } else if (sort === "visits") {
    query = query.order("visit_count", { ascending: false });
  } else if (sort === "ltv") {
    query = query.order("lifetime_value_cents", { ascending: false });
  } else {
    query = query.order("last_name").order("first_name");
  }

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

  const fetchLimit = isSearch ? SEARCH_LIMIT : MAX_PER_PAGE;
  const { data, error } = await query.limit(fetchLimit);

  if (error) {
    console.error("client search failed", error);
    return jsonError("Failed to search clients", 500);
  }

  const rows = (data ?? []) as ClientRow[];
  const appointmentMeta = await loadAppointmentMeta(
    supabase,
    rows.map((row) => row.id),
  );

  let clients = rows.map((row) => mapClientRow(row, appointmentMeta.get(row.id)));

  if (sort === "next_appointment" || sort === "name") {
    clients = sortClients(clients, sort);
  }

  const filteredTotal = clients.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / perPage));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * perPage;
  const pageClients = clients.slice(startIndex, startIndex + perPage);
  const rangeStart = filteredTotal === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + perPage, filteredTotal);

  let filtersApplied = 0;
  if (tag) filtersApplied += 1;
  if (referral) filtersApplied += 1;
  if (providerId) filtersApplied += 1;
  if (purchased) filtersApplied += 1;
  if (hasVisits) filtersApplied += 1;

  return jsonOk({
    clients: pageClients,
    total,
    filteredTotal,
    query: term,
    filtersApplied,
    sort,
    page: safePage,
    perPage,
    totalPages: filteredTotal === 0 ? 0 : totalPages,
    rangeStart,
    rangeEnd,
    summary,
  });
};
