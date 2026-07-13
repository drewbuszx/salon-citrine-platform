import { confirmDestructive } from "../lib/confirm-destructive";
import {
  ACCESS_STATUS_BADGE_VARIANT,
  ACCESS_STATUS_LABELS,
  accessActionsForStatus,
  accessStatusLabel,
  STAFF_ROLE_LABELS,
  type AccessActionId,
  type AccessStatus,
} from "../lib/staff-manage";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export {};

const root = document.querySelector<HTMLElement>("[data-manage-employees]");
const apiBase = root?.dataset.apiBase ?? "";
const schedulesApi = root?.dataset.schedulesApi ?? "";
const bookEnabled = root?.dataset.bookEnabled === "true";
const schedulesEnabled = Boolean(schedulesApi) && bookEnabled;
const listEl = root?.querySelector<HTMLElement>("[data-employee-list]");
const filterEmptyEl = root?.querySelector<HTMLElement>("[data-filter-empty]");
const dialog = root?.querySelector<HTMLDialogElement>("[data-employee-dialog]");
const form = root?.querySelector<HTMLFormElement>("[data-employee-form]");
const successEl = root?.querySelector<HTMLElement>("[data-employees-success]");
const errorEl = root?.querySelector<HTMLElement>("[data-employees-error]");
const addButton = root?.querySelector<HTMLButtonElement>("[data-add-employee]");
const closeButton = root?.querySelector<HTMLButtonElement>("[data-close-dialog]");
const formTitle = root?.querySelector<HTMLElement>("[data-employee-form-title]");
const idInput = root?.querySelector<HTMLInputElement>("[data-employee-id]");
const linkStatus = root?.querySelector<HTMLElement>("[data-link-status]");
const accessSection = root?.querySelector<HTMLElement>("[data-access-section]");
const accessNext = root?.querySelector<HTMLElement>("[data-access-next]");
const scheduleSection = root?.querySelector<HTMLElement>("[data-schedule-section]");
const scheduleGrid = root?.querySelector<HTMLElement>("[data-schedule-grid]");
const accessActions = root?.querySelector<HTMLElement>("[data-access-actions]");
const filterRoot = root?.querySelector<HTMLElement>("[data-access-filters]");

let editingId: string | null = null;
let currentAccessStatus: AccessStatus = "uninvited";
let activeFilter: "all" | AccessStatus = "all";

const ROLE_LABELS = STAFF_ROLE_LABELS as Record<string, string>;

function showSuccess(message = "Saved.") {
  if (successEl) {
    successEl.textContent = message;
    successEl.hidden = false;
  }
  if (errorEl) errorEl.hidden = true;
}

function showError(message: string) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  if (successEl) successEl.hidden = true;
}

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAccessStatus(value: string): value is AccessStatus {
  return value in ACCESS_STATUS_LABELS;
}

function badgeClassFor(status: AccessStatus) {
  const variant = ACCESS_STATUS_BADGE_VARIANT[status];
  return variant === "default" ? "ui-badge" : `ui-badge ui-badge--${variant}`;
}

function nextStepsCopy(status: AccessStatus): string {
  switch (status) {
    case "uninvited":
      return "Add an email, then send an invite. They’ll get a link to set a password and sign in.";
    case "invited":
      return "Invite sent. They’ll set a password from the email link, then land on the team dashboard. You can resend if needed.";
    case "active":
      return "This person can sign in to the team app with their password.";
    case "disabled":
      return "Access is off. They can’t sign in until you reactivate them.";
    default:
      return "";
  }
}

function syncAccessUi(status: AccessStatus) {
  currentAccessStatus = status;
  if (linkStatus) {
    linkStatus.hidden = false;
    linkStatus.textContent = `Access: ${accessStatusLabel(status)}.`;
  }
  if (accessNext) {
    const copy = nextStepsCopy(status);
    accessNext.hidden = !copy;
    accessNext.textContent = copy;
  }
  const allowed = new Set(accessActionsForStatus(status));
  accessActions?.querySelectorAll<HTMLButtonElement>("[data-access-action]").forEach((button) => {
    const action = button.dataset.accessAction as AccessActionId | undefined;
    button.hidden = !action || !allowed.has(action);
  });
}

function applyFilter() {
  if (!listEl) return;
  const rows = listEl.querySelectorAll<HTMLElement>("[data-employee-row]");
  let visible = 0;
  rows.forEach((row) => {
    const status = row.dataset.accessStatus ?? "uninvited";
    const show = activeFilter === "all" || status === activeFilter;
    row.hidden = !show;
    if (show) visible += 1;
  });
  const hasRows = rows.length > 0;
  if (filterEmptyEl) {
    filterEmptyEl.hidden = !hasRows || visible > 0;
  }
}

function setFilter(next: "all" | AccessStatus) {
  activeFilter = next;
  filterRoot?.querySelectorAll<HTMLButtonElement>("[data-access-filter]").forEach((button) => {
    const id = button.dataset.accessFilter ?? "all";
    const active = id === next;
    button.classList.toggle("manage-employees__filter--active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  applyFilter();
}

function renderScheduleGrid(schedules: Array<{ day_of_week: number; start_time: string; end_time: string }>) {
  if (!scheduleGrid) return;
  const byDay = new Map(schedules.map((row) => [row.day_of_week, row]));
  const rows = DAY_LABELS.map((label, day) => {
    const row = byDay.get(day);
    const enabled = Boolean(row);
    const container = document.createElement("div");
    container.className = "manage-employees__day-row";
    container.dataset.scheduleDay = String(day);
    const toggle = document.createElement("label");
    toggle.className = "manage-employees__day-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.scheduleEnabled = "";
    checkbox.checked = enabled;
    const labelText = document.createElement("span");
    labelText.textContent = label;
    toggle.append(checkbox, labelText);
    const times = document.createElement("div");
    times.className = "manage-employees__day-times";
    times.dataset.scheduleTimes = "";
    times.hidden = !enabled;
    for (const [kind, value] of [
      ["start", row?.start_time ?? "10:00"],
      ["end", row?.end_time ?? "17:00"],
    ] as const) {
      const input = document.createElement("input");
      input.className = "form-input";
      input.type = "time";
      input.dataset[kind === "start" ? "scheduleStart" : "scheduleEnd"] = "";
      input.value = value.slice(0, 5);
      times.append(input);
    }
    container.append(toggle, times);
    return container;
  });
  scheduleGrid.replaceChildren(...rows);

  scheduleGrid.querySelectorAll<HTMLInputElement>("[data-schedule-enabled]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("[data-schedule-day]");
      const times = row?.querySelector<HTMLElement>("[data-schedule-times]");
      if (times) times.hidden = !checkbox.checked;
    });
  });
}

async function loadSchedules(staffId: string) {
  const response = await fetch(`${schedulesApi}?staff_id=${encodeURIComponent(staffId)}`);
  const body = (await response.json()) as {
    ok?: boolean;
    schedules?: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  };
  if (!response.ok || !body.ok) {
    throw new Error("Could not load schedule");
  }
  renderScheduleGrid(body.schedules ?? []);
}

async function saveSchedules(staffId: string) {
  if (!scheduleGrid) return;

  const schedules: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
  const deletes: number[] = [];

  scheduleGrid.querySelectorAll<HTMLElement>("[data-schedule-day]").forEach((row) => {
    const day = Number(row.dataset.scheduleDay);
    const enabled = row.querySelector<HTMLInputElement>("[data-schedule-enabled]")?.checked;
    if (!enabled) {
      deletes.push(day);
      return;
    }
    const start = row.querySelector<HTMLInputElement>("[data-schedule-start]")?.value ?? "10:00";
    const end = row.querySelector<HTMLInputElement>("[data-schedule-end]")?.value ?? "17:00";
    schedules.push({ day_of_week: day, start_time: start, end_time: end });
  });

  if (schedules.length > 0) {
    const response = await fetch(schedulesApi, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, schedules }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? "Could not save schedule");
    }
  }

  for (const day of deletes) {
    const response = await fetch(schedulesApi, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, day_of_week: day }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? "Could not remove schedule day");
    }
  }
}

function openDialog(mode: "create" | "edit", staff?: Record<string, unknown>, privateDetails?: Record<string, unknown> | null) {
  if (!form || !dialog) return;
  editingId = mode === "edit" && typeof staff?.id === "string" ? staff.id : null;
  form.reset();

  if (formTitle) {
    formTitle.textContent = mode === "create" ? "Add employee" : "Edit employee";
  }

  if (mode === "edit" && staff) {
    (form.elements.namedItem("name") as HTMLInputElement).value = String(staff.name ?? "");
    (form.elements.namedItem("slug") as HTMLInputElement).value = String(staff.slug ?? "");
    (form.elements.namedItem("role") as HTMLSelectElement).value = String(staff.role ?? "stylist");
    (form.elements.namedItem("phone") as HTMLInputElement).value = String(staff.phone ?? "");
    (form.elements.namedItem("email") as HTMLInputElement).value = String(staff.email ?? "");
    (form.elements.namedItem("bio") as HTMLTextAreaElement).value = String(staff.bio ?? "");
    if (bookEnabled) {
      const isBookable = form.elements.namedItem("isBookable") as HTMLInputElement | null;
      const accepting = form.elements.namedItem("acceptingNewClients") as HTMLInputElement | null;
      if (isBookable) isBookable.checked = staff.isBookable !== false;
      if (accepting) accepting.checked = staff.acceptingNewClients !== false;
    }
    (form.elements.namedItem("startDate") as HTMLInputElement).value = String(staff.startDate ?? "");
    (form.elements.namedItem("emergencyContactName") as HTMLInputElement).value = String(
      privateDetails?.emergency_contact_name ?? "",
    );
    (form.elements.namedItem("emergencyContactPhone") as HTMLInputElement).value = String(
      privateDetails?.emergency_contact_phone ?? "",
    );
    if (idInput) idInput.value = String(staff.id ?? "");
    const statusRaw = String(staff.accessStatus ?? "uninvited");
    const status = isAccessStatus(statusRaw) ? statusRaw : "uninvited";
    if (accessSection) accessSection.hidden = false;
    syncAccessUi(status);
    if (scheduleSection) scheduleSection.hidden = !schedulesEnabled;
    if (schedulesEnabled) {
      void loadSchedules(String(staff.id)).catch(() => renderScheduleGrid([]));
    }
  } else {
    if (idInput) idInput.value = "";
    if (accessSection) accessSection.hidden = true;
    if (linkStatus) linkStatus.hidden = true;
    if (accessNext) accessNext.hidden = true;
    if (scheduleSection) scheduleSection.hidden = true;
    renderScheduleGrid([]);
  }

  dialog.showModal();
}

function listSkeletonHtml() {
  return `<div class="manage-employees__skeleton" aria-hidden="true">
    <div class="manage-employees__skeleton-row"></div>
    <div class="manage-employees__skeleton-row"></div>
    <div class="manage-employees__skeleton-row"></div>
  </div>`;
}

async function reloadList() {
  if (!listEl) return;
  listEl.dataset.loading = "true";
  listEl.innerHTML = listSkeletonHtml();

  const response = await fetch(apiBase);
  const body = (await response.json()) as {
    ok?: boolean;
    staff?: Array<Record<string, unknown>>;
  };
  listEl.dataset.loading = "false";
  if (!response.ok || !body.ok) {
    listEl.innerHTML = `<p class="empty-state" role="alert">Could not refresh employees.</p>`;
    return;
  }

  const staff = body.staff ?? [];
  if (staff.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No employees yet. Add someone to invite them to the team app.";
    listEl.replaceChildren(empty);
    if (filterEmptyEl) filterEmptyEl.hidden = true;
    return;
  }

  const rows = staff.map((member) => {
    const statusRaw = String(member.accessStatus ?? "uninvited");
    const status = isAccessStatus(statusRaw) ? statusRaw : "uninvited";
    const button = document.createElement("button");
    button.className = "manage-employees__row";
    button.type = "button";
    button.dataset.employeeRow = "";
    button.dataset.employeeId = String(member.id ?? "");
    button.dataset.accessStatus = status;
    const initials = document.createElement("span");
    initials.className = "manage-employees__initials";
    initials.setAttribute("aria-hidden", "true");
    initials.textContent = String(member.name ?? "").split(/\s+/)
      .map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
    const copy = document.createElement("span");
    copy.className = "manage-employees__copy";
    const name = document.createElement("span");
    name.className = "manage-employees__name";
    name.textContent = String(member.name ?? "");
    const meta = document.createElement("span");
    meta.className = "manage-employees__meta";
    const role = String(member.role ?? "");
    meta.textContent = ROLE_LABELS[role] ?? role;
    copy.append(name, meta);
    const badge = document.createElement("span");
    badge.className = badgeClassFor(status);
    badge.textContent = ACCESS_STATUS_LABELS[status];
    button.append(initials, copy, badge);
    return button;
  });
  listEl.replaceChildren(...rows);
  bindRowClicks();
  applyFilter();
}

function bindRowClicks() {
  listEl?.querySelectorAll<HTMLButtonElement>("[data-employee-row]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.employeeId;
      if (!id) return;
      button.disabled = true;
      try {
        const response = await fetch(`${apiBase}/${id}`);
        const body = (await response.json()) as {
          ok?: boolean;
          staff?: Record<string, unknown>;
          privateDetails?: Record<string, unknown> | null;
        };
        if (!response.ok || !body.ok || !body.staff) {
          showError("Could not load employee");
          return;
        }
        openDialog("edit", body.staff, body.privateDetails ?? null);
      } finally {
        button.disabled = false;
      }
    });
  });
}

filterRoot?.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-access-filter]");
  if (!button) return;
  const id = button.dataset.accessFilter ?? "all";
  setFilter(id === "all" || isAccessStatus(id) ? id : "all");
});

addButton?.addEventListener("click", () => openDialog("create"));
closeButton?.addEventListener("click", () => dialog?.close());
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

form?.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.name !== "name" || editingId) return;
  const slugInput = form.elements.namedItem("slug") as HTMLInputElement;
  slugInput.value = slugifyName(target.value);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form) return;

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  submitButton?.setAttribute("disabled", "true");

  const payload: Record<string, unknown> = {
    name: String((form.elements.namedItem("name") as HTMLInputElement).value).trim(),
    slug: String((form.elements.namedItem("slug") as HTMLInputElement).value).trim(),
    role: String((form.elements.namedItem("role") as HTMLSelectElement).value),
    phone: String((form.elements.namedItem("phone") as HTMLInputElement).value).trim(),
    email: String((form.elements.namedItem("email") as HTMLInputElement).value).trim(),
    bio: String((form.elements.namedItem("bio") as HTMLTextAreaElement).value).trim(),
    startDate: String((form.elements.namedItem("startDate") as HTMLInputElement).value).trim(),
    emergencyContactName: String(
      (form.elements.namedItem("emergencyContactName") as HTMLInputElement).value,
    ).trim(),
    emergencyContactPhone: String(
      (form.elements.namedItem("emergencyContactPhone") as HTMLInputElement).value,
    ).trim(),
  };

  if (bookEnabled) {
    payload.isBookable = (form.elements.namedItem("isBookable") as HTMLInputElement).checked;
    payload.acceptingNewClients = (
      form.elements.namedItem("acceptingNewClients") as HTMLInputElement
    ).checked;
  }

  try {
    const response = await fetch(editingId ? `${apiBase}/${editingId}` : apiBase, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string; staff?: { id: string } };
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? "Could not save employee");
    }

    const staffId = editingId ?? body.staff?.id;
    if (staffId && scheduleSection && !scheduleSection.hidden) {
      await saveSchedules(staffId);
    }

    dialog?.close();
    showSuccess(editingId ? "Employee updated." : "Employee created.");
    await reloadList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not save employee");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

bindRowClicks();

accessActions?.addEventListener("click", async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-access-action]");
  const action = button?.dataset.accessAction as AccessActionId | undefined;
  if (!button || !action || !editingId || button.hidden) return;

  if (action === "deactivate") {
    const confirmed = await confirmDestructive({
      title: "Deactivate this employee?",
      body: "They will lose access to the team app immediately and can’t sign in until you reactivate them. Their profile stays on file.",
      confirmLabel: "Deactivate",
      cancelLabel: "Keep access",
    });
    if (!confirmed) return;
  }

  button.disabled = true;
  const pendingLabel =
    action === "invite"
      ? "Sending invite…"
      : action === "resend"
        ? "Resending invite…"
        : action === "deactivate"
          ? "Deactivating…"
          : "Updating access…";
  showSuccess(pendingLabel);
  try {
    const response = await fetch(`${apiBase}/${editingId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string; accessStatus?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Could not update access");
    const nextStatusRaw = String(body.accessStatus ?? currentAccessStatus);
    const nextStatus = isAccessStatus(nextStatusRaw) ? nextStatusRaw : currentAccessStatus;
    syncAccessUi(nextStatus);
    if (action === "invite" || action === "resend") {
      showSuccess(
        action === "invite"
          ? "Invite sent. They’ll receive an email to set a password."
          : "Invite resent. Ask them to check their inbox (and spam).",
      );
    } else if (action === "deactivate") {
      showSuccess("Employee deactivated. They can no longer sign in.");
    } else {
      showSuccess("Employee reactivated.");
    }
    await reloadList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not update access");
  } finally {
    button.disabled = false;
  }
});
