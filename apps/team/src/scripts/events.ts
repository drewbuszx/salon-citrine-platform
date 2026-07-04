type TeamEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: "event" | "time_off" | "closure" | "announcement";
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
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
const errorEl = root.querySelector<HTMLElement>("[data-events-error]");
const monthLabel = root.querySelector<HTMLElement>("[data-month-label]");
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

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

function formatEventRange(event: TeamEvent) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  if (event.allDay) {
    const startFmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(start);
    if (!end || start.toDateString() === end.toDateString()) {
      return `${startFmt} · All day`;
    }
    const endFmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(end);
    return `${startFmt} – ${endFmt} · All day`;
  }
  const startFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  if (!end) return startFmt;
  const endFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  return `${startFmt} – ${endFmt}`;
}

function typeBadge(type: TeamEvent["eventType"]) {
  const labels: Record<TeamEvent["eventType"], string> = {
    event: "Event",
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

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventOnDate(event: TeamEvent, date: Date) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : start;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  return start <= dayEnd && end >= dayStart;
}

function renderCalendar() {
  if (!calendarEl) return;
  if (monthLabel) {
    monthLabel.textContent = formatMonthLabel(viewYear, viewMonth);
  }

  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date();

  let html = weekdayLabels
    .map((label) => `<div class="events-calendar__head">${label}</div>`)
    .join("");

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="events-calendar__cell events-calendar__cell--muted" aria-hidden="true"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const dayEvents = events.filter((event) => eventOnDate(event, date));
    const dots = dayEvents
      .slice(0, 4)
      .map(
        (event) =>
          `<span class="events-calendar__dot events-calendar__dot--${event.eventType}" title="${escapeHtml(event.title)}"></span>`,
      )
      .join("");
    const isToday = sameDay(date, today);
    html += `
      <div class="events-calendar__cell${isToday ? " events-calendar__cell--today" : ""}">
        <span class="events-calendar__day">${day}</span>
        <div class="events-calendar__dots">${dots}</div>
      </div>
    `;
  }

  calendarEl.innerHTML = html;
}

function renderList() {
  if (!listEl) return;
  const now = new Date();
  const upcoming = [...events]
    .filter((event) => {
      const end = event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt);
      return end >= now;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  if (upcoming.length === 0) {
    listEl.innerHTML = `<p class="empty-state">No upcoming events this month.</p>`;
    return;
  }

  listEl.innerHTML = upcoming
    .map((event) => {
      const staffLine =
        event.eventType === "time_off" && event.staffName
          ? `<span>${escapeHtml(event.staffName)}</span>`
          : "";
      return `
        <button class="event-card" type="button" data-event-open="${event.id}">
          <div class="event-card__top">
            <h4 class="event-card__title">${escapeHtml(event.title)}</h4>
            ${typeBadge(event.eventType)}
          </div>
          ${event.description ? `<p class="event-card__description">${escapeHtml(event.description)}</p>` : ""}
          <div class="event-card__meta">
            <span>${escapeHtml(formatEventRange(event))}</span>
            ${staffLine}
          </div>
        </button>
      `;
    })
    .join("");
}

function toDateInputValue(iso: string) {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
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

prevBtn?.addEventListener("click", () => {
  viewMonth -= 1;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  }
  void loadEvents();
});

nextBtn?.addEventListener("click", () => {
  viewMonth += 1;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  void loadEvents();
});

todayBtn?.addEventListener("click", () => {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  void loadEvents();
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
