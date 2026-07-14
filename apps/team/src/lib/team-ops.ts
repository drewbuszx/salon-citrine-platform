import type { SupabaseClient } from "@supabase/supabase-js";
import { countPendingTimeOff, EVENT_SELECT, mapEvent, type EventRow } from "./api-events";
import { birthdaysForRange, type BirthdayRow } from "./api-birthdays";
import type { StaffProfile } from "../env.d.ts";

/**
 * Employee-management dashboard data helpers.
 *
 * These read real Tasks/Events data that still exists after the scale-back.
 * Task metrics and salon routines reuse the existing loaders in
 * `api-tasks.ts` / `api-routines.ts`; this module adds a compact
 * "upcoming team events" loader for the dashboard.
 */

export type UpcomingEventItem = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  staffName: string | null;
};

export type ManagerDashboardCounts = {
  pendingTimeOff: number;
  pendingInvites: number;
  pendingBios: number;
  needsAttention: number;
};

/** Real manager attention counts — never invent numbers. */
export async function loadManagerDashboardCounts(
  supabase: SupabaseClient,
  staff: StaffProfile,
  needsAttention: number,
): Promise<ManagerDashboardCounts> {
  let pendingTimeOff = 0;
  let pendingInvites = 0;
  let pendingBios = 0;

  try {
    pendingTimeOff = await countPendingTimeOff(supabase, staff);
  } catch (error) {
    console.error("Failed to count pending time off", error);
  }

  try {
    const { count, error } = await supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("access_status", "invited");
    if (error) throw error;
    pendingInvites = count ?? 0;
  } catch (error) {
    console.error("Failed to count pending invites", error);
  }

  try {
    const { count, error } = await supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("bio_status", "pending");
    if (error) throw error;
    pendingBios = count ?? 0;
  } catch (error) {
    console.error("Failed to count pending bios", error);
  }

  return { pendingTimeOff, pendingInvites, pendingBios, needsAttention };
}

/**
 * Load active team events (and staff birthdays) starting within the next
 * `days` days, sorted soonest-first. Mirrors the /api/events windowing so the
 * dashboard and the Events page agree on what "upcoming" means.
 */
export async function loadUpcomingTeamEvents(
  supabase: SupabaseClient,
  staff: StaffProfile,
  days = 14,
  limit = 6,
): Promise<UpcomingEventItem[]> {
  const now = new Date();
  const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const fromMs = now.getTime();
  const toMs = to.getTime();

  const items: UpcomingEventItem[] = [];

  try {
    const { data, error } = await supabase
      .from("team_events")
      .select(EVENT_SELECT)
      .eq("is_active", true)
      .lte("starts_at", to.toISOString())
      .order("starts_at", { ascending: true });

    if (error) throw error;

    for (const row of data ?? []) {
      const startsMs = new Date(row.starts_at as string).getTime();
      const endsMs = row.ends_at
        ? new Date(row.ends_at as string).getTime()
        : startsMs;
      // Include anything overlapping the window whose start hasn't fully passed.
      if (endsMs < fromMs || startsMs > toMs) continue;
      const mapped = mapEvent(row as EventRow, staff);
      items.push({
        id: mapped.id,
        title: mapped.title,
        eventType: mapped.eventType,
        startsAt: mapped.startsAt,
        endsAt: mapped.endsAt,
        allDay: mapped.allDay,
        staffName: mapped.staffName,
      });
    }
  } catch (error) {
    console.error("Failed to load upcoming team events", error);
  }

  try {
    const { data: staffBirthdays, error } = await supabase
      .from("staff")
      .select("id, name, birthday")
      .not("birthday", "is", null);

    if (error) throw error;

    const rows: BirthdayRow[] = (staffBirthdays ?? [])
      .filter((row) => row.birthday)
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        birthday: String(row.birthday),
        source: "staff" as const,
        staffId: row.id as string,
      }));

    // birthdaysForRange resolves occurrences for the month of the given date;
    // compute for both the start month and end month so a window that crosses
    // a month boundary still surfaces the right birthdays.
    const occurrences = [
      ...birthdaysForRange(rows, now.toISOString(), staff.id),
      ...birthdaysForRange(rows, to.toISOString(), staff.id),
    ];

    const seen = new Set<string>();
    for (const event of occurrences) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const startsMs = new Date(event.startsAt).getTime();
      if (startsMs < fromMs || startsMs > toMs) continue;
      items.push({
        id: event.id,
        title: event.title,
        eventType: event.eventType,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        staffName: event.staffName,
      });
    }
  } catch (error) {
    console.error("Failed to load staff birthdays", error);
  }

  items.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return items.slice(0, limit);
}
