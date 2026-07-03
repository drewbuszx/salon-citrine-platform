import { TIMEZONE } from "@saloncitrine/shared";

export type CalendarAppointment = {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  clientLabel: string;
  serviceLabel: string | null;
};

export type CalendarBlockedTime = {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type CalendarStaff = {
  id: string;
  slug: string;
  name: string;
};

export function parseWeekParam(value: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfWeek(parsed);
    }
  }
  return startOfWeek(new Date());
}

export function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

export function formatWeekParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftWeek(weekStart: Date, deltaWeeks: number) {
  const next = new Date(weekStart);
  next.setDate(next.getDate() + deltaWeeks * 7);
  return next;
}

export function weekDates(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

export function formatTimeInSalon(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function eventDayIndex(iso: string, weekStart: Date) {
  const eventDate = new Date(iso);
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const diffMs = eventDate.getTime() - start.getTime();
  const index = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return index >= 0 && index < 7 ? index : null;
}

export async function loadCalendarData(
  supabase: App.Locals["supabase"],
  options: {
    weekStart: Date;
    staffFilterIds: string[] | null;
  },
) {
  const weekEnd = endOfWeek(options.weekStart);
  const weekStartIso = options.weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();

  let staffQuery = supabase
    .from("staff")
    .select("id, slug, name")
    .order("name");

  if (options.staffFilterIds?.length === 1) {
    staffQuery = staffQuery.eq("id", options.staffFilterIds[0]!);
  } else if (options.staffFilterIds && options.staffFilterIds.length > 0) {
    staffQuery = staffQuery.in("id", options.staffFilterIds);
  }

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, staff_id, starts_at, ends_at, status, clients(first_name, last_name), appointment_services(services(name))",
    )
    .gte("starts_at", weekStartIso)
    .lt("starts_at", weekEndIso)
    .neq("status", "cancelled")
    .order("starts_at");

  if (options.staffFilterIds?.length === 1) {
    appointmentsQuery = appointmentsQuery.eq(
      "staff_id",
      options.staffFilterIds[0]!,
    );
  }

  let blockedQuery = supabase
    .from("blocked_times")
    .select("id, staff_id, starts_at, ends_at, reason")
    .lt("starts_at", weekEndIso)
    .gt("ends_at", weekStartIso)
    .order("starts_at");

  if (options.staffFilterIds?.length === 1) {
    blockedQuery = blockedQuery.eq("staff_id", options.staffFilterIds[0]!);
  }

  const [staffResult, appointmentsResult, blockedResult] = await Promise.all([
    staffQuery,
    appointmentsQuery,
    blockedQuery,
  ]);

  if (staffResult.error) {
    throw staffResult.error;
  }
  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }
  if (blockedResult.error) {
    throw blockedResult.error;
  }

  const staff = (staffResult.data ?? []) as CalendarStaff[];

  const appointments: CalendarAppointment[] = (appointmentsResult.data ?? []).map(
    (row) => {
      const client = row.clients as
        | { first_name: string; last_name: string }
        | null
        | undefined;
      const services = row.appointment_services as
        | Array<{ services: { name: string } | null }>
        | null
        | undefined;
      const serviceName = services?.[0]?.services?.name ?? null;
      const clientLabel = client
        ? `${client.first_name} ${client.last_name.charAt(0)}.`
        : "Client";

      return {
        id: row.id,
        staffId: row.staff_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        clientLabel,
        serviceLabel: serviceName,
      };
    },
  );

  const blockedTimes: CalendarBlockedTime[] = (blockedResult.data ?? []).map(
    (row) => ({
      id: row.id,
      staffId: row.staff_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reason: row.reason,
    }),
  );

  return { staff, appointments, blockedTimes };
}
