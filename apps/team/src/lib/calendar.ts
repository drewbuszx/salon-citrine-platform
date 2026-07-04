import { TIMEZONE } from "@saloncitrine/shared";
import { localDateTimeToUtc } from "./datetime";

export type CalendarAppointment = {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  clientLabel: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  serviceLabel: string | null;
  serviceIds: string[];
  serviceNames: string[];
  serviceCount: number;
};

export type StaffServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
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
  photoUrl: string | null;
};

export type CalendarEvent =
  | {
      kind: "appointment";
      id: string;
      staffId: string;
      startsAt: string;
      endsAt: string;
      clientLabel: string;
      clientFullName: string;
      serviceLabel: string | null;
      serviceCount: number;
    }
  | {
      kind: "blocked";
      id: string;
      staffId: string;
      startsAt: string;
      endsAt: string;
      label: string;
    };

export const CALENDAR_START_HOUR = 9;
export const CALENDAR_END_HOUR = 20;
export const CALENDAR_SLOT_MINUTES = 15;
export const CALENDAR_ROW_HEIGHT_REM = 1.25;
export const STAFF_AVATAR_SIZE_REM = 2.5;

export const STAFF_ACCENT_COLORS = [
  "var(--color-citrine)",
  "var(--color-sage)",
  "#d4a5a5",
  "#9cb4d4",
  "#c4b0d8",
  "#e8b8a8",
  "#8fbfb0",
];

/** Stable accent color per staff member (independent of column order). */
export function staffAccentColor(staffId: string) {
  let hash = 0;
  for (let i = 0; i < staffId.length; i++) {
    hash = (hash * 31 + staffId.charCodeAt(i)) >>> 0;
  }
  return STAFF_ACCENT_COLORS[hash % STAFF_ACCENT_COLORS.length]!;
}

/** Logged-in staff first, then others alphabetically by name. */
export function sortStaffWithCurrentFirst(
  staff: CalendarStaff[],
  currentStaffId: string,
) {
  return [...staff].sort((a, b) => {
    if (a.id === currentStaffId) return -1;
    if (b.id === currentStaffId) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function parseDayParam(value: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfDay(parsed);
    }
  }
  return startOfDay(new Date());
}

/** @deprecated Use parseDayParam — kept for a future week toggle */
export function parseWeekParam(value: string | null): Date {
  return parseDayParam(value);
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(dayStart: Date) {
  return shiftDay(dayStart, 1);
}

export function formatDayParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** @deprecated Use formatDayParam */
export function formatWeekParam(date: Date) {
  return formatDayParam(date);
}

export function shiftDay(dayStart: Date, deltaDays: number) {
  const next = new Date(dayStart);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export function formatDayLabel(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).formatToParts(date);
  const weekday =
    parts.find((part) => part.type === "weekday")?.value.slice(0, 3) ?? "";
  const month =
    parts.find((part) => part.type === "month")?.value.slice(0, 3) ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${weekday} ${month} ${day}`;
}

export function formatTimeInSalon(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTimeRangeInSalon(startsAt: string, endsAt: string) {
  return `${formatTimeInSalon(startsAt)} – ${formatTimeInSalon(endsAt)}`;
}

export function formatCompactTimeInSalon(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\s/g, "")
    .replace(/AM/i, "am")
    .replace(/PM/i, "pm")
    .replace(/:00(?=[ap]m$)/i, "");
}

export function formatCompactTimeRangeInSalon(startsAt: string, endsAt: string) {
  return `${formatCompactTimeInSalon(startsAt)} - ${formatCompactTimeInSalon(endsAt)}`;
}

export function salonDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameDayInSalon(iso: string, day: Date) {
  return salonDateString(new Date(iso)) === formatDayParam(day);
}

export function isTodayInSalon(day: Date) {
  return salonDateString(new Date()) === formatDayParam(day);
}

export function minutesFromDayStart(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  return hour * 60 + minute;
}

export function calendarSlotCount() {
  const startMinutes = CALENDAR_START_HOUR * 60;
  const endMinutes = CALENDAR_END_HOUR * 60;
  return (endMinutes - startMinutes) / CALENDAR_SLOT_MINUTES;
}

export function calendarGridHeightRem() {
  return calendarSlotCount() * CALENDAR_ROW_HEIGHT_REM;
}

export function eventBlockStyle(startsAt: string, endsAt: string) {
  const gridStart = CALENDAR_START_HOUR * 60;
  const startMin = minutesFromDayStart(startsAt);
  const endMin = minutesFromDayStart(endsAt);
  const top =
    ((startMin - gridStart) / CALENDAR_SLOT_MINUTES) * CALENDAR_ROW_HEIGHT_REM;
  const height =
    ((Math.max(endMin, startMin + 15) - startMin) / CALENDAR_SLOT_MINUTES) *
    CALENDAR_ROW_HEIGHT_REM;
  return {
    top: `${Math.max(top, 0)}rem`,
    height: `${Math.max(height, 1.25)}rem`,
  };
}

export function currentTimeLineTopRem(now = new Date()) {
  const gridStart = CALENDAR_START_HOUR * 60;
  const gridEnd = CALENDAR_END_HOUR * 60;
  const minutes = minutesFromDayStart(now.toISOString());
  if (minutes < gridStart || minutes > gridEnd) {
    return null;
  }
  return (
    ((minutes - gridStart) / CALENDAR_SLOT_MINUTES) * CALENDAR_ROW_HEIGHT_REM
  );
}

export function calendarTimeSlots() {
  const slots: number[] = [];
  for (
    let minutes = CALENDAR_START_HOUR * 60;
    minutes < CALENDAR_END_HOUR * 60;
    minutes += CALENDAR_SLOT_MINUTES
  ) {
    slots.push(minutes);
  }
  return slots;
}

export function formatSlotHourLabel(totalMinutes: number) {
  if (totalMinutes % 60 !== 0) {
    return "";
  }
  const hour = totalMinutes / 60;
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
  }).format(date);
}

export function formatSlotMinuteLabel(totalMinutes: number) {
  const minute = totalMinutes % 60;
  if (minute === 0) {
    return "";
  }
  return String(minute);
}

export function formatSlotTimeLabel(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    ...(minute > 0 ? { minute: "2-digit" } : {}),
  }).format(date);
}

/** Minimum uniform staff column width (rem) from avatar + longest name, no side padding. */
export function staffColumnWidthRem(staff: Pick<CalendarStaff, "name">[]) {
  if (staff.length === 0) {
    return STAFF_AVATAR_SIZE_REM;
  }
  const nameCharWidthRem = 0.36;
  const maxNameWidth = Math.max(
    ...staff.map((member) => member.name.length * nameCharWidthRem),
  );
  const contentWidth = Math.max(STAFF_AVATAR_SIZE_REM, maxNameWidth);
  return Math.ceil(contentWidth * 100) / 100;
}

function dayBounds(dayStart: Date) {
  const dateStr = formatDayParam(dayStart);
  const nextDateStr = formatDayParam(shiftDay(dayStart, 1));
  return {
    startIso: localDateTimeToUtc(dateStr, "00:00").toISOString(),
    endIso: localDateTimeToUtc(nextDateStr, "00:00").toISOString(),
  };
}

export async function loadCalendarData(
  supabase: App.Locals["supabase"],
  options: {
    selectedDay: Date;
    staffFilterIds: string[] | null;
  },
) {
  const { startIso, endIso } = dayBounds(options.selectedDay);

  let staffQuery = supabase
    .from("staff")
    .select("id, slug, name, photo_url")
    .order("name");

  if (options.staffFilterIds?.length === 1) {
    staffQuery = staffQuery.eq("id", options.staffFilterIds[0]!);
  } else if (options.staffFilterIds && options.staffFilterIds.length > 0) {
    staffQuery = staffQuery.in("id", options.staffFilterIds);
  }

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, staff_id, starts_at, ends_at, status, notes, clients(first_name, last_name, phone, email), appointment_services(service_id, services(name))",
    )
    .gte("starts_at", startIso)
    .lt("starts_at", endIso)
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
    .lt("starts_at", endIso)
    .gt("ends_at", startIso)
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

  const staff = (staffResult.data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    photoUrl: row.photo_url,
  })) as CalendarStaff[];

  const appointments: CalendarAppointment[] = (appointmentsResult.data ?? []).map(
    (row) => {
      const client = row.clients as
        | {
            first_name: string;
            last_name: string;
            phone: string | null;
            email: string | null;
          }
        | null
        | undefined;
      const services = row.appointment_services as
        | Array<{ service_id: string; services: { name: string } | null }>
        | null
        | undefined;
      const serviceNames =
        services
          ?.map((item) => item.services?.name)
          .filter((name): name is string => Boolean(name)) ?? [];
      const serviceIds =
        services?.map((item) => item.service_id).filter(Boolean) ?? [];
      const serviceName = serviceNames[0] ?? null;
      const clientFullName = client
        ? `${client.first_name} ${client.last_name}`.trim()
        : "Client";
      const clientLabel = client
        ? `${client.first_name} ${client.last_name.charAt(0)}.`
        : "Client";

      return {
        id: row.id,
        staffId: row.staff_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        notes: row.notes ?? null,
        clientLabel,
        clientFirstName: client?.first_name ?? "",
        clientLastName: client?.last_name ?? "",
        clientPhone: client?.phone ?? null,
        clientEmail: client?.email ?? null,
        serviceLabel: serviceName,
        serviceIds,
        serviceNames,
        serviceCount: serviceNames.length,
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

export async function loadStaffServicesByStaff(
  supabase: App.Locals["supabase"],
  staffIds: string[],
) {
  if (staffIds.length === 0) {
    return {} as Record<string, StaffServiceOption[]>;
  }

  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id, services(id, name, duration_minutes)")
    .in("staff_id", staffIds);

  if (error) {
    throw error;
  }

  const grouped: Record<string, StaffServiceOption[]> = {};
  for (const row of data ?? []) {
    const raw = row.services as
      | { id: string; name: string; duration_minutes: number }
      | Array<{ id: string; name: string; duration_minutes: number }>
      | null;
    const svc = Array.isArray(raw) ? raw[0] : raw;
    if (!svc) continue;
    const list = grouped[row.staff_id] ?? [];
    list.push({
      id: svc.id,
      name: svc.name,
      durationMinutes: svc.duration_minutes,
    });
    grouped[row.staff_id] = list;
  }

  for (const id of staffIds) {
    grouped[id] = (grouped[id] ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  return grouped;
}

export function slotStartsAtIso(dayStart: Date, totalMinutes: number) {
  const dateStr = formatDayParam(dayStart);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return localDateTimeToUtc(dateStr, timeStr).toISOString();
}

export function staffEventsForDay(
  staffId: string,
  selectedDay: Date,
  appointments: CalendarAppointment[],
  blockedTimes: CalendarBlockedTime[],
): CalendarEvent[] {
  const appts: CalendarEvent[] = appointments
    .filter(
      (item) =>
        item.staffId === staffId && isSameDayInSalon(item.startsAt, selectedDay),
    )
    .map((item) => ({
      kind: "appointment" as const,
      id: item.id,
      staffId: item.staffId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      clientLabel: item.clientLabel,
      clientFullName: `${item.clientFirstName} ${item.clientLastName}`.trim() || "Client",
      serviceLabel: item.serviceLabel,
      serviceCount: item.serviceCount,
    }));

  const blocks: CalendarEvent[] = blockedTimes
    .filter(
      (item) =>
        item.staffId === staffId && isSameDayInSalon(item.startsAt, selectedDay),
    )
    .map((item) => ({
      kind: "blocked" as const,
      id: item.id,
      staffId: item.staffId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      label: item.reason || "Blocked",
    }));

  return [...appts, ...blocks].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
}
