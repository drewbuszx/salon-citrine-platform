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
const schedulesEnabled = Boolean(schedulesApi);
const listEl = root?.querySelector<HTMLElement>("[data-employee-list]");
const dialog = root?.querySelector<HTMLDialogElement>("[data-employee-dialog]");
const form = root?.querySelector<HTMLFormElement>("[data-employee-form]");
const successEl = root?.querySelector<HTMLElement>("[data-employees-success]");
const errorEl = root?.querySelector<HTMLElement>("[data-employees-error]");
const addButton = root?.querySelector<HTMLButtonElement>("[data-add-employee]");
const closeButton = root?.querySelector<HTMLButtonElement>("[data-close-dialog]");
const formTitle = root?.querySelector<HTMLElement>("[data-employee-form-title]");
const idInput = root?.querySelector<HTMLInputElement>("[data-employee-id]");
const linkStatus = root?.querySelector<HTMLElement>("[data-link-status]");
const scheduleSection = root?.querySelector<HTMLElement>("[data-schedule-section]");
const scheduleGrid = root?.querySelector<HTMLElement>("[data-schedule-grid]");
const accessActions = root?.querySelector<HTMLElement>("[data-access-actions]");

let editingId: string | null = null;

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
    (form.elements.namedItem("isBookable") as HTMLInputElement).checked = staff.isBookable !== false;
    (form.elements.namedItem("acceptingNewClients") as HTMLInputElement).checked =
      staff.acceptingNewClients !== false;
    (form.elements.namedItem("startDate") as HTMLInputElement).value = String(staff.startDate ?? "");
    (form.elements.namedItem("emergencyContactName") as HTMLInputElement).value = String(
      privateDetails?.emergency_contact_name ?? "",
    );
    (form.elements.namedItem("emergencyContactPhone") as HTMLInputElement).value = String(
      privateDetails?.emergency_contact_phone ?? "",
    );
    if (idInput) idInput.value = String(staff.id ?? "");
    if (linkStatus) {
      linkStatus.hidden = false;
      linkStatus.textContent = `Access status: ${String(staff.accessStatus ?? "uninvited")}.`;
    }
    if (scheduleSection) scheduleSection.hidden = !schedulesEnabled;
    if (accessActions) accessActions.hidden = false;
    if (schedulesEnabled) {
      void loadSchedules(String(staff.id)).catch(() => renderScheduleGrid([]));
    }
  } else {
    if (idInput) idInput.value = "";
    if (linkStatus) linkStatus.hidden = true;
    if (scheduleSection) scheduleSection.hidden = true;
    if (accessActions) accessActions.hidden = true;
    renderScheduleGrid([]);
  }

  dialog.showModal();
}

async function reloadList() {
  const response = await fetch(apiBase);
  const body = (await response.json()) as {
    ok?: boolean;
    staff?: Array<Record<string, unknown>>;
  };
  if (!response.ok || !body.ok || !listEl) return;

  const staff = body.staff ?? [];
  if (staff.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No employees yet.";
    listEl.replaceChildren(empty);
    return;
  }

  const rows = staff.map((member) => {
    const inactive = member.isBookable === false;
    const button = document.createElement("button");
    button.className = "manage-employees__row";
    button.type = "button";
    button.dataset.employeeRow = "";
    button.dataset.employeeId = String(member.id ?? "");
    const initials = document.createElement("span");
    initials.className = "manage-employees__initials";
    initials.textContent = String(member.name ?? "").split(/\s+/)
      .map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
    const copy = document.createElement("span");
    copy.className = "manage-employees__copy";
    const name = document.createElement("span");
    name.className = "manage-employees__name";
    name.textContent = String(member.name ?? "");
    const meta = document.createElement("span");
    meta.className = "manage-employees__meta";
    meta.textContent = `${String(member.role ?? "")}${inactive ? " · Inactive" : ""} · ${String(member.accessStatus ?? "uninvited")}`;
    copy.append(name, meta);
    button.append(initials, copy);
    if (inactive) {
      const badge = document.createElement("span");
      badge.className = "ui-badge ui-badge--info";
      badge.textContent = "Inactive";
      button.append(badge);
    }
    return button;
  });
  listEl.replaceChildren(...rows);

  bindRowClicks();
}

function bindRowClicks() {
  listEl?.querySelectorAll<HTMLButtonElement>("[data-employee-row]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.employeeId;
      if (!id) return;
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
    });
  });
}

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

  const payload = {
    name: String((form.elements.namedItem("name") as HTMLInputElement).value).trim(),
    slug: String((form.elements.namedItem("slug") as HTMLInputElement).value).trim(),
    role: String((form.elements.namedItem("role") as HTMLSelectElement).value),
    phone: String((form.elements.namedItem("phone") as HTMLInputElement).value).trim(),
    email: String((form.elements.namedItem("email") as HTMLInputElement).value).trim(),
    bio: String((form.elements.namedItem("bio") as HTMLTextAreaElement).value).trim(),
    isBookable: (form.elements.namedItem("isBookable") as HTMLInputElement).checked,
    acceptingNewClients: (form.elements.namedItem("acceptingNewClients") as HTMLInputElement).checked,
    startDate: String((form.elements.namedItem("startDate") as HTMLInputElement).value).trim(),
    emergencyContactName: String(
      (form.elements.namedItem("emergencyContactName") as HTMLInputElement).value,
    ).trim(),
    emergencyContactPhone: String(
      (form.elements.namedItem("emergencyContactPhone") as HTMLInputElement).value,
    ).trim(),
  };

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
  const action = button?.dataset.accessAction;
  if (!button || !action || !editingId) return;
  button.disabled = true;
  showSuccess(`${action === "deactivate" ? "Deactivating" : "Updating"} access…`);
  try {
    const response = await fetch(`${apiBase}/${editingId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string; accessStatus?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Could not update access");
    if (linkStatus) linkStatus.textContent = `Access status: ${body.accessStatus ?? "updated"}.`;
    showSuccess("Employee access updated.");
    await reloadList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not update access");
  } finally {
    button.disabled = false;
  }
});
