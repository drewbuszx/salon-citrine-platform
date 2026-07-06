import { showToast, friendlyError } from "../lib/toast";

type WaitlistEntry = {
  id: string;
  staffName: string;
  serviceNames: string[];
  preferredDate: string | null;
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
  clientEmail: string;
  clientPhone: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientMessage: string | null;
  status: string;
  insertedAt: string;
};

type TimeSlot = "morning" | "afternoon" | "evening";

const TIME_SLOTS: Record<TimeSlot, { label: string; start: string; end: string }> = {
  morning: { label: "Morning", start: "08:00", end: "12:00" },
  afternoon: { label: "Afternoon", start: "12:00", end: "17:00" },
  evening: { label: "Evening", start: "17:00", end: "20:00" },
};

let allEntries: WaitlistEntry[] = [];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatPhone(value: string | null) {
  return value?.trim() || "—";
}

function timeSlotFromRange(start: string | null, end: string | null): TimeSlot | null {
  if (!start || !end) return null;
  const startKey = start.slice(0, 5);
  const endKey = end.slice(0, 5);
  for (const [slot, range] of Object.entries(TIME_SLOTS) as Array<[TimeSlot, (typeof TIME_SLOTS)[TimeSlot]]>) {
    if (range.start === startKey && range.end === endKey) return slot;
  }
  return null;
}

function formatPreferredTime(entry: WaitlistEntry) {
  const slot = timeSlotFromRange(entry.preferredTimeStart, entry.preferredTimeEnd);
  if (slot) return TIME_SLOTS[slot].label;

  if (entry.preferredTimeStart && entry.preferredTimeEnd) {
    const start = entry.preferredTimeStart.slice(0, 5);
    const end = entry.preferredTimeEnd.slice(0, 5);
    return `${start} – ${end}`;
  }

  if (entry.preferredDate) {
    return new Date(`${entry.preferredDate}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return "Any time";
}

function formatDateAdded(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clientName(entry: WaitlistEntry) {
  const name = [entry.clientFirstName, entry.clientLastName].filter(Boolean).join(" ");
  return name || entry.clientEmail;
}

function updateStats(visible: number, total: number, query: string) {
  const countEl = document.querySelector<HTMLElement>("[data-waitlist-count]");
  const filterHint = document.querySelector<HTMLElement>("[data-waitlist-filter-hint]");

  if (countEl) {
    countEl.textContent = String(total);
  }

  if (filterHint) {
    const trimmed = query.trim();
    if (!trimmed) {
      filterHint.hidden = true;
      filterHint.textContent = "";
      return;
    }

    filterHint.hidden = false;
    filterHint.textContent =
      visible === 0
        ? `No matches for “${trimmed}”. Try name, phone, email, staff, or service.`
        : `Showing ${visible} of ${total} ${total === 1 ? "entry" : "entries"}`;
  }
}

function updateEmptyState(entries: WaitlistEntry[], query: string) {
  const emptyEl = document.querySelector<HTMLElement>("[data-waitlist-empty]");
  const titleEl = document.querySelector<HTMLElement>("[data-waitlist-empty-title]");
  const hintEl = document.querySelector<HTMLElement>("[data-waitlist-empty-hint]");
  if (!emptyEl) return;

  const trimmed = query.trim();
  if (allEntries.length === 0) {
    if (titleEl) titleEl.textContent = "No one on the waitlist";
    if (hintEl) {
      hintEl.textContent =
        "When clients request a spot, they'll appear here so you can fit them in.";
    }
    return;
  }

  if (entries.length === 0 && trimmed) {
    if (titleEl) titleEl.textContent = "No matches";
    if (hintEl) {
      hintEl.textContent = `Nothing matched “${trimmed}”. Try a different name, phone, or service.`;
    }
  }
}

function renderTable(entries: WaitlistEntry[], query = "") {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const tbody = root?.querySelector<HTMLElement>("[data-waitlist-results]");
  const emptyEl = root?.querySelector<HTMLElement>("[data-waitlist-empty]");
  const clientsBase = root?.dataset.clientsBase ?? "";

  if (!tbody || !emptyEl) return;

  updateStats(entries.length, allEntries.length, query);
  updateEmptyState(entries, query);

  if (entries.length === 0) {
    tbody.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  tbody.innerHTML = entries
    .map((entry) => {
      const name = clientName(entry);
      const services =
        entry.serviceNames.length > 0 ? entry.serviceNames.join(", ") : "—";
      const preferred = formatPreferredTime(entry);
      return `
        <tr data-waitlist-row="${entry.id}">
          <td><a class="team-list-layout__data-table__link" href="${clientsBase}?q=${encodeURIComponent(entry.clientEmail)}">${escapeHtml(name)}</a></td>
          <td class="waitlist-table__phone">${escapeHtml(formatPhone(entry.clientPhone))}</td>
          <td>${escapeHtml(entry.staffName)}</td>
          <td class="waitlist-table__services">${escapeHtml(services)}</td>
          <td class="waitlist-table__preferred">${escapeHtml(preferred)}</td>
          <td class="waitlist-table__date">${escapeHtml(formatDateAdded(entry.insertedAt))}</td>
        </tr>`;
    })
    .join("");
}

function applyFilter(term: string) {
  const query = term.trim().toLowerCase();
  if (!query) {
    renderTable(allEntries, term);
    return;
  }

  const filtered = allEntries.filter((entry) => {
    const haystack = [
      clientName(entry),
      entry.clientEmail,
      entry.clientPhone,
      entry.staffName,
      formatPreferredTime(entry),
      ...entry.serviceNames,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
  renderTable(filtered, term);
}

async function loadEntries(apiBase: string) {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const status = root?.querySelector<HTMLElement>("[data-waitlist-status]");
  const tbody = root?.querySelector<HTMLElement>("[data-waitlist-results]");

  if (status) status.hidden = true;
  if (tbody) {
    tbody.innerHTML = `<tr class="waitlist-table__loading"><td colspan="6">Loading waitlist…</td></tr>`;
  }

  try {
    const res = await fetch(`${apiBase}?status=active`);
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load waitlist");

    allEntries = (body.entries ?? []) as WaitlistEntry[];
    const filterInput = root?.querySelector<HTMLInputElement>("[data-waitlist-filter]");
    applyFilter(filterInput?.value ?? "");
  } catch (err) {
    if (status) {
      status.textContent = friendlyError(err, "Could not load waitlist");
      status.hidden = false;
      status.classList.add("team-list-layout__notice--error");
    }
    allEntries = [];
    renderTable([]);
  }
}

function initTimeChips(form: HTMLFormElement) {
  const hiddenInput = form.querySelector<HTMLInputElement>("[data-waitlist-time-slot]");
  const chips = form.querySelectorAll<HTMLButtonElement>("[data-time-chip]");

  function setSlot(slot: TimeSlot | "") {
    if (hiddenInput) hiddenInput.value = slot;
    chips.forEach((chip) => {
      const active = chip.dataset.timeChip === slot;
      chip.classList.toggle("waitlist-modal__chip--active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const slot = chip.dataset.timeChip as TimeSlot | undefined;
      if (!slot) return;
      const current = hiddenInput?.value ?? "";
      setSlot(current === slot ? "" : slot);
    });
  });

  form.addEventListener("reset", () => setSlot(""));
}

function initAddModal(apiBase: string) {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  if (root?.dataset.manager !== "1") return;

  const modal = document.querySelector<HTMLElement>("[data-waitlist-add-modal]");
  const form = document.querySelector<HTMLFormElement>("[data-waitlist-add-form]");
  const errorEl = document.querySelector<HTMLElement>("[data-waitlist-add-error]");
  const openBtn = root?.querySelector<HTMLButtonElement>("[data-waitlist-add-open]");

  if (!modal || !form || !openBtn) return;

  initTimeChips(form);

  function openModal() {
    modal.hidden = false;
    form.reset();
    form.dispatchEvent(new Event("reset"));
    if (errorEl) errorEl.hidden = true;
    form.querySelector<HTMLElement>("input, select")?.focus();
  }

  function closeModal() {
    modal.hidden = true;
  }

  openBtn.addEventListener("click", openModal);
  modal.querySelectorAll<HTMLElement>("[data-waitlist-add-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const formData = new FormData(form);
    const timeSlot = String(formData.get("preferredTimeSlot") ?? "").trim() as TimeSlot | "";
    const slotRange = timeSlot ? TIME_SLOTS[timeSlot] : null;

    const payload = {
      client: {
        firstName: String(formData.get("firstName") ?? "").trim(),
        lastName: String(formData.get("lastName") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim() || undefined,
      },
      staffId: String(formData.get("staffId") ?? "").trim() || undefined,
      serviceIds: [String(formData.get("serviceId") ?? "").trim()],
      preferredDate: String(formData.get("preferredDate") ?? "").trim() || undefined,
      preferredTimeStart: slotRange?.start,
      preferredTimeEnd: slotRange?.end,
      clientMessage: String(formData.get("clientMessage") ?? "").trim() || undefined,
    };

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to add to waitlist");

      closeModal();
      showToast("Added to waitlist.", "success");
      void loadEntries(apiBase);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = friendlyError(err, "Failed to add to waitlist");
        errorEl.hidden = false;
      }
    }
  });
}

function initSearch() {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const filterInput = root?.querySelector<HTMLInputElement>("[data-waitlist-filter]");
  const clearBtn = root?.querySelector<HTMLButtonElement>("[data-waitlist-filter-clear]");

  if (!filterInput) return;

  function syncClear() {
    if (!clearBtn) return;
    const hasValue = filterInput.value.trim().length > 0;
    clearBtn.hidden = !hasValue;
  }

  filterInput.addEventListener("input", () => {
    applyFilter(filterInput.value);
    syncClear();
  });

  clearBtn?.addEventListener("click", () => {
    filterInput.value = "";
    applyFilter("");
    syncClear();
    filterInput.focus();
  });

  syncClear();
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const apiBase = root?.dataset.apiBase ?? "";
  if (!apiBase) return;

  initSearch();
  initAddModal(apiBase);
  void loadEntries(apiBase);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
