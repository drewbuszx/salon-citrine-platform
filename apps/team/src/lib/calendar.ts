import { BUSINESS_HOURS, TIMEZONE } from "@saloncitrine/shared";
import { localDateTimeToUtc } from "./datetime";

export type CalendarAppointment = {
  id: string;
  clientId: string;
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
  serviceCategory: string | null;
  serviceIds: string[];
  serviceNames: string[];
  serviceCount: number;
  hasNotes: boolean;
};

export type StaffServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  category: string | null;
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

export type StaffSchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export type CalendarEvent =
  | {
      kind: "appointment";
      id: string;
      staffId: string;
      startsAt: string;
      endsAt: string;
      status: string;
      clientLabel: string;
      clientFullName: string;
      serviceLabel: string | null;
      serviceCategory: string | null;
      serviceCount: number;
      hasNotes: boolean;
    }
  | {
      kind: "blocked";
      id: string;
      staffId: string;
      startsAt: string;
      endsAt: string;
      label: string;
    };

/** Full bookable day grid: 4:00 AM through 11:59 PM (midnight end). */
export const CALENDAR_START_HOUR = 4;
export const CALENDAR_END_HOUR = 24;
export const CALENDAR_SLOT_MINUTES = 15;
export const CALENDAR_ROW_HEIGHT_REM = 1.25;
export const STAFF_AVATAR_SIZE_REM = 2.5;
/** Minimum provider column width so appointment text stays readable. */
export const MIN_STAFF_COLUMN_WIDTH_REM = 9;
/** Header layout constants used to size shared staff columns. */
const STAFF_HEADER_HORIZONTAL_PADDING_REM = 0.9;
const STAFF_HEADER_GAP_REM = 0.4;
const STAFF_NAME_CHAR_WIDTH_REM = 0.36;
/** Compact sticky provider header height. */
export const STAFF_HEADER_HEIGHT_REM = 2.75;

export { STAFF_ACCENT_COLORS, staffAccentColor } from "./staff-colors";

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
  const slotOffset = (startMin - gridStart) / CALENDAR_SLOT_MINUTES;
  const slotSpan =
    (Math.max(endMin, startMin + CALENDAR_SLOT_MINUTES) - startMin) /
    CALENDAR_SLOT_MINUTES;
  const top = Math.round(slotOffset * CALENDAR_ROW_HEIGHT_REM * 1000) / 1000;
  const height = Math.round(Math.max(slotSpan, 1) * CALENDAR_ROW_HEIGHT_REM * 1000) / 1000;
  return {
    top: `${Math.max(top, 0)}rem`,
    height: `${Math.max(height, CALENDAR_ROW_HEIGHT_REM)}rem`,
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
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, "")
    .toLowerCase();
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

/** Minimum uniform staff column width (rem) from avatar + longest name. */
export function staffColumnWidthRem(staff: Pick<CalendarStaff, "name">[]) {
  if (staff.length === 0) {
    return MIN_STAFF_COLUMN_WIDTH_REM;
  }
  const maxNameWidth = Math.max(
    ...staff.map((member) => member.name.length * STAFF_NAME_CHAR_WIDTH_REM),
  );
  const contentWidth =
    STAFF_HEADER_HORIZONTAL_PADDING_REM +
    STAFF_AVATAR_SIZE_REM +
    STAFF_HEADER_GAP_REM +
    maxNameWidth;
  return Math.max(
    MIN_STAFF_COLUMN_WIDTH_REM,
    Math.ceil(contentWidth * 100) / 100,
  );
}

function dayBounds(dayStart: Date) {
  const dateStr = formatDayParam(dayStart);
  const nextDateStr = formatDayParam(shiftDay(dayStart, 1));
  return {
    startIso: localDateTimeToUtc(dateStr, "00:00").toISOString(),
    endIso: localDateTimeToUtc(nextDateStr, "00:00").toISOString(),
  };
}

/** Parse "HH:MM" or "HH:MM:SS" to minutes from midnight. */
export function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** JS day-of-week (0=Sun) for a YYYY-MM-DD date in the salon timezone. */
export function dayOfWeekInSalon(dateStr: string) {
  const noonUtc = localDateTimeToUtc(dateStr, "12:00");
  const weekday = noonUtc.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

export function scheduleForStaffOnDay(
  schedules: StaffSchedule[],
  dateStr: string,
) {
  const dow = dayOfWeekInSalon(dateStr);
  return schedules.find((row) => {
    if (row.dayOfWeek !== dow) return false;
    if (dateStr < row.effectiveFrom) return false;
    if (row.effectiveUntil && dateStr > row.effectiveUntil) return false;
    return true;
  });
}

/** True when a 15-minute slot starting at slotMinutes falls within staff hours. */
export function isSlotWithinStaffSchedule(
  slotMinutes: number,
  schedules: StaffSchedule[],
  dateStr: string,
) {
  const schedule = scheduleForStaffOnDay(schedules, dateStr);
  if (!schedule) return false;
  const startMin = parseTimeToMinutes(schedule.startTime);
  const endMin = parseTimeToMinutes(schedule.endTime);
  return slotMinutes >= startMin && slotMinutes < endMin;
}

/** Salon open time (minutes from midnight) for a calendar day, or null when closed. */
export function salonOpenMinutesForDay(dateStr: string) {
  const hours = BUSINESS_HOURS[dayOfWeekInSalon(dateStr)];
  if (!hours) return null;
  return parseTimeToMinutes(hours.open);
}

export function isSalonClosedOnDay(dateStr: string) {
  return salonOpenMinutesForDay(dateStr) === null;
}

export function formatNowLabel(now = new Date()) {
  return `Now ${formatTimeInSalon(now.toISOString())}`;
}

export type StaffShiftStatus = {
  label: string;
  shortLabel: string;
  kind: "working" | "off" | "no_schedule" | "closed";
};

function formatScheduleTimeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m ?? 0, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: m ? "2-digit" : undefined,
    hour12: true,
  }).format(date);
}

/** Provider shift summary for column header on a given date. */
export function staffShiftStatus(
  schedules: StaffSchedule[],
  dateStr: string,
): StaffShiftStatus {
  if (isSalonClosedOnDay(dateStr)) {
    return { label: "Salon closed", shortLabel: "Closed", kind: "closed" };
  }
  const schedule = scheduleForStaffOnDay(schedules, dateStr);
  if (!schedule) {
    return { label: "Off today", shortLabel: "Off", kind: "off" };
  }
  const endLabel = formatScheduleTimeLabel(schedule.endTime);
  return {
    label: `Working until ${endLabel}`,
    shortLabel: `Until ${endLabel}`,
    kind: "working",
  };
}

/**
 * Default vertical scroll offset (rem).
 * Today: one hour before current time. Other days: one hour before salon open.
 */
export function defaultCalendarScrollTopRem(
  dateStr: string,
  options: {
    appointments?: CalendarAppointment[];
    staffIds?: string[];
    staffSchedules?: Record<string, StaffSchedule[]>;
    now?: Date;
  } = {},
) {
  const now = options.now ?? new Date();
  const gridStart = CALENDAR_START_HOUR * 60;
  const day = parseDayParam(dateStr);
  let targetMinutes: number;

  if (isTodayInSalon(day)) {
    targetMinutes = Math.max(gridStart, minutesFromDayStart(now.toISOString()) - 45);
  } else {
    let earliest = salonOpenMinutesForDay(dateStr) ?? 9 * 60;
    for (const id of options.staffIds ?? []) {
      const schedule = scheduleForStaffOnDay(options.staffSchedules?.[id] ?? [], dateStr);
      if (schedule) {
        earliest = Math.min(earliest, parseTimeToMinutes(schedule.startTime));
      }
    }
    for (const appt of options.appointments ?? []) {
      if (!isSameDayInSalon(appt.startsAt, day)) continue;
      earliest = Math.min(earliest, minutesFromDayStart(appt.startsAt));
    }
    targetMinutes = Math.max(gridStart, earliest - 30);
  }

  return (
    ((targetMinutes - gridStart) / CALENDAR_SLOT_MINUTES) * CALENDAR_ROW_HEIGHT_REM
  );
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
      "id, client_id, staff_id, starts_at, ends_at, status, notes, clients(first_name, last_name, phone, email), appointment_services(service_id, services(name, category))",
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

  let schedulesQuery = supabase
    .from("staff_schedules")
    .select(
      "staff_id, day_of_week, start_time, end_time, effective_from, effective_until",
    );

  if (options.staffFilterIds?.length === 1) {
    schedulesQuery = schedulesQuery.eq("staff_id", options.staffFilterIds[0]!);
  } else if (options.staffFilterIds && options.staffFilterIds.length > 0) {
    schedulesQuery = schedulesQuery.in("staff_id", options.staffFilterIds);
  }

  const [staffResult, appointmentsResult, blockedResult, schedulesResult] =
    await Promise.all([
      staffQuery,
      appointmentsQuery,
      blockedQuery,
      schedulesQuery,
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
  if (schedulesResult.error) {
    throw schedulesResult.error;
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
        | Array<{
            service_id: string;
            services: { name: string; category: string } | null;
          }>
        | null
        | undefined;
      const serviceNames =
        services
          ?.map((item) => item.services?.name)
          .filter((name): name is string => Boolean(name)) ?? [];
      const serviceIds =
        services?.map((item) => item.service_id).filter(Boolean) ?? [];
      const serviceName = serviceNames[0] ?? null;
      const serviceCategory = services?.[0]?.services?.category ?? null;
      const clientFullName = client
        ? `${client.first_name} ${client.last_name}`.trim()
        : "Client";
      const clientLabel = client
        ? `${client.first_name} ${client.last_name.charAt(0)}.`
        : "Client";

      return {
        id: row.id,
        clientId: row.client_id,
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
        serviceCategory,
        serviceIds,
        serviceNames,
        serviceCount: serviceNames.length,
        hasNotes: Boolean(row.notes?.trim()),
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

  const staffSchedules: Record<string, StaffSchedule[]> = {};
  for (const row of schedulesResult.data ?? []) {
    const list = staffSchedules[row.staff_id] ?? [];
    list.push({
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
    });
    staffSchedules[row.staff_id] = list;
  }

  return { staff, appointments, blockedTimes, staffSchedules };
}

/** Load one provider's appointments and blocks across a 7-day week. */
export async function loadWeekCalendarData(
  supabase: App.Locals["supabase"],
  options: {
    weekStart: Date;
    staffId: string;
  },
) {
  const weekEnd = shiftDay(options.weekStart, 7);
  const startIso = dayBounds(options.weekStart).startIso;
  const endIso = dayBounds(weekEnd).startIso;

  const [staffResult, appointmentsResult, blockedResult, schedulesResult] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, slug, name, photo_url")
        .eq("id", options.staffId)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select(
          "id, client_id, staff_id, starts_at, ends_at, status, notes, clients(first_name, last_name, phone, email), appointment_services(service_id, services(name, category))",
        )
        .eq("staff_id", options.staffId)
        .gte("starts_at", startIso)
        .lt("starts_at", endIso)
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase
        .from("blocked_times")
        .select("id, staff_id, starts_at, ends_at, reason")
        .eq("staff_id", options.staffId)
        .lt("starts_at", endIso)
        .gt("ends_at", startIso)
        .order("starts_at"),
      supabase
        .from("staff_schedules")
        .select(
          "staff_id, day_of_week, start_time, end_time, effective_from, effective_until",
        )
        .eq("staff_id", options.staffId),
    ]);

  if (staffResult.error || !staffResult.data) {
    throw staffResult.error ?? new Error("Staff not found");
  }
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (blockedResult.error) throw blockedResult.error;
  if (schedulesResult.error) throw schedulesResult.error;

  const staff: CalendarStaff = {
    id: staffResult.data.id,
    slug: staffResult.data.slug,
    name: staffResult.data.name,
    photoUrl: staffResult.data.photo_url,
  };

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
        | Array<{
            service_id: string;
            services: { name: string; category: string } | null;
          }>
        | null
        | undefined;
      const serviceNames =
        services
          ?.map((item) => item.services?.name)
          .filter((name): name is string => Boolean(name)) ?? [];
      const serviceIds =
        services?.map((item) => item.service_id).filter(Boolean) ?? [];
      const serviceName = serviceNames[0] ?? null;
      const serviceCategory = services?.[0]?.services?.category ?? null;
      const clientFullName = client
        ? `${client.first_name} ${client.last_name}`.trim()
        : "Client";
      const clientLabel = client
        ? `${client.first_name} ${client.last_name.charAt(0)}.`
        : "Client";

      return {
        id: row.id,
        clientId: row.client_id,
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
        serviceCategory,
        serviceIds,
        serviceNames,
        serviceCount: serviceNames.length,
        hasNotes: Boolean(row.notes?.trim()),
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

  const staffSchedules: StaffSchedule[] = (schedulesResult.data ?? []).map(
    (row) => ({
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
    }),
  );

  return { staff, appointments, blockedTimes, staffSchedules };
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
    .select("staff_id, services(id, name, duration_minutes, category)")
    .in("staff_id", staffIds);

  if (error) {
    throw error;
  }

  const grouped: Record<string, StaffServiceOption[]> = {};
  for (const row of data ?? []) {
    const raw = row.services as
      | { id: string; name: string; duration_minutes: number; category: string }
      | Array<{ id: string; name: string; duration_minutes: number; category: string }>
      | null;
    const svc = Array.isArray(raw) ? raw[0] : raw;
    if (!svc) continue;
    const list = grouped[row.staff_id] ?? [];
    list.push({
      id: svc.id,
      name: svc.name,
      durationMinutes: svc.duration_minutes,
      category: svc.category ?? null,
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

export type UpcomingAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  clientName: string;
  serviceLabel: string | null;
};

export function formatAppointmentStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export async function loadUpcomingAppointments(
  supabase: App.Locals["supabase"],
  staffId: string,
  limit = 12,
): Promise<UpcomingAppointment[]> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, clients(first_name, last_name), appointment_services(services(name))",
    )
    .eq("staff_id", staffId)
    .gte("starts_at", nowIso)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const client = row.clients as
      | { first_name: string; last_name: string }
      | null
      | undefined;
    const services = row.appointment_services as
      | Array<{ services: { name: string } | null }>
      | null
      | undefined;
    const serviceNames =
      services
        ?.map((item) => item.services?.name)
        .filter((name): name is string => Boolean(name)) ?? [];

    return {
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      clientName: client
        ? `${client.first_name} ${client.last_name}`.trim()
        : "Client",
      serviceLabel: serviceNames[0] ?? null,
    };
  });
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
      status: item.status,
      clientLabel: item.clientLabel,
      clientFullName: `${item.clientFirstName} ${item.clientLastName}`.trim() || "Client",
      serviceLabel: item.serviceLabel,
      serviceCategory: item.serviceCategory,
      serviceCount: item.serviceCount,
      hasNotes: item.hasNotes,
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

function slotRangeOverlapsEvents(
  startMinutes: number,
  endMinutes: number,
  events: CalendarEvent[],
) {
  return events.some((event) => {
    const evStart = minutesFromDayStart(event.startsAt);
    const evEnd = minutesFromDayStart(event.endsAt);
    return startMinutes < evEnd && endMinutes > evStart;
  });
}

export type OpenGapResult = {
  staffId: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  dayParam: string;
  label: string;
  sortMinutes: number;
};

export type NextOpenGap = Pick<
  OpenGapResult,
  "staffId" | "staffName" | "startsAt" | "label"
>;

/** Open gaps on one day, sorted earliest first. */
export function findOpenGaps(
  selectedDay: Date,
  dayParam: string,
  staff: CalendarStaff[],
  appointments: CalendarAppointment[],
  blockedTimes: CalendarBlockedTime[],
  staffSchedules: Record<string, StaffSchedule[]>,
  options: {
    minDurationMinutes?: number;
    maxResults?: number;
    staffIds?: string[] | null;
    afterMinutes?: number;
  } = {},
): OpenGapResult[] {
  const minDurationMinutes = options.minDurationMinutes ?? 60;
  const maxResults = options.maxResults ?? 8;
  const slotsNeeded = Math.ceil(minDurationMinutes / CALENDAR_SLOT_MINUTES);
  const timeSlots = calendarTimeSlots();
  const afterMinutes =
    options.afterMinutes ??
    (isTodayInSalon(selectedDay)
      ? minutesFromDayStart(new Date().toISOString())
      : 0);

  const staffList =
    options.staffIds && options.staffIds.length > 0
      ? staff.filter((member) => options.staffIds!.includes(member.id))
      : staff;

  const results: OpenGapResult[] = [];

  for (const member of staffList) {
    const events = staffEventsForDay(
      member.id,
      selectedDay,
      appointments,
      blockedTimes,
    );
    const schedules = staffSchedules[member.id] ?? [];

    for (let i = 0; i <= timeSlots.length - slotsNeeded; i++) {
      const startSlot = timeSlots[i]!;
      if (startSlot < afterMinutes) continue;
      if (!isSlotWithinStaffSchedule(startSlot, schedules, dayParam)) continue;

      let allFree = true;
      for (let j = 0; j < slotsNeeded; j++) {
        const slotMin = timeSlots[i + j];
        if (
          slotMin === undefined ||
          !isSlotWithinStaffSchedule(slotMin, schedules, dayParam)
        ) {
          allFree = false;
          break;
        }
        if (
          slotRangeOverlapsEvents(
            slotMin,
            slotMin + CALENDAR_SLOT_MINUTES,
            events,
          )
        ) {
          allFree = false;
          break;
        }
      }

      if (allFree) {
        const startsAt = slotStartsAtIso(selectedDay, startSlot);
        const endsAt = slotStartsAtIso(
          selectedDay,
          startSlot + minDurationMinutes,
        );
        const firstName = member.name.split(" ")[0] ?? member.name;
        results.push({
          staffId: member.id,
          staffName: member.name,
          startsAt,
          endsAt,
          dayParam,
          sortMinutes: startSlot,
          label: `${formatTimeInSalon(startsAt)} · ${firstName}`,
        });
      }
    }
  }

  return results
    .sort((a, b) => a.sortMinutes - b.sortMinutes)
    .slice(0, maxResults);
}

/** First open gap (default 60 min) on the selected day, earliest across staff. */
export function findNextOpenGap(
  selectedDay: Date,
  dayParam: string,
  staff: CalendarStaff[],
  appointments: CalendarAppointment[],
  blockedTimes: CalendarBlockedTime[],
  staffSchedules: Record<string, StaffSchedule[]>,
  minDurationMinutes = 60,
): NextOpenGap | null {
  const [first] = findOpenGaps(
    selectedDay,
    dayParam,
    staff,
    appointments,
    blockedTimes,
    staffSchedules,
    { minDurationMinutes, maxResults: 1 },
  );
  if (!first) return null;
  const firstName = first.staffName.split(" ")[0] ?? first.staffName;
  return {
    staffId: first.staffId,
    staffName: first.staffName,
    startsAt: first.startsAt,
    label: `${formatTimeInSalon(first.startsAt)} with ${firstName}`,
  };
}
