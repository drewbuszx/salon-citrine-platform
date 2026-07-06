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

function formatPreferredTime(entry: WaitlistEntry) {
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
  return "—";
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

function renderTable(entries: WaitlistEntry[]) {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const tbody = root?.querySelector<HTMLElement>("[data-waitlist-results]");
  const emptyEl = root?.querySelector<HTMLElement>("[data-waitlist-empty]");
  const clientsBase = root?.dataset.clientsBase ?? "";

  if (!tbody || !emptyEl) return;

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
      return `
        <tr data-waitlist-row="${entry.id}">
          <td><a class="team-list-layout__data-table__link" href="${clientsBase}?q=${encodeURIComponent(entry.clientEmail)}">${escapeHtml(name)}</a></td>
          <td>${escapeHtml(formatPhone(entry.clientPhone))}</td>
          <td>${escapeHtml(entry.staffName)}</td>
          <td>${escapeHtml(services)}</td>
          <td>${escapeHtml(formatPreferredTime(entry))}</td>
          <td>${escapeHtml(formatDateAdded(entry.insertedAt))}</td>
        </tr>`;
    })
    .join("");
}

function applyFilter(term: string) {
  const query = term.trim().toLowerCase();
  if (!query) {
    renderTable(allEntries);
    return;
  }

  const filtered = allEntries.filter((entry) => {
    const haystack = [
      clientName(entry),
      entry.clientEmail,
      entry.clientPhone,
      entry.staffName,
      ...entry.serviceNames,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
  renderTable(filtered);
}

async function loadEntries(apiBase: string) {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const status = root?.querySelector<HTMLElement>("[data-waitlist-status]");
  const tbody = root?.querySelector<HTMLElement>("[data-waitlist-results]");

  if (status) status.hidden = true;
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6">Loading waitlist…</td></tr>`;
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

function initAddModal(apiBase: string) {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  if (root?.dataset.manager !== "1") return;

  const modal = document.querySelector<HTMLElement>("[data-waitlist-add-modal]");
  const form = document.querySelector<HTMLFormElement>("[data-waitlist-add-form]");
  const errorEl = document.querySelector<HTMLElement>("[data-waitlist-add-error]");
  const openBtn = root?.querySelector<HTMLButtonElement>("[data-waitlist-add-open]");

  if (!modal || !form || !openBtn) return;

  function openModal() {
    modal.hidden = false;
    form.reset();
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

function init() {
  const root = document.querySelector<HTMLElement>("[data-waitlist-root]");
  const apiBase = root?.dataset.apiBase ?? "";
  if (!apiBase) return;

  const filterInput = root?.querySelector<HTMLInputElement>("[data-waitlist-filter]");
  filterInput?.addEventListener("input", () => applyFilter(filterInput.value));

  initAddModal(apiBase);
  void loadEntries(apiBase);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
