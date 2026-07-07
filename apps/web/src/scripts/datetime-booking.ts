import {
  ensureBookingCart,
  reserveBookingCartSlot,
} from "./booking-cart-client";
import { EXISTING_CLIENT_ACK_PARAM } from "../lib/booking-data";
import { appendEmbedIfActive, bookingApi } from "../lib/booking-flow";

export type TimeSlot = {
  label: string;
  startsAt: string;
};

type TimeOfDay = "morning" | "afternoon" | "evening";

const TZ = "America/Indiana/Indianapolis";

function formValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el.value.trim() : "";
}

export function getSlotHour(startsAt: string): number {
  const date = new Date(startsAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour");
  return Number(hourPart?.value ?? 0);
}

export function getTimeOfDay(startsAt: string): TimeOfDay {
  const hour = getSlotHour(startsAt);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Precision-lite: spread morning/afternoon/evening when possible, else earliest three. */
export function rankRecommendedSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];
  if (slots.length <= 3) return [...slots];

  const buckets: Record<TimeOfDay, TimeSlot[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    buckets[getTimeOfDay(slot.startsAt)].push(slot);
  }

  const picked: TimeSlot[] = [];
  const periods: TimeOfDay[] = ["morning", "afternoon", "evening"];

  for (const period of periods) {
    if (buckets[period].length > 0 && picked.length < 3) {
      picked.push(buckets[period][0]);
    }
  }

  if (picked.length < 3) {
    const pickedStarts = new Set(picked.map((slot) => slot.startsAt));
    for (const slot of slots) {
      if (picked.length >= 3) break;
      if (!pickedStarts.has(slot.startsAt)) {
        picked.push(slot);
        pickedStarts.add(slot.startsAt);
      }
    }
  }

  return picked.slice(0, 3);
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function calendarGridBounds(year: number, month: number) {
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const noon = new Date(`${firstOfMonth}T12:00:00.000Z`);
  const dow = noon.getUTCDay();
  const startDate = new Date(Date.UTC(year, month - 1, 1 - dow));
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 41);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(startDate), end: fmt(endDate) };
}

function formatMonthYear(year: number, month: number): string {
  const anchor = `${year}-${String(month).padStart(2, "0")}-15T12:00:00.000Z`;
  return new Date(anchor).toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(year: number, month: number, delta: number) {
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 };
}

function buildCells(year: number, month: number, today: string) {
  const { start } = calendarGridBounds(year, month);
  const cells = [];
  const startParts = start.split("-").map(Number);
  let cursor = new Date(
    Date.UTC(startParts[0], startParts[1] - 1, startParts[2]),
  );

  for (let i = 0; i < 42; i++) {
    const date = cursor.toISOString().slice(0, 10);
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    cells.push({
      date,
      day: d,
      isCurrentMonth: y === year && m === month,
      isToday: date === today,
      isPast: date < today,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

function monthBoundsFromToday(today: string) {
  const parts = today.split("-").map(Number);
  return { year: parts[0], month: parts[1] };
}

function monthBoundsFromDate(dateStr: string) {
  const parts = dateStr.split("-").map(Number);
  return { year: parts[0], month: parts[1] };
}

function canNavigatePrev(year: number, month: number, today: string) {
  const prev = shiftMonth(year, month, -1);
  const min = monthBoundsFromToday(today);
  return monthParam(prev.year, prev.month) >= monthParam(min.year, min.month);
}

function canNavigateNext(year: number, month: number, horizonEnd: string) {
  const next = shiftMonth(year, month, 1);
  const max = monthBoundsFromDate(horizonEnd);
  return monthParam(next.year, next.month) <= monthParam(max.year, max.month);
}

function syncUrl(root: HTMLElement, selectedDate: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("services", root.dataset.servicesParam ?? "");
  params.set("stylist", root.dataset.stylistSlug ?? "");
  if (root.dataset.flow) params.set("flow", root.dataset.flow);
  params.set(
    "month",
    monthParam(Number(root.dataset.year), Number(root.dataset.month)),
  );
  if (selectedDate) {
    params.set("date", selectedDate);
  } else {
    params.delete("date");
  }
  const next = `${root.dataset.datetimeUrl}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

function createTimeOption(slot: TimeSlot, badge?: string): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "time-option";
  if (badge) label.classList.add("time-option--recommended");

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "time";
  input.value = slot.label;
  input.required = true;
  input.dataset.startsAt = slot.startsAt;

  const pill = document.createElement("span");
  pill.className = "time-option__pill";

  const labelText = document.createElement("span");
  labelText.className = "time-option__label";
  labelText.textContent = slot.label;
  pill.appendChild(labelText);

  if (badge) {
    const badgeEl = document.createElement("span");
    badgeEl.className = "time-option__badge";
    badgeEl.textContent = badge;
    pill.appendChild(badgeEl);
  }

  label.appendChild(input);
  label.appendChild(pill);
  return label;
}

function wireTimeForm(form: HTMLFormElement) {
  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== "time") return;
    const startsAtInput = form.querySelector<HTMLInputElement>(
      "[data-starts-at-input]",
    );
    if (startsAtInput) {
      startsAtInput.value = target.dataset.startsAt ?? "";
    }
  });
}

function buildHiddenFields(
  servicesParam: string,
  stylistSlug: string,
  flow: string,
  existingAck: boolean,
  embed: boolean,
  selectedDate: string,
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const addHidden = (name: string, value: string) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    fragment.appendChild(input);
  };

  addHidden("services", servicesParam);
  addHidden("stylist", stylistSlug);
  if (flow) addHidden("flow", flow);
  if (existingAck) addHidden(EXISTING_CLIENT_ACK_PARAM, "1");
  if (embed) addHidden("embed", "1");

  const startsAtInput = document.createElement("input");
  startsAtInput.type = "hidden";
  startsAtInput.name = "startsAt";
  startsAtInput.value = "";
  startsAtInput.dataset.startsAtInput = "";
  fragment.appendChild(startsAtInput);

  const dateInput = document.createElement("input");
  dateInput.type = "hidden";
  dateInput.name = "date";
  dateInput.value = selectedDate;
  dateInput.dataset.timeDateInput = "";
  fragment.appendChild(dateInput);

  return fragment;
}

export function renderTimeSkeleton(panel: HTMLElement): void {
  panel.innerHTML = "";
  panel.setAttribute("aria-busy", "true");

  const skeleton = document.createElement("div");
  skeleton.className = "time-skeleton";
  skeleton.dataset.timeSkeleton = "";
  skeleton.setAttribute("aria-hidden", "true");
  skeleton.innerHTML = `
    <div class="time-skeleton__heading"></div>
    <div class="time-skeleton__strip">
      <span></span><span></span><span></span>
    </div>
    <div class="time-skeleton__grid">
      ${Array.from({ length: 9 }, () => "<span></span>").join("")}
    </div>
  `;
  panel.appendChild(skeleton);
}

export function renderTimePanel(
  panel: HTMLElement,
  selectedDate: string,
  slots: TimeSlot[],
  detailsUrl: string,
  servicesParam: string,
  stylistSlug: string,
  flow: string,
  existingAck: boolean,
  embed: boolean,
): void {
  panel.innerHTML = "";
  panel.removeAttribute("aria-busy");

  if (!selectedDate) {
    const empty = document.createElement("p");
    empty.className = "time-section__empty";
    empty.dataset.timeEmpty = "";
    empty.textContent = "Select a date to see available times.";
    panel.appendChild(empty);
    return;
  }

  if (!slots.length) {
    const empty = document.createElement("p");
    empty.className = "time-section__empty";
    empty.dataset.timeEmpty = "";
    empty.textContent = "No times left on this day.";
    panel.appendChild(empty);
    return;
  }

  const recommended = rankRecommendedSlots(slots);

  const form = document.createElement("form");
  form.className = "time-form";
  form.method = "get";
  form.action = detailsUrl;
  form.dataset.timeForm = "";
  form.appendChild(
    buildHiddenFields(
      servicesParam,
      stylistSlug,
      flow,
      existingAck,
      embed,
      selectedDate,
    ),
  );

  const recommendedSection = document.createElement("div");
  recommendedSection.className = "time-recommended";
  recommendedSection.dataset.timeRecommended = "";

  const recommendedHeading = document.createElement("h4");
  recommendedHeading.className = "time-recommended__heading";
  recommendedHeading.textContent = "Recommended for you";
  recommendedSection.appendChild(recommendedHeading);

  const recommendedStrip = document.createElement("div");
  recommendedStrip.className = "time-recommended__strip";
  recommendedStrip.setAttribute("role", "group");
  recommendedStrip.setAttribute("aria-label", "Recommended times");

  recommended.forEach((slot, index) => {
    recommendedStrip.appendChild(
      createTimeOption(slot, index === 0 ? "Best match" : undefined),
    );
  });
  recommendedSection.appendChild(recommendedStrip);
  form.appendChild(recommendedSection);

  const gridWrap = document.createElement("div");
  gridWrap.className = "time-grid-tray";

  const gridHeading = document.createElement("h4");
  gridHeading.className = "time-grid-tray__heading";
  gridHeading.textContent = "All available times";
  gridWrap.appendChild(gridHeading);

  const grid = document.createElement("div");
  grid.className = "time-grid";
  grid.dataset.timeGrid = "";
  grid.setAttribute("role", "radiogroup");
  grid.setAttribute("aria-label", "Available times");

  for (const slot of slots) {
    grid.appendChild(createTimeOption(slot));
  }
  gridWrap.appendChild(grid);
  form.appendChild(gridWrap);

  const actions = document.createElement("div");
  actions.className = "time-form__actions";
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "sc-button sc-button--primary";
  button.textContent = "Continue";
  actions.appendChild(button);
  form.appendChild(actions);

  panel.appendChild(form);
  wireTimeForm(form);
}

function renderCalendar(
  root: HTMLElement,
  year: number,
  month: number,
  availableDates: string[],
  selectedDate: string,
) {
  const today = root.dataset.today ?? "";
  const horizonEnd = root.dataset.horizonEnd ?? "";
  const title = root.querySelector<HTMLElement>("[data-cal-title]");
  const grid = root.querySelector<HTMLElement>("[data-cal-grid]");
  const prevBtn = root.querySelector<HTMLButtonElement>("[data-cal-prev]");
  const nextBtn = root.querySelector<HTMLButtonElement>("[data-cal-next]");
  if (!title || !grid || !prevBtn || !nextBtn) return;

  root.dataset.year = String(year);
  root.dataset.month = String(month);
  title.textContent = formatMonthYear(year, month);

  prevBtn.disabled = !canNavigatePrev(year, month, today);
  nextBtn.disabled = !canNavigateNext(year, month, horizonEnd);

  const available = new Set(availableDates);
  const cells = buildCells(year, month, today);
  grid.innerHTML = "";

  for (const cell of cells) {
    const isAvailable = available.has(cell.date);
    const isSelected = cell.date === selectedDate;
    const isDisabled =
      !cell.isCurrentMonth ||
      cell.isPast ||
      cell.date > horizonEnd ||
      !isAvailable;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar__day";
    btn.dataset.date = cell.date;
    btn.dataset.available = isAvailable ? "true" : "false";
    btn.setAttribute("role", "gridcell");
    btn.setAttribute("aria-label", cell.date);
    btn.setAttribute("aria-selected", String(isSelected));

    if (!cell.isCurrentMonth) btn.classList.add("calendar__day--outside");
    if (cell.isToday) {
      btn.classList.add("calendar__day--today");
      btn.setAttribute("aria-current", "date");
    }
    if (isSelected) btn.classList.add("calendar__day--selected");
    if (isAvailable && !isDisabled) btn.classList.add("calendar__day--available");
    if (isDisabled) {
      btn.classList.add("calendar__day--disabled");
      btn.disabled = true;
    }

    const num = document.createElement("span");
    num.className = "calendar__day-num";
    num.textContent = String(cell.day);
    btn.appendChild(num);
    grid.appendChild(btn);
  }
}

async function fetchMonthAvailability(
  root: HTMLElement,
  year: number,
  month: number,
): Promise<string[]> {
  const today = root.dataset.today ?? "";
  const horizonEnd = root.dataset.horizonEnd ?? "";
  const { start, end } = calendarGridBounds(year, month);
  const queryStart = start < today ? today : start;
  const queryEnd = end > horizonEnd ? horizonEnd : end;

  if (queryStart > queryEnd) return [];

  const params = new URLSearchParams({
    staff: root.dataset.staffId ?? "",
    services: root.dataset.serviceIds ?? root.dataset.servicesParam ?? "",
    start: queryStart,
    end: queryEnd,
  });

  const response = await fetch(`${root.dataset.datesApi}?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load dates");
  const payload = await response.json();
  return payload.dates ?? [];
}

async function fetchSlots(root: HTMLElement, date: string): Promise<TimeSlot[]> {
  const params = new URLSearchParams({
    staff: root.dataset.staffId ?? "",
    services: root.dataset.serviceIds ?? root.dataset.servicesParam ?? "",
    date,
  });
  const response = await fetch(`${root.dataset.slotsApi}?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load slots");
  const payload = await response.json();
  return payload.slots ?? [];
}

function initDatetimeCalendar() {
  const root = document.querySelector<HTMLElement>("[data-datetime-picker]");
  if (!root) return;

  let selectedDate = root.dataset.selectedDate || "";
  let loadingMonth = false;

  const panel = root.querySelector<HTMLElement>("[data-time-panel]");
  const detailsUrl = root.dataset.detailsUrl ?? "";
  const servicesParam = root.dataset.servicesParam ?? "";
  const stylistSlug = root.dataset.stylistSlug ?? "";
  const flow = root.dataset.flow ?? "";
  const existingAck = root.dataset.existingAck === "1";
  const embed = root.dataset.embed === "1";

  document.querySelectorAll<HTMLFormElement>("[data-time-form]").forEach(wireTimeForm);

  async function selectDate(date: string) {
    selectedDate = date;
    root.dataset.selectedDate = date;
    syncUrl(root, selectedDate);

    const year = Number(root.dataset.year);
    const month = Number(root.dataset.month);
    const availableDates = await fetchMonthAvailability(root, year, month);
    renderCalendar(root, year, month, availableDates, selectedDate);

    if (!panel) return;
    renderTimeSkeleton(panel);
    try {
      const slots = await fetchSlots(root, date);
      renderTimePanel(
        panel,
        date,
        slots,
        detailsUrl,
        servicesParam,
        stylistSlug,
        flow,
        existingAck,
        embed,
      );
    } catch {
      renderTimePanel(
        panel,
        date,
        [],
        detailsUrl,
        servicesParam,
        stylistSlug,
        flow,
        existingAck,
        embed,
      );
    }
  }

  async function changeMonth(delta: number) {
    if (loadingMonth) return;
    const year = Number(root.dataset.year);
    const month = Number(root.dataset.month);
    const next = shiftMonth(year, month, delta);
    const today = root.dataset.today ?? "";
    const horizonEnd = root.dataset.horizonEnd ?? "";

    if (delta < 0 && !canNavigatePrev(year, month, today)) return;
    if (delta > 0 && !canNavigateNext(year, month, horizonEnd)) return;

    loadingMonth = true;
    root.setAttribute("aria-busy", "true");
    try {
      const availableDates = await fetchMonthAvailability(
        root,
        next.year,
        next.month,
      );
      renderCalendar(root, next.year, next.month, availableDates, selectedDate);
      syncUrl(root, selectedDate);
    } finally {
      loadingMonth = false;
      root.removeAttribute("aria-busy");
    }
  }

  root.querySelector("[data-cal-prev]")?.addEventListener("click", () => {
    changeMonth(-1);
  });

  root.querySelector("[data-cal-next]")?.addEventListener("click", () => {
    changeMonth(1);
  });

  root.querySelector("[data-cal-grid]")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-date]");
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.disabled || button.dataset.available !== "true") return;
    selectDate(button.dataset.date ?? "");
  });
}

function initDatetimePicker() {
  const root = document.querySelector<HTMLElement>("[data-datetime-picker]");
  if (!root) return;

  root.addEventListener(
    "submit",
    async (event) => {
      const form = (event.target as Element)?.closest("form[data-time-form]");
      if (!(form instanceof HTMLFormElement)) return;
      if (!root.contains(form)) return;
      event.preventDefault();

      const startsAt = formValue(form, "startsAt");
      if (!startsAt) return;

      const servicesParam =
        root.dataset.servicesParam ?? root.dataset.serviceIds ?? "";
      const serviceIds = servicesParam.split(",").filter(Boolean);
      const staffSlug = root.dataset.stylistSlug ?? "";
      if (!staffSlug || serviceIds.length === 0) return;

      const submitBtn = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      submitBtn?.setAttribute("disabled", "true");
      form.setAttribute("aria-busy", "true");

      try {
        const cartId = await ensureBookingCart({
          cartApiUrl: bookingApi.cart,
          staffSlug,
          serviceIds,
        });

        await reserveBookingCartSlot({
          cartApiUrl: bookingApi.cart,
          cartId,
          staffSlug,
          serviceIds,
          startsAt,
        });

        const params = new URLSearchParams(new FormData(form));
        params.set("cartId", cartId);
        params.delete("time");
        appendEmbedIfActive(params);
        const detailsUrl = root.dataset.detailsUrl ?? "";
        window.location.href = `${detailsUrl}?${params.toString()}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not hold this time";
        const panel = root.querySelector<HTMLElement>("[data-time-panel]");
        let errEl = panel?.querySelector<HTMLElement>("[data-reserve-error]");
        if (!errEl && panel) {
          errEl = document.createElement("p");
          errEl.className = "notice notice--error";
          errEl.dataset.reserveError = "";
          errEl.setAttribute("role", "alert");
          panel.prepend(errEl);
        }
        if (errEl) errEl.textContent = message;
        submitBtn?.removeAttribute("disabled");
        form.removeAttribute("aria-busy");
      }
    },
    true,
  );
}

function init() {
  initDatetimeCalendar();
  initDatetimePicker();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
