import { TIMEZONE } from "@saloncitrine/shared";

/** Convert a local salon date + wall-clock time to UTC. */
export function localDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = TIMEZONE,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);

  let utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMs)).map((part) => [part.type, part.value]),
    );
    const tzYear = Number(parts.year);
    const tzMonth = Number(parts.month);
    const tzDay = Number(parts.day);
    const tzHour = Number(parts.hour === "24" ? "0" : parts.hour);
    const tzMin = Number(parts.minute);

    const diffMinutes =
      (y - tzYear) * 525600 +
      (m - tzMonth) * 43800 +
      (d - tzDay) * 1440 +
      (hh - tzHour) * 60 +
      (mm - tzMin);

    if (diffMinutes === 0) break;
    utcMs += diffMinutes * 60 * 1000;
  }

  return new Date(utcMs);
}

/** Parse `<input type="datetime-local">` value as salon local time. */
export function parseDateTimeLocalInput(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Invalid datetime-local value");
  }
  return localDateTimeToUtc(match[1]!, match[2]!);
}

/** Snap a datetime-local string to the nearest slot increment (default 15 min). */
export function roundDateTimeLocalToSlot(
  value: string,
  slotMinutes = 15,
): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const totalMinutes = hours * 60 + minutes;
  const rounded = Math.round(totalMinutes / slotMinutes) * slotMinutes;
  const dayMinutes = ((rounded % 1440) + 1440) % 1440;
  const hh = String(Math.floor(dayMinutes / 60)).padStart(2, "0");
  const mm = String(dayMinutes % 60).padStart(2, "0");

  return `${match[1]}T${hh}:${mm}`;
}
