import { TIMEZONE } from "@saloncitrine/shared";
import { localDateTimeToUtc } from "../lib/datetime";
import { staffAccentColor } from "../lib/staff-colors";

type TeamEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: "event" | "time_off" | "closure" | "announcement";
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

const root = document.querySelector<HTMLElement>("[data-events-app]");
if (!root) {
  throw new Error("Events app root not found");
}

const apiBase = root.dataset.apiBase ?? "";
const isManager = root.dataset.manager === "1";
const currentStaffId = root.dataset.currentStaffId ?? "";
const calendarEl = root.querySelector<HTMLElement>("[data-events-calendar]");
const listEl = root.querySelector<HTMLElement>("[data-events-list]");
const listTitleEl = root.querySelector<HTMLElement>("[data-events-list-title]");
const clearDayBtn = root.querySelector<HTMLButtonElement>("[data-events-clear-day]");
const errorEl = root.querySelector<HTMLElement>("[data-events-error]");
const monthHeader = root.querySelector<HTMLElement>("[data-month-header]");
const prevBtn = root.querySelector<HTMLButtonElement>("[data-month-prev]");
const nextBtn = root.querySelector<HTMLButtonElement>("[data-month-next]");
const todayBtn = root.querySelector<HTMLButtonElement>("[data-month-today]");
const createBtn = root.querySelector<HTMLButtonElement>("[data-event-create]");
const modal = document.querySelector<HTMLDialogElement>("[data-event-modal]");
const form = document.querySelector<HTMLFormElement>("[data-event-form]");
const modalTitle = document.querySelector<HTMLElement>("[data-event-modal-title]");
const closeButtons = document.querySelectorAll<HTMLButtonElement>("[data-event-modal-close]");
const submitBtn = document.querySelector<HTMLButtonElement>("[data-event-submit]");
const deleteBtn = document.querySelector<HTMLButtonElement>("[data-event-delete]");
const typeSelect = document.querySelector<HTMLSelectElement>("[data-event-type]");
const staffPicker = document.querySelector<HTMLElement>("[data-staff-picker]");
const allDayInput = document.querySelector<HTMLInputElement>("[data-all-day]");
const startLabel = document.querySelector<HTMLElement>("[data-start-label]");
const endLabel = document.querySelector<HTMLElement>("[data-end-label]");
const startsInput = form?.querySelector<HTMLInputElement>('input[name="starts_at"]');
const endsInput = form?.querySelector<HTMLInputElement>('input[name="ends_at"]');

let events: TeamEvent[] = [];
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let editingEventId: string | null = null;
let selectedDay: { year: number; month: number; day: number } | null = null;

function getActiveTypeFilters(): Set<TeamEvent["eventType"]> {
  const active = new Set<TeamEvent["eventType"]>();
  root.querySelectorAll<HTMLInputElement>("[data-filter-type]").forEach((input) => {
    const type = input.dataset.filterType as TeamEvent["eventType"];
    if (input.checked && type) active.add(type);
  });
  if (active.size === 0) {
    return new Set(["closure", "event", "announcement", "time_off"]);
  }
  return active;
}

function getStaffFilter(): string {
  return root.querySelector<HTMLInputElement>("[data-filter-staff]:checked")?.value?.trim() ?? "";
}

function filteredEvents() {
  const types = getActiveTypeFilters();
  const staffId = getStaffFilter();
  return events.filter((event) => {
    if (!types.has(event.eventType)) return false;
    if (!staffId) return true;
    if (event.eventType === "time_off") return event.staffId === staffId;
    return event.createdByStaffId === staffId;
  });
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    if (!end || salonDateFromIso(event.startsAt) === salonDateFromIso(event.endsAt)) {
      return `${startFmt} · All day`;
    }
    const endFmt = dateFmt.format(end);
    return `${startFmt} – ${endFmt} · All day`;
  }

  const startFmt = `${dateFmt.format(start)}, ${timeFmt.format(start)}`;
  if (!end) return startFmt;
  const endFmt = timeFmt.format(end);
  return `${startFmt} – ${endFmt}`;
}

function typeBadge(type: TeamEvent["eventType"]) {
  const labels: Record<TeamEvent["eventType"], string> = {
    event: "Community",
    time_off: "Time off",
    closure: "Closure",
    announcement: "Announcement",
  };
  return `<span class="event-badge event-badge--${type}">${labels[type]}</span>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventOnDate(event: TeamEvent, year: number, month: number, day: number) {
  const dateStr = calendarDateStr(year, month, day);
  const startDate = salonDateFromIso(event.startsAt);
  const endDate = salonDateFromIso(event.endsAt ?? event.startsAt);
  return dateStr >= startDate && dateStr <= endDate;
}

/** Staff color: time off uses the subject; everything else uses who created it. */
function eventStaffId(event: TeamEvent) {
  if (event.eventType === "time_off" && event.staffId) {
    return event.staffId;
  }
  return event.createdByStaffId;
}

function eventStaffColor(event: TeamEvent) {
  return staffAccentColor(eventStaffId(event));
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

function renderEventMarker(event: TeamEvent) {
  const color = eventStaffColor(event);
  const title = escapeHtml(event.title);
  return `<span class="events-calendar__marker events-calendar__marker--${event.eventType}" style="--event-staff-color: ${color}" title="${title}" aria-hidden="true"></span>`;
}

function renderDayMarkers(dayEvents: TeamEvent[]) {
  const maxMarkers = 6;
  const shown = dayEvents.slice(0, maxMarkers);
  const markers = shown.map(renderEventMarker).join("");
  const totalHidden = dayEvents.length - shown.length;
  const overflow =
    totalHidden > 0
      ? `<span class="events-calendar__more" aria-hidden="true">+${totalHidden}</span>`
      : "";
  return `${markers}${overflow}`;
}

function renderCalendar() {
  if (!calendarEl) return;
  if (monthHeader) {
    monthHeader.textContent = formatMonthLabel(viewYear, viewMonth);
  }

  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = salonDateFromIso(new Date().toISOString());

  let html = weekdayLabels
    .map((label) => `<div class="events-calendar__head">${label}</div>`)
    .join("");

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="events-calendar__cell events-calendar__cell--pad" aria-hidden="true"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = calendarDateStr(viewYear, viewMonth, day);
    const dayEvents = filteredEvents().filter((event) => eventOnDate(event, viewYear, viewMonth, day));
    const markers = renderDayMarkers(dayEvents);
    const isToday = dateStr === todayStr;
    const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isSelected = selectedDay?.year === viewYear && selectedDay.month === viewMonth && selectedDay.day === day;
    const classes = [
      "events-calendar__cell",
      dayEvents.length > 0 ? "events-calendar__cell--has-events" : "",
      isToday ? "events-calendar__cell--today" : "",
      isWeekend ? "events-calendar__cell--weekend" : "",
      isSelected ? "events-calendar__cell--selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const ariaLabel =
      dayEvents.length > 0
        ? `${day}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`
        : String(day);

    html += `
      <button
        class="${classes}"
        type="button"
        data-calendar-day="${dayKey(viewYear, viewMonth, day)}"
        aria-label="${escapeHtml(ariaLabel)}"
        aria-pressed="${isSelected ? "true" : "false"}"
      >
        <span class="events-calendar__day">${day}</span>
        <div class="events-calendar__markers">${markers}</div>
      </button>
    `;
  }

  calendarEl.innerHTML = html;
}

function eventsForList() {
  const base = [...filteredEvents()].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  if (selectedDay) {
    return base.filter((event) => eventOnDate(event, selectedDay.year, selectedDay.month, selectedDay.day));
  }

  const now = new Date();
  return base.filter((event) => {
    const end = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
    return end >= now;
  });
}

function renderList() {
  if (!listEl) return;

  if (listTitleEl) {
    listTitleEl.textContent = selectedDay
      ? formatSelectedDayLabel(selectedDay.year, selectedDay.month, selectedDay.day)
      : "Upcoming";
  }

  if (clearDayBtn) {
    clearDayBtn.hidden = !selectedDay;
  }

  const listed = eventsForList();

  if (listed.length === 0) {
    listEl.innerHTML = selectedDay
      ? `<p class="empty-state">No events on this day.</p>`
      : `<p class="empty-state">No upcoming events this month.</p>`;
    return;
  }

  listEl.innerHTML = listed
    .map((event) => {
      const color = eventStaffColor(event);
      const staffName =
        event.eventType === "time_off" && event.staffName
          ? event.staffName
          : event.createdByName ?? "";
      const metaParts = [formatEventRange(event)];
      if (staffName) metaParts.push(staffName);
      const metaLine = `<span class="event-row__meta">${escapeHtml(metaParts.join(" · "))}</span>`;
      const startDateStr = salonDateFromIso(event.startsAt);
      const [eventYear, eventMonth, eventDay] = startDateStr.split("-").map(Number);
      const eventDayKey = dayKey(eventYear, eventMonth - 1, eventDay);
      return `
        <button
          class="event-row event-row--${event.eventType}"
          type="button"
          data-event-open="${event.id}"
          data-event-day="${eventDayKey}"
          style="--event-staff-color: ${color}"
        >
          <span class="event-row__dot" aria-hidden="true"></span>
          <span class="event-row__title">${escapeHtml(event.title)}</span>
          ${metaLine}
          ${typeBadge(event.eventType)}
        </button>
      `;
    })
    .join("");
}

function toggleSelectedDay(year: number, month: number, day: number) {
  if (selectedDay?.year === year && selectedDay.month === month && selectedDay.day === day) {
    selectedDay = null;
  } else {
    selectedDay = { year, month, day };
  }
  renderCalendar();
  renderList();
  if (!selectedDay || !listEl) return;
  const firstMatch = listEl.querySelector<HTMLElement>("[data-event-day]");
  firstMatch?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

function updateFormMode() {
  const allDay = Boolean(allDayInput?.checked);
  const eventType = typeSelect?.value ?? "event";
  const showStaff = isManager && eventType === "time_off";

  if (staffPicker) {
    staffPicker.hidden = !showStaff;
  }

  if (startsInput) {
    startsInput.type = allDay ? "date" : "datetime-local";
  }
  if (endsInput) {
    endsInput.type = allDay ? "date" : "datetime-local";
  }
  if (startLabel) {
    startLabel.firstChild!.textContent = allDay ? "Start date " : "Starts ";
  }
  if (endLabel) {
    endLabel.firstChild!.textContent = allDay ? "End date (optional) " : "Ends (optional) ";
  }
}

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
  const range = monthRange(viewYear, viewMonth);
  try {
    const data = (await apiFetch(
      `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    )) as { events?: TeamEvent[] };
    events = data.events ?? [];
    renderCalendar();
    renderList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to load events");
    if (listEl) {
      listEl.innerHTML = `<p class="empty-state">Could not load events.</p>`;
    }
  }
}

function resetForm() {
  form?.reset();
  editingEventId = null;
  if (modalTitle) modalTitle.textContent = "Add event";
  if (deleteBtn) deleteBtn.hidden = true;
  if (typeSelect && !isManager) {
    typeSelect.value = "time_off";
  }
  updateFormMode();
}

function openCreateModal() {
  resetForm();
  modal?.showModal();
}

function openEditModal(event: TeamEvent) {
  if (!form) return;
  resetForm();
  editingEventId = event.id;
  if (modalTitle) modalTitle.textContent = "Event details";
  if (deleteBtn) deleteBtn.hidden = !event.canDelete;

  (form.elements.namedItem("title") as HTMLInputElement).value = event.title;
  (form.elements.namedItem("description") as HTMLTextAreaElement).value =
    event.description ?? "";
  if (typeSelect) typeSelect.value = event.eventType;
  if (allDayInput) allDayInput.checked = event.allDay;
  updateFormMode();

  if (startsInput) {
    startsInput.value = event.allDay
      ? toDateInputValue(event.startsAt)
      : toDateTimeLocalValue(event.startsAt);
  }
  if (endsInput && event.endsAt) {
    endsInput.value = event.allDay
      ? toDateInputValue(event.endsAt)
      : toDateTimeLocalValue(event.endsAt);
  }

  const staffSelect = form.elements.namedItem("staff_id") as HTMLSelectElement | null;
  if (staffSelect && event.staffId) {
    staffSelect.value = event.staffId;
  }

  if (!event.canEdit) {
    Array.from(form.elements).forEach((el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.disabled = true;
      }
    });
    if (submitBtn) submitBtn.hidden = true;
  } else {
    if (submitBtn) submitBtn.hidden = false;
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

function refreshViews() {
  renderCalendar();
  renderList();
}

root.querySelectorAll("[data-filter-type]").forEach((el) => {
  el.addEventListener("change", refreshViews);
});
root.querySelectorAll("[data-filter-staff]").forEach((el) => {
  el.addEventListener("change", refreshViews);
});

prevBtn?.addEventListener("click", () => {
  viewMonth -= 1;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  }
  selectedDay = null;
  void loadEvents();
});

nextBtn?.addEventListener("click", () => {
  viewMonth += 1;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  selectedDay = null;
  void loadEvents();
});

todayBtn?.addEventListener("click", () => {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  selectedDay = null;
  void loadEvents();
});

function clearSelectedDay() {
  if (!selectedDay) return;
  selectedDay = null;
  renderCalendar();
  renderList();
}

clearDayBtn?.addEventListener("click", clearSelectedDay);

calendarEl?.addEventListener("click", (event) => {
  const cell = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-calendar-day]");
  if (!cell?.dataset.calendarDay) return;
  const [year, month, day] = cell.dataset.calendarDay.split("-").map(Number);
  toggleSelectedDay(year, month, day);
});

createBtn?.addEventListener("click", openCreateModal);
closeButtons.forEach((button) => button.addEventListener("click", closeModal));
allDayInput?.addEventListener("change", updateFormMode);
typeSelect?.addEventListener("change", updateFormMode);

listEl?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const id = target.closest<HTMLElement>("[data-event-open]")?.dataset.eventOpen;
  if (!id) return;
  const found = events.find((item) => item.id === id);
  if (found) openEditModal(found);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form || !submitBtn) return;

  clearError();
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const payload: Record<string, unknown> = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    event_type: String(formData.get("event_type") ?? "event"),
    all_day: formData.get("all_day") === "on",
    starts_at: String(formData.get("starts_at") ?? ""),
    ends_at: String(formData.get("ends_at") ?? "") || null,
  };

  if (isManager && payload.event_type === "time_off") {
    payload.staff_id = String(formData.get("staff_id") ?? currentStaffId);
  }

  try {
    if (editingEventId) {
      await apiFetch(`/${editingEventId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    await loadEvents();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to save event");
  } finally {
    submitBtn.disabled = false;
  }
});

deleteBtn?.addEventListener("click", async () => {
  if (!editingEventId) return;
  if (!confirm("Remove this event?")) return;
  clearError();
  try {
    await apiFetch(`/${editingEventId}?soft=1`, { method: "DELETE" });
    closeModal();
    await loadEvents();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to remove event");
  }
});

void loadEvents();
