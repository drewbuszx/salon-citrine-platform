import { TIMEZONE, getCalendarDayTheme, JUNE_PRIDE_BG } from "@saloncitrine/shared";
import { dayOfWeekInSalon } from "../lib/calendar";
import { localDateTimeToUtc } from "../lib/datetime";
import { staffAccentColor } from "../lib/staff-colors";
import { showToast, friendlyError } from "../lib/toast";
import { escapeHtml } from "../lib/safe-html";
import {
  eventIconMarkup,
  normalizeEventType,
  resolveEventStyle,
  type EventPresentationType,
  type ResolvedEventStyle,
} from "../lib/event-presentation";

type RawEventType =
  | "event"
  | "time_off"
  | "closure"
  | "announcement"
  | "birthday"
  | "community"
  | "training"
  | "meeting"
  | string;

type TeamEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: RawEventType;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  createdByStaffId: string;
  createdByName: string | null;
  staffId: string | null;
  staffName: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

/** A team event with its resolved, centrally-mapped presentation style. */
type StyledEvent = TeamEvent & { style: ResolvedEventStyle; type: EventPresentationType };

const root = document.querySelector<HTMLElement>("[data-events-app]");
if (!root) {
  throw new Error("Events app root not found");
}

const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

const apiBase = root.dataset.apiBase ?? "";
const holidaysBase = root.dataset.holidaysBase ?? "";
const isManager = root.dataset.manager === "1";
const currentStaffId = root.dataset.currentStaffId ?? "";

const calendarEl = root.querySelector<HTMLElement>("[data-events-calendar]");
const listEl = root.querySelector<HTMLElement>("[data-events-list]");
const listTitleEl = root.querySelector<HTMLElement>("[data-events-list-title]");
const listCountEl = root.querySelector<HTMLElement>("[data-events-list-count]");
const clearDayBtn = root.querySelector<HTMLButtonElement>("[data-events-clear-day]");
const errorEl = root.querySelector<HTMLElement>("[data-events-error]");
const monthHeader = root.querySelector<HTMLElement>("[data-month-header]");
const legendEl = root.querySelector<HTMLElement>("[data-events-legend]");
const filterSummaryEl = root.querySelector<HTMLElement>("[data-events-active-filters]");
const staffCountEl = root.querySelector<HTMLElement>("[data-staff-selected-count]");
const srStatusEl = root.querySelector<HTMLElement>("[data-events-sr-status]");
const createBtn = root.querySelector<HTMLButtonElement>("[data-event-create]");
const resetFilterBtns = root.querySelectorAll<HTMLButtonElement>("[data-events-reset-filters]");
const staffSelectAllBtn = root.querySelector<HTMLButtonElement>("[data-staff-select-all]");
const staffClearBtn = root.querySelector<HTMLButtonElement>("[data-staff-clear]");

const modal = document.querySelector<HTMLDialogElement>("[data-event-modal]");
const form = document.querySelector<HTMLFormElement>("[data-event-form]");
const modalTitle = document.querySelector<HTMLElement>("[data-event-modal-title]");
const closeButtons = document.querySelectorAll<HTMLButtonElement>("[data-event-modal-close]");
const submitBtn = document.querySelector<HTMLButtonElement>("[data-event-submit]");
const deleteBtn = document.querySelector<HTMLButtonElement>("[data-event-delete]");
const deleteHintEl = document.querySelector<HTMLElement>("[data-event-delete-hint]");
const typeSelect = document.querySelector<HTMLSelectElement>("[data-event-type]");
const staffPicker = document.querySelector<HTMLElement>("[data-staff-picker]");
const staffSelect = form?.querySelector<HTMLSelectElement>('select[name="staff_id"]') ?? null;
const staffColorPreview = document.querySelector<HTMLElement>("[data-staff-color-preview]");
const privacyNote = document.querySelector<HTMLElement>("[data-time-off-privacy]");
const allDayInput = document.querySelector<HTMLInputElement>("[data-all-day]");
const allDayRow = document.querySelector<HTMLElement>("[data-all-day-row]");
const startLabel = document.querySelector<HTMLElement>("[data-start-label]");
const endLabel = document.querySelector<HTMLElement>("[data-end-label]");
const startsInput = form?.querySelector<HTMLInputElement>('input[name="starts_at"]');
const endsInput = form?.querySelector<HTMLInputElement>('input[name="ends_at"]');

let events: StyledEvent[] = [];
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let editingEventId: string | null = null;
let selectedDay: { year: number; month: number; day: number } | null = null;
let deleteConfirmPending = false;

const MAX_CELL_LANES = 3;
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ALL_PRESENTATION_TYPES: EventPresentationType[] = [
  "birthday",
  "time_off",
  "closure",
  "announcement",
  "community",
  "training",
  "meeting",
  "other",
];

// ── formatting helpers ─────────────────────────────────────────────────────

const salonDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });

function salonDateFromIso(iso: string) {
  return salonDateFormatter.format(new Date(iso));
}

function calendarDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthRange(year: number, month: number) {
  const firstDay = calendarDateStr(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDay = calendarDateStr(year, month, daysInMonth);
  return {
    from: localDateTimeToUtc(firstDay, "00:00").toISOString(),
    to: localDateTimeToUtc(lastDay, "23:59").toISOString(),
  };
}

function formatMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 15)));
}

function formatEventRange(event: TeamEvent) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  if (event.allDay) {
    const startFmt = dateFmt.format(start);
    if (!end || salonDateFromIso(event.startsAt) === salonDateFromIso(event.endsAt!)) {
      return `${startFmt} · All day`;
    }
    return `${startFmt} – ${dateFmt.format(end)} · All day`;
  }

  const startFmt = `${dateFmt.format(start)}, ${timeFmt.format(start)}`;
  if (!end) return startFmt;
  const sameDay = salonDateFromIso(event.startsAt) === salonDateFromIso(event.endsAt!);
  if (sameDay) return `${startFmt} – ${timeFmt.format(end)}`;
  return `${startFmt} – ${dateFmt.format(end)}, ${timeFmt.format(end)}`;
}

function dayKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

function formatSelectedDayLabel(year: number, month: number, day: number) {
  const noonUtc = localDateTimeToUtc(calendarDateStr(year, month, day), "12:00");
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(noonUtc);
}

// ── event styling / attribution ────────────────────────────────────────────

/** Time off is attributed to its subject; other events to their creator. */
function eventSubjectStaffId(event: TeamEvent): string | null {
  const type = normalizeEventType(event.eventType);
  if (type === "time_off") return event.staffId ?? null;
  if (type === "birthday") return event.staffId ?? null;
  return null;
}

function styleFor(event: TeamEvent): ResolvedEventStyle {
  const type = normalizeEventType(event.eventType);
  const style = resolveEventStyle({
    eventType: event.eventType,
    staffId: type === "time_off" ? event.staffId : undefined,
  });
  if (isDev && style.staffColorMissing) {
    console.warn(
      `[events] time_off event "${event.title}" (${event.id}) is missing a valid staff color; using neutral fallback.`,
    );
  }
  return style;
}

function decorate(event: TeamEvent): StyledEvent {
  return { ...event, style: styleFor(event), type: normalizeEventType(event.eventType) };
}

// ── filters ─────────────────────────────────────────────────────────────────

function getActiveTypeFilters(): Set<EventPresentationType> {
  const active = new Set<EventPresentationType>();
  root!.querySelectorAll<HTMLInputElement>("[data-filter-type]").forEach((input) => {
    const type = normalizeEventType(input.dataset.filterType);
    if (input.checked) active.add(type);
  });
  if (active.size === 0) {
    // No boxes checked = treat as "all" so the calendar is never mysteriously empty.
    return new Set(ALL_PRESENTATION_TYPES);
  }
  return active;
}

function getSelectedStaffIds(): Set<string> {
  const ids = new Set<string>();
  root!.querySelectorAll<HTMLInputElement>("[data-filter-staff]").forEach((input) => {
    if (input.checked && input.value) ids.add(input.value);
  });
  return ids;
}

function totalStaffCount(): number {
  return root!.querySelectorAll<HTMLInputElement>("[data-filter-staff]").length;
}

function staffFilterActive(): boolean {
  const selected = getSelectedStaffIds();
  return selected.size > 0 && selected.size < totalStaffCount();
}

function filteredEvents(): StyledEvent[] {
  const types = getActiveTypeFilters();
  const staffActive = staffFilterActive();
  const selectedStaff = getSelectedStaffIds();
  return events.filter((event) => {
    if (!types.has(event.type)) return false;
    if (!staffActive) return true;
    const subject = eventSubjectStaffId(event);
    // Salon-wide events (no staff subject) always stay visible.
    if (!subject) return true;
    return selectedStaff.has(subject);
  });
}

// ── error / status ───────────────────────────────────────────────────────────

function showError(message: string) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  if (!errorEl) return;
  errorEl.textContent = "";
  errorEl.hidden = true;
}

function announce(message: string) {
  if (srStatusEl) srStatusEl.textContent = message;
}

// ── calendar grid model ───────────────────────────────────────────────────────

type GridCell = { year: number; month: number; day: number; dateStr: string; inMonth: boolean };

function buildGrid(year: number, month: number): GridCell[][] {
  const firstStr = calendarDateStr(year, month, 1);
  const startOffset = dayOfWeekInSalon(firstStr);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: GridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startOffset + i, 12, 0, 0);
    const cy = d.getFullYear();
    const cm = d.getMonth();
    const cd = d.getDate();
    cells.push({
      year: cy,
      month: cm,
      day: cd,
      dateStr: calendarDateStr(cy, cm, cd),
      inMonth: cy === year && cm === month,
    });
  }

  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function eventStartStr(event: TeamEvent) {
  return salonDateFromIso(event.startsAt);
}
function eventEndStr(event: TeamEvent) {
  return salonDateFromIso(event.endsAt ?? event.startsAt);
}

type LaneSegment = {
  event: StyledEvent;
  colStart: number;
  colEnd: number;
  isRealStart: boolean;
  isRealEnd: boolean;
};

/** Assigns each event overlapping a week to a lane (row) with greedy packing. */
function layoutWeek(week: GridCell[], weekEvents: StyledEvent[]) {
  const weekStart = week[0]!.dateStr;
  const weekEnd = week[6]!.dateStr;

  const segments: LaneSegment[] = weekEvents
    .map((event) => {
      const start = eventStartStr(event);
      const end = eventEndStr(event);
      const clampedStart = start < weekStart ? weekStart : start;
      const clampedEnd = end > weekEnd ? weekEnd : end;
      const colStart = week.findIndex((c) => c.dateStr === clampedStart);
      const colEnd = week.findIndex((c) => c.dateStr === clampedEnd);
      return {
        event,
        colStart: colStart < 0 ? 0 : colStart,
        colEnd: colEnd < 0 ? 6 : colEnd,
        isRealStart: start >= weekStart,
        isRealEnd: end <= weekEnd,
      };
    })
    .sort((a, b) => {
      const aSpan = a.colEnd - a.colStart;
      const bSpan = b.colEnd - b.colStart;
      // Multi-day bars first (longer spans get the top lanes and stay stable),
      // then by start column, then all-day before timed, then title.
      if (aSpan !== bSpan) return bSpan - aSpan;
      if (a.colStart !== b.colStart) return a.colStart - b.colStart;
      if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
      return a.event.title.localeCompare(b.event.title);
    });

  const lanes: LaneSegment[][] = [];
  const laneOf = new Map<LaneSegment, number>();

  for (const seg of segments) {
    let placed = false;
    for (let l = 0; l < lanes.length; l++) {
      const conflict = lanes[l]!.some(
        (other) => seg.colStart <= other.colEnd && other.colStart <= seg.colEnd,
      );
      if (!conflict) {
        lanes[l]!.push(seg);
        laneOf.set(seg, l);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([seg]);
      laneOf.set(seg, lanes.length - 1);
    }
  }

  return { segments, laneOf };
}

function renderSegmentPiece(seg: LaneSegment, col: number, weekStartCol: number) {
  const { event, colStart, colEnd, isRealStart, isRealEnd } = seg;
  const multiDay = colEnd > colStart || !isRealStart || !isRealEnd;
  const style = event.style;

  const startsHere = col === colStart && isRealStart;
  const endsHere = col === colEnd && isRealEnd;
  const isLeftEdge = col === colStart; // leftmost visible column in this week
  const showTitle = isLeftEdge; // one title per week segment

  const classes = ["ec-seg", `ec-seg--${event.type}`];
  if (multiDay) {
    classes.push("ec-seg--bar");
    if (startsHere) classes.push("ec-seg--start");
    else classes.push("ec-seg--bleed-left");
    if (endsHere) classes.push("ec-seg--end");
    else classes.push("ec-seg--bleed-right");
  } else {
    classes.push("ec-seg--single");
    classes.push("ec-seg--start", "ec-seg--end");
  }

  const rangeLabel = formatEventRange(event);
  const aria = `${style.accessibleLabel}: ${event.title}, ${rangeLabel}`;
  const styleVars = `--ec-accent: ${style.color};`;

  const inner = showTitle
    ? `${eventIconMarkup(style.icon, { className: "ec-seg__icon" })}<span class="ec-seg__title">${escapeHtml(
        event.title,
      )}</span>`
    : "";

  const interactive = event.type !== "birthday";
  const tag = interactive ? "button" : "span";
  const attrs = interactive
    ? `type="button" data-event-open="${event.id}"`
    : "";

  return `<${tag} class="${classes.join(" ")}" style="${styleVars}" ${attrs} title="${escapeHtml(
    `${event.title} · ${rangeLabel}`,
  )}" aria-label="${escapeHtml(aria)}">${inner}</${tag}>`;
}

function renderCalendar() {
  if (!calendarEl) return;
  if (monthHeader) monthHeader.textContent = formatMonthLabel(viewYear, viewMonth);

  const visible = filteredEvents();
  const todayStr = salonDateFromIso(new Date().toISOString());
  const weeks = buildGrid(viewYear, viewMonth);

  let html = "";

  for (const week of weeks) {
    const weekStart = week[0]!.dateStr;
    const weekEnd = week[6]!.dateStr;
    const weekEvents = visible.filter((event) => {
      const s = eventStartStr(event);
      const e = eventEndStr(event);
      return s <= weekEnd && e >= weekStart;
    });
    const { segments, laneOf } = layoutWeek(week, weekEvents);

    html += `<div class="ec-week" role="row">`;

    for (let col = 0; col < 7; col++) {
      const cell = week[col]!;
      const dateStr = cell.dateStr;
      const isToday = dateStr === todayStr;
      const dow = dayOfWeekInSalon(dateStr);
      const isWeekend = dow === 0 || dow === 6;
      const isSelected =
        selectedDay?.year === cell.year &&
        selectedDay.month === cell.month &&
        selectedDay.day === cell.day;
      const theme = getCalendarDayTheme(dateStr);
      const holiday = theme.holiday;

      // Events touching this specific column (for overflow + count).
      const dayEvents = weekEvents.filter((event) => {
        const s = eventStartStr(event);
        const e = eventEndStr(event);
        return s <= dateStr && e >= dateStr;
      });

      // Build lane slots so multi-day bars align vertically across the row.
      let lanesHtml = "";
      for (let lane = 0; lane < MAX_CELL_LANES; lane++) {
        const seg = segments.find(
          (s) => laneOf.get(s) === lane && s.colStart <= col && col <= s.colEnd,
        );
        if (seg) {
          lanesHtml += `<span class="ec-lane">${renderSegmentPiece(seg, col, 0)}</span>`;
        } else {
          lanesHtml += `<span class="ec-lane ec-lane--empty" aria-hidden="true"></span>`;
        }
      }

      const hiddenCount = dayEvents.filter((event) => {
        const seg = segments.find((s) => s.event === event);
        return seg ? (laneOf.get(seg) ?? 99) >= MAX_CELL_LANES : true;
      }).length;
      const moreHtml =
        hiddenCount > 0
          ? `<span class="ec-more" aria-hidden="true">+${hiddenCount} more</span>`
          : "";

      const cellStyles: string[] = [];
      if (theme.isPrideMonth) cellStyles.push(`--pride-bg: ${JUNE_PRIDE_BG}`);
      if (holiday) {
        cellStyles.push(`--holiday-bg: ${holiday.bgColor}`);
        if (holidaysBase) cellStyles.push(`--holiday-image: url("${holidaysBase}${holiday.image}")`);
      }
      const styleAttr = cellStyles.length ? ` style="${cellStyles.join("; ")}"` : "";

      const classes = [
        "ec-cell",
        cell.inMonth ? "" : "ec-cell--outside",
        isToday ? "ec-cell--today" : "",
        isWeekend ? "ec-cell--weekend" : "",
        isSelected ? "ec-cell--selected" : "",
        dayEvents.length ? "ec-cell--has-events" : "",
        theme.isPrideMonth ? "ec-cell--pride" : "",
        holiday ? "ec-cell--holiday" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const holidayLabel = holiday ? `, ${holiday.name}` : "";
      const monthName = new Intl.DateTimeFormat(undefined, {
        timeZone: TIMEZONE,
        month: "long",
      }).format(new Date(Date.UTC(cell.year, cell.month, 15)));
      const aria =
        `${weekdayFull[dow]} ${monthName} ${cell.day}, ${cell.year}` +
        (dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}` : ", no events") +
        holidayLabel +
        (cell.inMonth ? "" : ", outside current month");

      const todayBadge = isToday ? `<span class="ec-cell__today" aria-hidden="true">Today</span>` : "";

      html += `
        <div
          class="${classes}"
          role="gridcell"
          tabindex="-1"
          data-calendar-day="${dayKey(cell.year, cell.month, cell.day)}"
          aria-label="${escapeHtml(aria)}"
          aria-selected="${isSelected ? "true" : "false"}"${styleAttr}
        >
          <span class="ec-cell__head">
            <span class="ec-cell__day">${cell.day}</span>
            ${todayBadge}
          </span>
          <span class="ec-cell__lanes">${lanesHtml}${moreHtml}</span>
        </div>`;
    }

    html += `</div>`;
  }

  calendarEl.innerHTML = html;
  updateRovingTabindex();
}

// ── legend ─────────────────────────────────────────────────────────────────

function renderLegend() {
  if (!legendEl) return;
  const shown: EventPresentationType[] = [
    "birthday",
    "time_off",
    "closure",
    "community",
    "announcement",
  ];
  legendEl.innerHTML = shown
    .map((type) => {
      const style = resolveEventStyle({ eventType: type });
      const label =
        type === "time_off"
          ? "Time off · employee color"
          : style.label;
      const sample =
        type === "time_off"
          ? `<span class="ec-legend__swatch ec-legend__swatch--staff" aria-hidden="true">${eventIconMarkup(
              style.icon,
              { className: "ec-legend__icon" },
            )}</span>`
          : `<span class="ec-legend__swatch ec-legend__swatch--${style.markerShape}" style="--ec-accent: ${style.color}" aria-hidden="true">${eventIconMarkup(
              style.icon,
              { className: "ec-legend__icon" },
            )}</span>`;
      return `<button class="ec-legend__item" type="button" data-legend-toggle="${type}">
        ${sample}<span class="ec-legend__label">${escapeHtml(label)}</span>
      </button>`;
    })
    .join("");
}

// ── list / selected-day detail ────────────────────────────────────────────

function eventsForList(): StyledEvent[] {
  const base = [...filteredEvents()].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  if (selectedDay) {
    return base.filter((event) => {
      const s = eventStartStr(event);
      const e = eventEndStr(event);
      const d = calendarDateStr(selectedDay!.year, selectedDay!.month, selectedDay!.day);
      return s <= d && e >= d;
    });
  }

  const now = new Date();
  return base.filter((event) => {
    const end = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
    return end >= now;
  });
}

function renderSkeletonList() {
  if (!listEl) return;
  listEl.innerHTML = Array.from(
    { length: 4 },
    () => `
    <div class="event-card event-card--skeleton" aria-hidden="true">
      <span class="event-card__icon skeleton"></span>
      <span class="skeleton event-card__skeleton-title"></span>
      <span class="skeleton event-card__skeleton-meta"></span>
    </div>`,
  ).join("");
}

function renderEmptyList() {
  const typesActive = getActiveTypeFilters().size < ALL_PRESENTATION_TYPES.length;
  const staffActive = staffFilterActive();
  if (typesActive || staffActive) {
    return `<div class="ui-empty ui-empty--compact events-empty" role="status">
      <span class="ui-empty__icon" aria-hidden="true">🔍</span>
      <p class="ui-empty__title">No events match the selected filters</p>
      <p class="ui-empty__hint">Adjust or reset the filters to see more.</p>
    </div>`;
  }
  if (selectedDay) {
    return `<div class="ui-empty ui-empty--compact events-empty" role="status">
      <span class="ui-empty__icon" aria-hidden="true">📅</span>
      <p class="ui-empty__title">No events on this day</p>
      <p class="ui-empty__hint">Pick another date or show all upcoming events.</p>
    </div>`;
  }
  return `<div class="ui-empty ui-empty--compact events-empty" role="status">
    <span class="ui-empty__icon" aria-hidden="true">📅</span>
    <p class="ui-empty__title">No upcoming events</p>
    <p class="ui-empty__hint">Closures, announcements, and time off will show here.</p>
  </div>`;
}

function staffLabelFor(event: StyledEvent): string {
  if (event.type === "time_off" && event.staffName) return event.staffName;
  if (event.type === "birthday" && event.staffName) return event.staffName;
  return event.createdByName ?? "";
}

function renderEventCard(event: StyledEvent, opts: { grouped?: boolean } = {}): string {
  const style = event.style;
  const interactive = event.type !== "birthday";
  const tag = interactive ? "button" : "div";
  const startDateStr = eventStartStr(event);
  const [ey, em, ed] = startDateStr.split("-").map(Number);
  const eventDayKey = dayKey(ey!, em! - 1, ed!);
  const attrs = interactive
    ? `type="button" data-event-open="${event.id}" data-event-day="${eventDayKey}"`
    : "";

  const metaParts = [formatEventRange(event)];
  const staffName = staffLabelFor(event);
  if (staffName) metaParts.push(staffName);

  const notes =
    event.description && event.type !== "time_off"
      ? `<p class="event-card__notes">${escapeHtml(event.description)}</p>`
      : event.description && event.type === "time_off" && event.canEdit
        ? `<p class="event-card__notes event-card__notes--private">${escapeHtml(event.description)} <span class="event-card__private-tag">private</span></p>`
        : "";

  return `
    <${tag}
      class="event-card event-card--${event.type}${interactive ? "" : " event-card--static"}"
      style="--ec-accent: ${style.color}"
      ${attrs}
    >
      <span class="event-card__icon" aria-hidden="true">${eventIconMarkup(style.icon, {
        className: "event-card__icon-svg",
      })}</span>
      <span class="event-card__body">
        <span class="event-card__title-row">
          <span class="event-card__title">${escapeHtml(event.title)}</span>
          <span class="event-badge event-badge--${event.type}">${escapeHtml(style.shortLabel)}</span>
        </span>
        <span class="event-card__meta">${escapeHtml(metaParts.join(" · "))}</span>
        ${notes}
      </span>
    </${tag}>`;
}

function renderList() {
  if (!listEl) return;

  const listed = eventsForList();

  if (listTitleEl) {
    listTitleEl.textContent = selectedDay
      ? formatSelectedDayLabel(selectedDay.year, selectedDay.month, selectedDay.day)
      : "Upcoming events";
  }
  if (listCountEl) {
    listCountEl.textContent = listed.length
      ? `${listed.length} event${listed.length === 1 ? "" : "s"}`
      : "";
  }
  if (clearDayBtn) clearDayBtn.hidden = !selectedDay;

  if (listed.length === 0) {
    listEl.innerHTML = renderEmptyList();
    return;
  }

  if (selectedDay) {
    listEl.innerHTML = listed.map((event) => renderEventCard(event)).join("");
    return;
  }

  // Upcoming view — group into Today / This week / Later.
  const todayStr = salonDateFromIso(new Date().toISOString());
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const weekEndStr = salonDateFromIso(weekEnd.toISOString());

  const groups: { key: string; label: string; items: StyledEvent[] }[] = [
    { key: "today", label: "Today", items: [] },
    { key: "week", label: "This week", items: [] },
    { key: "later", label: "Later", items: [] },
  ];

  for (const event of listed) {
    const s = eventStartStr(event);
    const e = eventEndStr(event);
    if (s <= todayStr && e >= todayStr) groups[0]!.items.push(event);
    else if (s <= weekEndStr) groups[1]!.items.push(event);
    else groups[2]!.items.push(event);
  }

  listEl.innerHTML = groups
    .filter((g) => g.items.length > 0)
    .map(
      (g) => `
      <div class="events-group">
        <h4 class="events-group__label">${g.label}</h4>
        ${g.items.map((event) => renderEventCard(event)).join("")}
      </div>`,
    )
    .join("");
}

// ── selection ────────────────────────────────────────────────────────────────

function selectDay(year: number, month: number, day: number, toggle = true) {
  if (
    toggle &&
    selectedDay?.year === year &&
    selectedDay.month === month &&
    selectedDay.day === day
  ) {
    selectedDay = null;
  } else {
    selectedDay = { year, month, day };
  }
  renderCalendar();
  renderList();
  if (selectedDay) {
    const label = formatSelectedDayLabel(year, month, day);
    const count = eventsForList().length;
    announce(`${label}, ${count} event${count === 1 ? "" : "s"}`);
    const firstMatch = listEl?.querySelector<HTMLElement>("[data-event-day]");
    firstMatch?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    announce("Showing all upcoming events");
  }
}

function clearSelectedDay() {
  if (!selectedDay) return;
  selectedDay = null;
  renderCalendar();
  renderList();
  announce("Showing all upcoming events");
}

// ── active-filter summary + chips ─────────────────────────────────────────

function syncFilterUI() {
  const total = totalStaffCount();
  const selected = getSelectedStaffIds();
  const staffActive = staffFilterActive();
  if (staffCountEl) {
    staffCountEl.textContent = staffActive ? `${selected.size} of ${total}` : "All";
  }

  if (filterSummaryEl) {
    const chips: string[] = [];
    const activeTypes = getActiveTypeFilters();
    if (activeTypes.size < ALL_PRESENTATION_TYPES.length) {
      root!.querySelectorAll<HTMLInputElement>("[data-filter-type]").forEach((input) => {
        if (!input.checked) return;
        const type = normalizeEventType(input.dataset.filterType);
        const style = resolveEventStyle({ eventType: type });
        chips.push(
          `<button class="ec-chip" type="button" data-remove-type="${input.dataset.filterType}" style="--ec-accent:${style.color}">
            ${eventIconMarkup(style.icon, { className: "ec-chip__icon" })}
            <span>${escapeHtml(style.shortLabel)}</span>
            <span class="ec-chip__x" aria-hidden="true">×</span>
            <span class="ec-visually-hidden">Remove ${escapeHtml(style.label)} filter</span>
          </button>`,
        );
      });
    }
    if (staffActive) {
      chips.push(
        `<span class="ec-chip ec-chip--info">${selected.size} staff selected</span>`,
      );
    }
    filterSummaryEl.innerHTML = chips.join("");
    filterSummaryEl.hidden = chips.length === 0;
  }
  const noFilters =
    getActiveTypeFilters().size >= ALL_PRESENTATION_TYPES.length && !staffActive;
  resetFilterBtns.forEach((btn) => (btn.hidden = noFilters));
}

function refreshViews() {
  renderCalendar();
  renderList();
  syncFilterUI();
}

function resetFilters() {
  root!.querySelectorAll<HTMLInputElement>("[data-filter-type]").forEach((input) => {
    input.checked = true;
  });
  root!.querySelectorAll<HTMLInputElement>("[data-filter-staff]").forEach((input) => {
    input.checked = false;
  });
  root!
    .querySelectorAll<HTMLInputElement>("[data-filter-type], [data-filter-staff]")
    .forEach((input) => input.dispatchEvent(new Event("change", { bubbles: true })));
  refreshViews();
}

// ── keyboard grid navigation ─────────────────────────────────────────────────

function allDayCells(): HTMLElement[] {
  return Array.from(calendarEl?.querySelectorAll<HTMLElement>("[data-calendar-day]") ?? []);
}

function updateRovingTabindex() {
  const cells = allDayCells();
  if (cells.length === 0) return;
  let activeIndex = cells.findIndex((c) => c.getAttribute("aria-selected") === "true");
  if (activeIndex < 0) {
    activeIndex = cells.findIndex((c) => c.classList.contains("ec-cell--today"));
  }
  if (activeIndex < 0) activeIndex = 0;
  cells.forEach((c, i) => c.setAttribute("tabindex", i === activeIndex ? "0" : "-1"));
}

function moveFocus(current: HTMLElement, delta: number) {
  const cells = allDayCells();
  const idx = cells.indexOf(current);
  if (idx < 0) return;
  const next = cells[Math.max(0, Math.min(cells.length - 1, idx + delta))];
  if (next) {
    cells.forEach((c) => c.setAttribute("tabindex", "-1"));
    next.setAttribute("tabindex", "0");
    next.focus();
  }
}

// ── modal (Add / edit event) ─────────────────────────────────────────────────

function resetDeleteConfirm() {
  deleteConfirmPending = false;
  if (deleteBtn) deleteBtn.textContent = isManager ? "Delete" : "Remove";
  if (deleteHintEl) deleteHintEl.hidden = true;
}

function toDateInputValue(iso: string) {
  return salonDateFromIso(iso);
}

function toDateTimeLocalValue(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  const hour = String(Number(parts.hour === "24" ? "0" : parts.hour)).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${minute}`;
}

function updateStaffColorPreview() {
  if (!staffColorPreview) return;
  const id = staffSelect?.value || currentStaffId;
  const color = id ? staffAccentColor(id) : "#ae948f";
  staffColorPreview.style.setProperty("--ec-accent", color);
}

function updateFormMode() {
  const allDay = Boolean(allDayInput?.checked);
  const eventType = normalizeEventType(typeSelect?.value ?? "community");
  const showStaff = isManager && eventType === "time_off";

  if (staffPicker) staffPicker.hidden = !showStaff;
  if (privacyNote) privacyNote.hidden = eventType !== "time_off";
  if (staffColorPreview) staffColorPreview.hidden = eventType !== "time_off";

  // Closures / birthdays are naturally all-day; nudge the default.
  if (allDayRow) allDayRow.hidden = false;

  if (startsInput) startsInput.type = allDay ? "date" : "datetime-local";
  if (endsInput) endsInput.type = allDay ? "date" : "datetime-local";
  if (startLabel?.firstChild) startLabel.firstChild.textContent = allDay ? "Start date " : "Starts ";
  if (endLabel?.firstChild) endLabel.firstChild.textContent = allDay ? "End date (optional) " : "Ends (optional) ";

  updateStaffColorPreview();
}

function resetForm() {
  form?.reset();
  editingEventId = null;
  resetDeleteConfirm();
  if (modalTitle) modalTitle.textContent = isManager ? "Add event" : "Request time off";
  if (deleteBtn) deleteBtn.hidden = true;
  if (submitBtn) submitBtn.hidden = false;
  if (typeSelect && !isManager) typeSelect.value = "time_off";
  updateFormMode();
}

function openCreateModal() {
  resetForm();
  // Pre-fill the date with the selected day when there is one.
  if (selectedDay && startsInput) {
    const ds = calendarDateStr(selectedDay.year, selectedDay.month, selectedDay.day);
    if (allDayInput) allDayInput.checked = true;
    updateFormMode();
    startsInput.value = ds;
  }
  modal?.showModal();
  (form?.querySelector<HTMLElement>("[data-event-type]") ?? startsInput)?.focus();
}

function openEditModal(event: StyledEvent) {
  if (!form) return;
  resetForm();
  editingEventId = event.id;
  if (modalTitle) modalTitle.textContent = "Event details";
  if (deleteBtn) deleteBtn.hidden = !event.canDelete;

  (form.elements.namedItem("title") as HTMLInputElement).value = event.title;
  (form.elements.namedItem("description") as HTMLTextAreaElement).value = event.description ?? "";
  if (typeSelect) typeSelect.value = event.eventType;
  if (allDayInput) allDayInput.checked = event.allDay;
  updateFormMode();

  if (startsInput) {
    startsInput.value = event.allDay ? toDateInputValue(event.startsAt) : toDateTimeLocalValue(event.startsAt);
  }
  if (endsInput && event.endsAt) {
    endsInput.value = event.allDay ? toDateInputValue(event.endsAt) : toDateTimeLocalValue(event.endsAt);
  }
  if (staffSelect && event.staffId) staffSelect.value = event.staffId;
  updateStaffColorPreview();

  if (!event.canEdit) {
    Array.from(form.elements).forEach((el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.disabled = true;
      }
    });
    if (submitBtn) submitBtn.hidden = true;
  }

  modal?.showModal();
}

function closeModal() {
  if (!form) {
    modal?.close();
    return;
  }
  Array.from(form.elements).forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.disabled = false;
    }
  });
  if (submitBtn) submitBtn.hidden = false;
  modal?.close();
  resetForm();
}

// ── API ───────────────────────────────────────────────────────────────────

async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "same-origin",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

async function loadEvents() {
  clearError();
  renderSkeletonList();
  const range = monthRange(viewYear, viewMonth);
  try {
    const data = (await apiFetch(
      `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    )) as { events?: TeamEvent[] };
    events = (data.events ?? []).map(decorate);
    refreshViews();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to load events");
    if (listEl) {
      listEl.innerHTML = `<div class="ui-empty ui-empty--compact events-empty" role="alert">
        <span class="ui-empty__icon" aria-hidden="true">⚠️</span>
        <p class="ui-empty__title">Couldn't load events</p>
        <p class="ui-empty__hint">${escapeHtml(error instanceof Error ? error.message : "Please try again.")}</p>
      </div>`;
    }
  }
}

function shiftMonth(delta: number) {
  viewMonth += delta;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  } else if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  selectedDay = null;
  void loadEvents();
}

function goToToday() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  selectedDay = null;
  void loadEvents();
}

// ── event wiring ─────────────────────────────────────────────────────────────

root.querySelectorAll("[data-filter-type]").forEach((el) => el.addEventListener("change", refreshViews));
root.querySelectorAll("[data-filter-staff]").forEach((el) => el.addEventListener("change", refreshViews));
root.closest(".team-list-layout")?.addEventListener("team-filters-restored", refreshViews);

root.querySelectorAll("[data-month-prev]").forEach((btn) => btn.addEventListener("click", () => shiftMonth(-1)));
root.querySelectorAll("[data-month-next]").forEach((btn) => btn.addEventListener("click", () => shiftMonth(1)));
root.querySelectorAll("[data-month-today]").forEach((btn) => btn.addEventListener("click", goToToday));

resetFilterBtns.forEach((btn) => btn.addEventListener("click", resetFilters));
staffSelectAllBtn?.addEventListener("click", () => {
  root!.querySelectorAll<HTMLInputElement>("[data-filter-staff]").forEach((i) => (i.checked = true));
  root!.querySelector<HTMLInputElement>("[data-filter-staff]")?.dispatchEvent(new Event("change", { bubbles: true }));
  refreshViews();
});
staffClearBtn?.addEventListener("click", () => {
  root!.querySelectorAll<HTMLInputElement>("[data-filter-staff]").forEach((i) => (i.checked = false));
  root!.querySelector<HTMLInputElement>("[data-filter-staff]")?.dispatchEvent(new Event("change", { bubbles: true }));
  refreshViews();
});

clearDayBtn?.addEventListener("click", clearSelectedDay);

filterSummaryEl?.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-remove-type]");
  if (!btn) return;
  const type = btn.dataset.removeType;
  const input = root!.querySelector<HTMLInputElement>(`[data-filter-type="${type}"]`);
  if (input) {
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  refreshViews();
});

legendEl?.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-legend-toggle]");
  if (!btn) return;
  const type = btn.dataset.legendToggle;
  const input = root!.querySelector<HTMLInputElement>(`[data-filter-type="${type}"]`);
  if (input) {
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  refreshViews();
});

calendarEl?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const openBtn = target.closest<HTMLElement>("[data-event-open]");
  if (openBtn) {
    const found = events.find((item) => item.id === openBtn.dataset.eventOpen);
    if (found) openEditModal(found);
    return;
  }
  const cell = target.closest<HTMLElement>("[data-calendar-day]");
  if (!cell?.dataset.calendarDay) return;
  const [year, month, day] = cell.dataset.calendarDay.split("-").map(Number);
  selectDay(year!, month!, day!);
});

calendarEl?.addEventListener("keydown", (event) => {
  const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-calendar-day]");
  if (!cell) return;
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      moveFocus(cell, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      moveFocus(cell, 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      moveFocus(cell, -7);
      break;
    case "ArrowDown":
      event.preventDefault();
      moveFocus(cell, 7);
      break;
    case "Enter":
    case " ": {
      event.preventDefault();
      const [year, month, day] = cell.dataset.calendarDay!.split("-").map(Number);
      selectDay(year!, month!, day!);
      break;
    }
    default:
      break;
  }
});

listEl?.addEventListener("click", (event) => {
  const id = (event.target as HTMLElement).closest<HTMLElement>("[data-event-open]")?.dataset.eventOpen;
  if (!id) return;
  const found = events.find((item) => item.id === id);
  if (found) openEditModal(found);
});

createBtn?.addEventListener("click", openCreateModal);
closeButtons.forEach((button) => button.addEventListener("click", closeModal));
allDayInput?.addEventListener("change", updateFormMode);
typeSelect?.addEventListener("change", updateFormMode);
staffSelect?.addEventListener("change", updateStaffColorPreview);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form || !submitBtn) return;

  clearError();
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const rawType = String(formData.get("event_type") ?? "event");
  const payload: Record<string, unknown> = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    // API accepts `event`, not the presentation alias `community`.
    event_type: normalizeEventType(rawType) === "community" ? "event" : rawType,
    all_day: formData.get("all_day") === "on",
    starts_at: String(formData.get("starts_at") ?? ""),
    ends_at: String(formData.get("ends_at") ?? "") || null,
  };

  if (isManager && payload.event_type === "time_off") {
    payload.staff_id = String(formData.get("staff_id") ?? currentStaffId);
  }

  try {
    if (editingEventId) {
      await apiFetch(`/${editingEventId}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await apiFetch("", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    showToast(editingEventId ? "Event updated." : "Event saved.", "success");
    await loadEvents();
  } catch (error) {
    // Preserve the form data — only surface the error.
    showError(friendlyError(error, "Failed to save event"));
  } finally {
    submitBtn.disabled = false;
  }
});

deleteBtn?.addEventListener("click", async () => {
  if (!editingEventId) return;
  if (!deleteConfirmPending) {
    deleteConfirmPending = true;
    deleteBtn.textContent = "Yes, remove";
    if (deleteHintEl) deleteHintEl.hidden = false;
    return;
  }
  clearError();
  try {
    await apiFetch(`/${editingEventId}?soft=1`, { method: "DELETE" });
    closeModal();
    showToast("Event removed.", "success");
    await loadEvents();
  } catch (error) {
    showError(friendlyError(error, "Failed to remove event"));
    resetDeleteConfirm();
  }
});

/** Inject the shared token icons/colors into the static type-filter options. */
function enhanceTypeFilters() {
  root!.querySelectorAll<HTMLElement>("[data-type-icon]").forEach((slot) => {
    const type = normalizeEventType(slot.dataset.typeIcon);
    const style = resolveEventStyle({ eventType: type });
    slot.style.setProperty("--ec-accent", style.color);
    slot.innerHTML = eventIconMarkup(style.icon, { className: "ec-filter__icon" });
  });
}

enhanceTypeFilters();
renderLegend();
void loadEvents();
