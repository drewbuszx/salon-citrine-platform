import { formatCents } from "@saloncitrine/shared";

const root = document.querySelector<HTMLElement>("[data-client-profile]");
const loading = root?.querySelector<HTMLElement>("[data-loading]");
const errorEl = root?.querySelector<HTMLElement>("[data-error]");
const content = root?.querySelector<HTMLElement>("[data-profile-content]");
const nameEl = root?.querySelector<HTMLElement>("[data-client-name]");
const statsEl = root?.querySelector<HTMLElement>("[data-client-stats]");
const timelineEl = root?.querySelector<HTMLElement>("[data-timeline]");
const notesListEl = root?.querySelector<HTMLElement>("[data-notes-list]");
const bookAgainEl = root?.querySelector<HTMLAnchorElement>("[data-book-again]");
const contactForm = root?.querySelector<HTMLFormElement>("[data-contact-form]");
const notesForm = root?.querySelector<HTMLFormElement>("[data-notes-form]");
const addNoteForm = root?.querySelector<HTMLFormElement>("[data-add-note-form]");

const apiUrl = root?.dataset.apiUrl ?? "";
const notesApiUrl = root?.dataset.notesApiUrl ?? "";
const bookUrl = root?.dataset.bookUrl ?? "/book";

function showError(message: string) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function setField(form: HTMLFormElement | null, name: string, value: string | boolean) {
  const el = form?.elements.namedItem(name);
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = String(value ?? "");
  } else if (el instanceof HTMLTextAreaElement) {
    el.value = String(value ?? "");
  }
}

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim();
  }
  return "";
}

function readCheckbox(form: HTMLFormElement, name: string): boolean {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement && el.checked;
}

async function loadProfile() {
  try {
    const res = await fetch(apiUrl);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load client");

    const client = body.client;
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;

    if (nameEl) nameEl.textContent = client.fullName;
    if (statsEl) {
      const visits = client.visitCount ?? 0;
      const ltv = formatCents(client.lifetimeValueCents ?? 0);
      statsEl.textContent = `${visits} visit${visits === 1 ? "" : "s"} · ${ltv} lifetime`;
    }

    if (bookAgainEl) {
      bookAgainEl.href = bookUrl;
      bookAgainEl.hidden = false;
    }

    setField(contactForm, "firstName", client.firstName);
    setField(contactForm, "lastName", client.lastName);
    setField(contactForm, "email", client.email ?? "");
    setField(contactForm, "phone", client.phone ?? "");
    setField(contactForm, "smsOptIn", client.smsOptIn);
    setField(contactForm, "emailOptIn", client.emailOptIn);

    setField(notesForm, "bookingPreferences", client.bookingPreferences ?? "");
    setField(notesForm, "intakeNotes", client.intakeNotes ?? "");
    setField(notesForm, "formulaNotes", client.formulaNotes ?? "");
    setField(notesForm, "staffNotes", client.staffNotes ?? "");
    setField(notesForm, "tags", (client.tags ?? []).join(", "));

    renderTimeline(body.visitTimeline ?? []);
    renderNotes(body.notes ?? []);
  } catch (err) {
    if (loading) loading.hidden = true;
    showError(err instanceof Error ? err.message : "Failed to load client");
  }
}

function renderTimeline(items: Array<{
  id: string;
  startsAt: string;
  status: string;
  staffName: string;
  serviceNames: string[];
  timeLabel: string;
}>) {
  if (!timelineEl) return;
  timelineEl.innerHTML = "";

  if (items.length === 0) {
    timelineEl.innerHTML = `<li class="empty-state">No visits yet.</li>`;
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "client-timeline__item";
    const date = new Date(item.startsAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    li.innerHTML = `
      <p class="client-timeline__meta">${date} · ${item.timeLabel} · ${item.staffName}</p>
      <p>${item.serviceNames.join(", ") || "Appointment"}</p>
      <span class="client-timeline__status">${item.status.replace(/_/g, " ")}</span>
    `;
    timelineEl.appendChild(li);
  }
}

function renderNotes(
  notes: Array<{
    id: string;
    noteType: string;
    body: string;
    createdAt: string;
    staffName: string;
  }>,
) {
  if (!notesListEl) return;
  notesListEl.innerHTML = "";

  if (notes.length === 0) {
    notesListEl.innerHTML = `<li class="empty-state">No notes yet.</li>`;
    return;
  }

  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "client-notes__item";
    const when = new Date(note.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    li.innerHTML = `
      <p class="client-notes__meta">${when} · ${note.staffName} · ${note.noteType}</p>
      <p>${note.body}</p>
    `;
    notesListEl.appendChild(li);
  }
}

async function patchClient(payload: Record<string, unknown>) {
  const res = await fetch(apiUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Save failed");
}

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await patchClient({
      firstName: readField(contactForm, "firstName"),
      lastName: readField(contactForm, "lastName"),
      email: readField(contactForm, "email") || null,
      phone: readField(contactForm, "phone") || null,
      smsOptIn: readCheckbox(contactForm, "smsOptIn"),
      emailOptIn: readCheckbox(contactForm, "emailOptIn"),
    });
    showError("");
    await loadProfile();
  } catch (err) {
    showError(err instanceof Error ? err.message : "Save failed");
  }
});

notesForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tagsRaw = readField(notesForm, "tags");
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  try {
    await patchClient({
      bookingPreferences: readField(notesForm, "bookingPreferences") || null,
      intakeNotes: readField(notesForm, "intakeNotes") || null,
      formulaNotes: readField(notesForm, "formulaNotes") || null,
      staffNotes: readField(notesForm, "staffNotes") || null,
      tags,
    });
    showError("");
    await loadProfile();
  } catch (err) {
    showError(err instanceof Error ? err.message : "Save failed");
  }
});

addNoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const res = await fetch(notesApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType: readField(addNoteForm, "noteType"),
        body: readField(addNoteForm, "body"),
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Could not add note");
    addNoteForm.reset();
    await loadProfile();
  } catch (err) {
    showError(err instanceof Error ? err.message : "Could not add note");
  }
});

void loadProfile();
