import { TIMEZONE } from "@saloncitrine/shared";
import { localDateTimeToUtc } from "./datetime";

export type BirthdayRow = {
  id: string;
  name: string;
  birthday: string;
  source: "staff" | "client";
  staffId?: string;
};

export type BirthdayEvent = {
  id: string;
  title: string;
  description: null;
  eventType: "birthday";
  startsAt: string;
  endsAt: string;
  allDay: true;
  createdByStaffId: string;
  createdByName: null;
  staffId: string | null;
  staffName: string | null;
  canEdit: false;
  canDelete: false;
};

function endOfDayUtc(dateStr: string): string {
  return localDateTimeToUtc(dateStr, "23:59").toISOString();
}

function salonMonthYear(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month) };
}

export function birthdayMatchesMonth(birthday: string, month: number) {
  if (!birthday || birthday.length < 7) return false;
  return Number(birthday.slice(5, 7)) === month;
}

export function mapBirthdayEvent(
  row: BirthdayRow,
  year: number,
  fallbackStaffId: string,
): BirthdayEvent {
  const monthDay = row.birthday.slice(5);
  const dateStr = `${year}-${monthDay}`;
  return {
    id: `birthday-${row.source}-${row.id}-${year}`,
    title: `${row.name}'s birthday`,
    description: null,
    eventType: "birthday",
    startsAt: localDateTimeToUtc(dateStr, "00:00").toISOString(),
    endsAt: endOfDayUtc(dateStr),
    allDay: true,
    createdByStaffId: row.staffId ?? fallbackStaffId,
    createdByName: null,
    staffId: row.source === "staff" ? row.id : null,
    staffName: row.source === "staff" ? row.name : null,
    canEdit: false,
    canDelete: false,
  };
}

export function birthdaysForRange(
  rows: BirthdayRow[],
  fromIso: string,
  fallbackStaffId: string,
): BirthdayEvent[] {
  const { year, month } = salonMonthYear(fromIso);
  return rows
    .filter((row) => birthdayMatchesMonth(row.birthday, month))
    .map((row) => mapBirthdayEvent(row, year, fallbackStaffId));
}
