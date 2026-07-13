/**
 * Centralized event presentation mapping — the single source of truth for how
 * every team-calendar event type is rendered (color, icon, shape, label,
 * background, border, text color, accessibility label).
 *
 * Used everywhere the Events page draws an event: calendar cell pills, multi-day
 * bars, the selected-day detail cards, the upcoming list, the legend, and the
 * type filter. NEVER derive an event's type from its title/label, and NEVER fall
 * back to the birthday token — unknown/missing types resolve to a neutral token.
 *
 * This module is intentionally free of DOM/Astro dependencies so it can be unit
 * tested with `node --experimental-strip-types`.
 */
import { staffAccentColor } from "./staff-colors.ts";

/**
 * Stable presentation enum. This is the key the whole UI is built on. The
 * database currently persists a narrower set (`event`, `time_off`, `closure`,
 * `announcement`); `event` is normalized to `community` and the remaining
 * values keep the visual model extensible for future data support.
 */
export const EVENT_PRESENTATION_TYPES = [
  "birthday",
  "time_off",
  "closure",
  "announcement",
  "community",
  "training",
  "meeting",
  "other",
] as const;

export type EventPresentationType = (typeof EVENT_PRESENTATION_TYPES)[number];

/** Marker geometry — color is never the only signal, shape reinforces type. */
export type MarkerShape = "circle" | "pill" | "square" | "diamond";

/** Semantic icon keys; SVG markup lives in {@link EVENT_ICON_SVG}. */
export type EventIconKey =
  | "cake"
  | "suitcase"
  | "lock"
  | "megaphone"
  | "heart"
  | "cap"
  | "group"
  | "dot";

/**
 * Designated birthday gold. Deliberately distinct from any staff accent color
 * and always paired with the cake icon + circle shape so time off can never be
 * confused for a birthday, even when a staff color happens to be gold-ish.
 */
export const BIRTHDAY_GOLD = "#c8952b";

/** Neutral time-off accent when the event has no resolvable staff color. */
export const NEUTRAL_TIME_OFF_COLOR = "#ae948f";

/** Neutral accent for unknown/other event types (never birthday). */
export const NEUTRAL_OTHER_COLOR = "#9a938a";

type EventToken = {
  type: EventPresentationType;
  label: string;
  /** Short label for tight spaces (calendar pills, chips). */
  shortLabel: string;
  icon: EventIconKey;
  /** Resolved hex so inline `--event-color` works reliably in color-mix(). */
  baseColor: string;
  /** When true, the accent color is the associated employee's staff color. */
  usesStaffColor: boolean;
  markerShape: MarkerShape;
};

/** Base token per type. Colors are resolved hex values (not CSS vars). */
export const EVENT_TOKENS: Record<EventPresentationType, EventToken> = {
  birthday: {
    type: "birthday",
    label: "Birthday",
    shortLabel: "Birthday",
    icon: "cake",
    baseColor: BIRTHDAY_GOLD,
    usesStaffColor: false,
    markerShape: "circle",
  },
  time_off: {
    type: "time_off",
    label: "Time off",
    shortLabel: "Time off",
    icon: "suitcase",
    baseColor: NEUTRAL_TIME_OFF_COLOR,
    usesStaffColor: true,
    markerShape: "pill",
  },
  closure: {
    type: "closure",
    label: "Holiday / closure",
    shortLabel: "Closed",
    icon: "lock",
    baseColor: "#b42318",
    usesStaffColor: false,
    markerShape: "square",
  },
  announcement: {
    type: "announcement",
    label: "Announcement",
    shortLabel: "Notice",
    icon: "megaphone",
    baseColor: "#5b7fa6",
    usesStaffColor: false,
    markerShape: "diamond",
  },
  community: {
    type: "community",
    label: "Community event",
    shortLabel: "Community",
    icon: "heart",
    baseColor: "#6f8269",
    usesStaffColor: false,
    markerShape: "square",
  },
  training: {
    type: "training",
    label: "Training",
    shortLabel: "Training",
    icon: "cap",
    baseColor: "#8a6fa6",
    usesStaffColor: false,
    markerShape: "square",
  },
  meeting: {
    type: "meeting",
    label: "Meeting",
    shortLabel: "Meeting",
    icon: "group",
    baseColor: "#5c554e",
    usesStaffColor: false,
    markerShape: "square",
  },
  other: {
    type: "other",
    label: "Event",
    shortLabel: "Event",
    icon: "dot",
    baseColor: NEUTRAL_OTHER_COLOR,
    usesStaffColor: false,
    markerShape: "square",
  },
};

/**
 * Normalize any raw event-type value (from the API/DB or a filter) to a stable
 * presentation type. The legacy DB value `event` maps to `community`. Anything
 * unrecognized (including empty/missing) resolves to `other` — NEVER birthday.
 */
export function normalizeEventType(
  raw: string | null | undefined,
): EventPresentationType {
  const value = String(raw ?? "").trim().toLowerCase();
  switch (value) {
    case "birthday":
      return "birthday";
    case "time_off":
    case "time-off":
    case "timeoff":
      return "time_off";
    case "closure":
    case "holiday":
      return "closure";
    case "announcement":
      return "announcement";
    case "community":
    case "event":
      return "community";
    case "training":
      return "training";
    case "meeting":
      return "meeting";
    default:
      return "other";
  }
}

/** Fully-resolved presentation style for a single event instance. */
export type ResolvedEventStyle = {
  type: EventPresentationType;
  label: string;
  shortLabel: string;
  icon: EventIconKey;
  /** Resolved accent color (staff color for time off, base color otherwise). */
  color: string;
  usesStaffColor: boolean;
  markerShape: MarkerShape;
  /** CSS values (may reference theme vars; safe in light + dark). */
  background: string;
  border: string;
  textColor: string;
  /** Human-readable label for aria/tooltips, e.g. "Time off". */
  accessibleLabel: string;
  /** True when a time_off event lacked a valid staff color (dev surface). */
  staffColorMissing: boolean;
};

/**
 * Resolve the presentation style for an event. Staff colors are resolved via
 * {@link staffAccentColor} for time-off events; when no valid staff id is
 * present the neutral time-off color is used and `staffColorMissing` is set so
 * callers can log/surface the missing config in dev.
 */
export function resolveEventStyle(input: {
  eventType: string | null | undefined;
  staffId?: string | null;
}): ResolvedEventStyle {
  const type = normalizeEventType(input.eventType);
  const token = EVENT_TOKENS[type];

  let color = token.baseColor;
  let staffColorMissing = false;

  if (token.usesStaffColor) {
    const staffId = input.staffId?.trim();
    if (staffId) {
      color = staffAccentColor(staffId);
    } else {
      color = NEUTRAL_TIME_OFF_COLOR;
      staffColorMissing = true;
    }
  }

  return {
    type,
    label: token.label,
    shortLabel: token.shortLabel,
    icon: token.icon,
    color,
    usesStaffColor: token.usesStaffColor,
    markerShape: token.markerShape,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    border: `color-mix(in srgb, ${color} 52%, var(--color-border-subtle))`,
    textColor: `color-mix(in srgb, ${color} 72%, var(--color-text))`,
    accessibleLabel: token.label,
    staffColorMissing,
  };
}

/**
 * Inline SVG bodies (paths only) per icon key, drawn on a 0 0 24 24 viewBox with
 * `currentColor`. Kept here so icon shape stays a single source of truth shared
 * by the calendar, list, legend, and detail views.
 */
export const EVENT_ICON_SVG: Record<EventIconKey, string> = {
  cake: '<path d="M12 3.5c.7 0 .9.7.5 1.2-.3.4-.9.4-1 .9 0 .4.4.7 0 1.2M8.5 5.7c.6 0 .8.6.4 1.1M15.5 5.7c.6 0 .8.6.4 1.1M5 12v7.5h14V12M5 12c0-1.7 1.3-2.5 3.5-2.5S11 12 12 12s1.3-2.5 3.5-2.5S19 10.3 19 12M3.5 19.5h17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  suitcase:
    '<rect x="3.5" y="7.5" width="17" height="11.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5M12 11v4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14v2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  megaphone:
    '<path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H7l1 4h2l-1-4 8 3.5V6L9 9.5H5.5A1.5 1.5 0 0 0 4 11z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  heart:
    '<path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7-2.2C19 15.7 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  cap: '<path d="M12 5 2.5 9.5 12 14l9.5-4.5L12 5zM6.5 11.5V16c0 1 2.5 2.5 5.5 2.5s5.5-1.5 5.5-2.5v-4.5M21.5 9.5V15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  group:
    '<circle cx="9" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8M15.5 7.2A2.5 2.5 0 0 1 18 12M17 14.4c2.2.3 3.8 2 3.8 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
};

/**
 * Convenience: an accessible inline icon `<svg>` string for a type. `title`
 * (when provided) is exposed to assistive tech; otherwise the icon is hidden.
 */
export function eventIconMarkup(
  icon: EventIconKey,
  options: { title?: string; className?: string } = {},
): string {
  const cls = options.className ?? "event-icon";
  if (options.title) {
    return `<svg class="${cls}" viewBox="0 0 24 24" role="img" aria-label="${escapeAttr(
      options.title,
    )}">${EVENT_ICON_SVG[icon]}</svg>`;
  }
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${EVENT_ICON_SVG[icon]}</svg>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Privacy-safe approval labels for time_off events (status is not sensitive). */
export const TIME_OFF_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function timeOffStatusLabel(status: string | null | undefined): string {
  return TIME_OFF_STATUS_LABELS[String(status ?? "").trim()] ?? "";
}
