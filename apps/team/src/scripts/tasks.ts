import { showToast, friendlyError } from "../lib/toast";

type TaskAssignee = {
  staffId: string;
  staffName: string;
  claimedAt: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignmentType: "assigned" | "open";
  createdByName: string | null;
  dueAt: string | null;
  priority: "low" | "normal" | "high";
  completedAt: string | null;
  completedByName: string | null;
  completionNotes: string | null;
  assignees: TaskAssignee[];
  canClaim: boolean;
  canComplete: boolean;
};

type TasksResponse = {
  ok: boolean;
  error?: string;
  tasks?: Task[];
  attentionCount?: number;
};

const root = document.querySelector<HTMLElement>("[data-tasks-app]");
if (!root) {
  throw new Error("Tasks app root not found");
}

const apiBase = root.dataset.apiBase ?? "";
const isManager = root.dataset.manager === "1";
const listEl = root.querySelector<HTMLElement>("[data-tasks-list]");
const errorEl = root.querySelector<HTMLElement>("[data-tasks-error]");
const tabButtons = root.querySelectorAll<HTMLButtonElement>("[data-view]");
const attentionBadge = root.querySelector<HTMLElement>("[data-attention-badge]");
const createBtn = root.querySelector<HTMLButtonElement>("[data-task-create]");
const taskModal = document.querySelector<HTMLDialogElement>("[data-task-modal]");
const taskForm = document.querySelector<HTMLFormElement>("[data-task-form]");
const taskModalTitle = document.querySelector<HTMLElement>("[data-task-modal-title]");
const assigneePicker = document.querySelector<HTMLElement>("[data-assignee-picker]");
const completeModal = document.querySelector<HTMLDialogElement>("[data-complete-modal]");
const completeForm = document.querySelector<HTMLFormElement>("[data-complete-form]");
const completeTaskTitle = document.querySelector<HTMLElement>("[data-complete-task-title]");

let currentView = "my";
let editingTaskId: string | null = null;
let completingTaskId: string | null = null;

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

/** Every task time is shown in salon time, not the viewer's device timezone. */
const SALON_TZ = "America/Indiana/Indianapolis";

function salonDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function salonClock(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "today 5:00 PM", "tomorrow 9:00 AM", or "Jul 12, 9:00 AM" in salon time. */
function formatSalonDayTime(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const key = salonDayKey(date);
  if (key === salonDayKey(now)) {
    return `today ${salonClock(date)}`;
  }
  if (key === salonDayKey(new Date(now.getTime() + 86_400_000))) {
    return `tomorrow ${salonClock(date)}`;
  }
  if (key === salonDayKey(new Date(now.getTime() - 86_400_000))) {
    return `yesterday ${salonClock(date)}`;
  }
  const sameYear = key.slice(0, 4) === salonDayKey(now).slice(0, 4);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TZ,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
  return `${day}, ${salonClock(date)}`;
}

function salonOffsetMinutes(date: Date) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Interpret a datetime-local value ("YYYY-MM-DDTHH:mm") as salon wall-clock time. */
function salonInputToIso(local: string) {
  const asUtc = new Date(`${local}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  // Resolve the offset at the target instant (handles DST transitions).
  const offset = salonOffsetMinutes(
    new Date(asUtc.getTime() - salonOffsetMinutes(asUtc) * 60_000),
  );
  return new Date(asUtc.getTime() - offset * 60_000).toISOString();
}

/** Format a stored ISO timestamp as a datetime-local value in salon time. */
function isoToSalonInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const formatDueDate = formatSalonDayTime;
const formatCompletedDate = formatSalonDayTime;

/** One coherent assignment line: who owns this task right now. */
function assignmentLine(task: Task) {
  const claimer = task.assignees.find((a) => a.claimedAt);
  if (claimer) {
    const when = formatSalonDayTime(claimer.claimedAt);
    return when
      ? `Claimed by ${claimer.staffName} · ${when}`
      : `Claimed by ${claimer.staffName}`;
  }
  if (task.assignees.length > 0) {
    return `Assigned to ${task.assignees.map((a) => a.staffName).join(", ")}`;
  }
  if (task.assignmentType === "open") {
    return "Open to team — first to claim it owns it";
  }
  return "Unassigned";
}

const ATTENTION_MS = 24 * 60 * 60 * 1000;

function priorityBadge(priority: Task["priority"]) {
  if (priority === "high") {
    return '<span class="task-badge task-badge--high">High</span>';
  }
  if (priority === "low") {
    return '<span class="task-badge task-badge--low">Low</span>';
  }
  return "";
}

function statusBadge(task: Task) {
  if (task.status === "done") {
    return '<span class="task-badge task-badge--done">Done</span>';
  }
  if (task.status === "cancelled") {
    return '<span class="task-badge task-badge--muted">Cancelled</span>';
  }
  if (task.status === "open" && task.assignmentType === "open") {
    return '<span class="task-badge task-badge--open">Available</span>';
  }
  if (task.status === "claimed") {
    return '<span class="task-badge task-badge--claimed">Claimed</span>';
  }
  return "";
}

function dueBadge(task: Task) {
  if (!task.dueAt || task.status === "done" || task.status === "cancelled") {
    return "";
  }
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return "";

  const diff = due.getTime() - Date.now();
  const label = formatDueDate(task.dueAt);
  if (!label) return "";

  let state = "task-due--normal";
  let prefix = "Due";
  if (diff < 0) {
    state = "task-due--overdue";
    prefix = "Overdue ·";
  } else if (diff <= ATTENTION_MS) {
    state = "task-due--soon";
    prefix = "Due";
  }

  return `<span class="task-due ${state}">${prefix} ${escapeHtml(label)}</span>`;
}

function renderTaskActions(task: Task) {
  const primary: string[] = [];
  const secondary: string[] = [];

  if (task.canClaim) {
    primary.push(
      `<button class="task-action task-action--primary" type="button" data-task-claim="${task.id}">Claim</button>`,
    );
  }

  if (task.canComplete) {
    primary.push(
      `<button class="task-action task-action--primary" type="button" data-task-complete="${task.id}">Complete</button>`,
    );
  }

  if (isManager && task.status !== "done" && task.status !== "cancelled") {
    secondary.push(
      `<button class="task-action task-action--ghost" type="button" data-task-edit="${task.id}">Edit</button>`,
      `<button class="task-action task-action--danger" type="button" data-task-cancel="${task.id}">Cancel</button>`,
    );
  }

  if (primary.length === 0 && secondary.length === 0) {
    return "";
  }

  return `<div class="notebook-entry__actions">${primary.join("")}${secondary.join("")}</div>`;
}

function entryClasses(task: Task) {
  const classes = ["notebook-entry"];
  if (task.status === "done") {
    classes.push("is-done");
  } else if (task.status !== "cancelled") {
    classes.push("is-active");
  }
  if (task.priority === "high") classes.push("is-high");
  if (task.priority === "low") classes.push("is-low");
  return classes.join(" ");
}

function renderTaskCard(task: Task) {
  const completed = formatCompletedDate(task.completedAt);
  const description = task.description
    ? `<p class="notebook-entry__description">${escapeHtml(task.description)}</p>`
    : "";

  const metaParts: string[] = [];
  // On finished tasks, skip the assignment line when it would just repeat
  // the "Completed by" attribution.
  const soleOwner =
    task.assignees.length === 1 ? task.assignees[0].staffName : null;
  const redundantOwner =
    task.status === "done" && soleOwner !== null && soleOwner === task.completedByName;
  if (!redundantOwner) {
    metaParts.push(`<span>${escapeHtml(assignmentLine(task))}</span>`);
  }
  if (task.createdByName && task.status !== "done" && task.status !== "cancelled") {
    metaParts.push(`<span>Added by ${escapeHtml(task.createdByName)}</span>`);
  }
  if (completed && task.completedByName) {
    metaParts.push(
      `<span>Completed by ${escapeHtml(task.completedByName)} · ${escapeHtml(completed)}</span>`,
    );
  } else if (completed) {
    metaParts.push(`<span>Completed ${escapeHtml(completed)}</span>`);
  }
  if (task.completionNotes) {
    metaParts.push(`<span>Note: ${escapeHtml(task.completionNotes)}</span>`);
  }

  // Priority and status read as labels; due date is pulled out as a
  // prominent, colour-coded chip so overdue/soon work jumps out when scanning.
  const tags = `${priorityBadge(task.priority)}${statusBadge(task)}${dueBadge(task)}`;
  const tagRow = tags ? `<div class="notebook-entry__tags">${tags}</div>` : "";

  return `
    <article class="${entryClasses(task)}" data-task-id="${task.id}">
      <div class="notebook-entry__row">
        <span class="notebook-entry__check" aria-hidden="true"></span>
        <div class="notebook-entry__body">
          <div class="notebook-entry__main">
            <h3 class="notebook-entry__title">${escapeHtml(task.title)}</h3>
            ${tagRow}
          </div>
          ${description}
          <div class="notebook-entry__meta">${metaParts.join("")}</div>
          ${renderTaskActions(task)}
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type EmptyState = {
  title: string;
  hint: string;
  cta?: { label: string; view: string };
};

function emptyStateContent(view: string): EmptyState {
  const states: Record<string, EmptyState> = {
    available: {
      title: "No team-wide tasks",
      hint: "Open tasks anyone can claim will show up here.",
    },
    attention: {
      title: "All caught up",
      hint: "Nothing is due or overdue in the next 24 hours.",
    },
    completed: {
      title: "No completed tasks",
      hint: "Finished to-dos appear here with who marked them done.",
    },
    all: {
      title: "No active tasks",
      hint: "Use New entry to assign salon checklists.",
    },
    my: {
      title: "Nothing assigned to you",
      hint: "Pick up an open task the whole team can grab.",
      cta: { label: "Browse open tasks", view: "available" },
    },
  };

  return states[view] ?? states.my;
}

function renderEmptyState(view: string) {
  const { title, hint, cta } = emptyStateContent(view);
  const action = cta
    ? `<button class="task-action task-action--primary notebook-empty__cta" type="button" data-view-jump="${cta.view}">${escapeHtml(cta.label)}</button>`
    : "";
  return `<div class="notebook-empty notebook-empty--filter" role="status">
    <p class="notebook-empty__title">${escapeHtml(title)}</p>
    <p class="notebook-empty__hint">${escapeHtml(hint)}</p>
    ${action}
  </div>`;
}

function updateAttentionBadge(count: number) {
  if (!attentionBadge) return;
  attentionBadge.textContent = String(count);
  attentionBadge.hidden = count <= 0;
  attentionBadge.setAttribute(
    "aria-label",
    count > 0 ? `${count} tasks need attention` : "Tasks needing attention",
  );
}

async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await response.json()) as TasksResponse & Record<string, unknown>;
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body;
}

async function loadTasks() {
  if (!listEl) return;
  clearError();
  listEl.innerHTML = '<p class="notebook-empty">Loading tasks…</p>';

  try {
    const data = await apiFetch(`?view=${encodeURIComponent(currentView)}`);
    const tasks = data.tasks ?? [];
    updateAttentionBadge(data.attentionCount ?? 0);

    if (tasks.length === 0) {
      listEl.innerHTML = renderEmptyState(currentView);
      bindViewJump();
      return;
    }

    listEl.innerHTML = tasks.map(renderTaskCard).join("");
    bindTaskActions();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tasks";
    listEl.innerHTML = `<p class="notebook-empty">${escapeHtml(message)}</p>`;
    showError(message);
  }
}

function setActiveTab(view: string) {
  currentView = view;
  tabButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  void loadTasks();
}

function updateAssigneePickerVisibility() {
  if (!assigneePicker || !taskForm) return;
  const selected = taskForm.querySelector<HTMLInputElement>(
    'input[name="assignment_type"]:checked',
  );
  assigneePicker.hidden = selected?.value !== "assigned";
}

function resetTaskForm() {
  if (!taskForm) return;
  taskForm.reset();
  editingTaskId = null;
  if (taskModalTitle) {
    taskModalTitle.textContent = "New entry";
  }
  updateAssigneePickerVisibility();
}

function openCreateModal() {
  resetTaskForm();
  taskModal?.showModal();
}

async function openEditModal(taskId: string) {
  try {
    const data = await apiFetch(`?view=all`);
    const task = (data.tasks ?? []).find((item) => item.id === taskId);
    if (!task || !taskForm) {
      throw new Error("Task not found");
    }

    editingTaskId = taskId;
    if (taskModalTitle) {
      taskModalTitle.textContent = "Edit entry";
    }

    const titleInput = taskForm.querySelector<HTMLInputElement>('input[name="title"]');
    const descriptionInput = taskForm.querySelector<HTMLTextAreaElement>(
      'textarea[name="description"]',
    );
    const dueInput = taskForm.querySelector<HTMLInputElement>('input[name="due_at"]');
    const prioritySelect = taskForm.querySelector<HTMLSelectElement>(
      'select[name="priority"]',
    );

    if (titleInput) titleInput.value = task.title;
    if (descriptionInput) descriptionInput.value = task.description ?? "";
    if (prioritySelect) prioritySelect.value = task.priority;
    if (dueInput) {
      dueInput.value = task.dueAt ? isoToSalonInput(task.dueAt) : "";
    }

    const assignmentValue = task.assignmentType;
    taskForm
      .querySelectorAll<HTMLInputElement>('input[name="assignment_type"]')
      .forEach((input) => {
        input.checked = input.value === assignmentValue;
      });

    taskForm.querySelectorAll<HTMLInputElement>('input[name="assignee_ids"]').forEach((input) => {
      input.checked = task.assignees.some((assignee) => assignee.staffId === input.value);
    });

    updateAssigneePickerVisibility();
    taskModal?.showModal();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to load task");
  }
}

async function submitTaskForm(event: Event) {
  event.preventDefault();
  if (!taskForm) return;

  const formData = new FormData(taskForm);
  const assignmentType = String(formData.get("assignment_type") ?? "open");
  const assigneeIds = formData
    .getAll("assignee_ids")
    .map(String)
    .filter(Boolean);

  const dueLocal = String(formData.get("due_at") ?? "").trim();
  const payload = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    due_at: dueLocal ? salonInputToIso(dueLocal) : null,
    priority: String(formData.get("priority") ?? "normal"),
    assignment_type: assignmentType,
    assignee_ids: assignmentType === "assigned" ? assigneeIds : [],
  };

  const wasEditing = Boolean(editingTaskId);
  try {
    if (editingTaskId) {
      await apiFetch(`/${editingTaskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    taskModal?.close();
    resetTaskForm();
    showToast(wasEditing ? "Task updated." : "Task added to the list.", "success");
    await loadTasks();
  } catch (error) {
    showError(friendlyError(error, "Failed to save task"));
  }
}

function openCompleteModal(taskId: string, title: string) {
  completingTaskId = taskId;
  if (completeTaskTitle) {
    completeTaskTitle.textContent = title;
  }
  completeForm?.reset();
  completeModal?.showModal();
}

async function submitCompleteForm(event: Event) {
  event.preventDefault();
  if (!completeForm || !completingTaskId) return;

  const formData = new FormData(completeForm);
  const completionNotes = String(formData.get("completion_notes") ?? "").trim();

  try {
    await apiFetch(`/${completingTaskId}/complete`, {
      method: "POST",
      body: JSON.stringify({ completion_notes: completionNotes || undefined }),
    });
    completeModal?.close();
    completingTaskId = null;
    showToast("Nice work — marked done.", "success");
    await loadTasks();
  } catch (error) {
    showError(friendlyError(error, "Failed to complete task"));
  }
}

async function claimTask(taskId: string) {
  try {
    await apiFetch(`/${taskId}/claim`, { method: "POST", body: "{}" });
    showToast("It's yours — moved to Assigned to me.", "success");
    setActiveTab("my");
  } catch (error) {
    showError(friendlyError(error, "Failed to claim task"));
  }
}

async function cancelTask(taskId: string, title: string) {
  const confirmed = window.confirm(
    `Cancel "${title}"?\n\n` +
      "Cancelling takes it off the list without marking it done. " +
      "If the work got finished, use Complete instead so it's on the record.",
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/${taskId}?cancel=1`, { method: "DELETE" });
    showToast("Task cancelled — no completion recorded.", "info");
    await loadTasks();
  } catch (error) {
    showError(friendlyError(error, "Failed to cancel task"));
  }
}

function bindTaskActions() {
  listEl?.querySelectorAll<HTMLButtonElement>("[data-task-claim]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskClaim;
      if (taskId) void claimTask(taskId);
    });
  });

  listEl?.querySelectorAll<HTMLButtonElement>("[data-task-complete]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskComplete;
      const card = button.closest<HTMLElement>("[data-task-id]");
      const title = card?.querySelector(".notebook-entry__title")?.textContent ?? "Task";
      if (taskId) openCompleteModal(taskId, title);
    });
  });

  listEl?.querySelectorAll<HTMLButtonElement>("[data-task-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskEdit;
      if (taskId) void openEditModal(taskId);
    });
  });

  listEl?.querySelectorAll<HTMLButtonElement>("[data-task-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskCancel;
      const card = button.closest<HTMLElement>("[data-task-id]");
      const title = card?.querySelector(".notebook-entry__title")?.textContent ?? "this task";
      if (taskId) void cancelTask(taskId, title);
    });
  });
}

function bindViewJump() {
  listEl?.querySelectorAll<HTMLButtonElement>("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.viewJump;
      if (view) setActiveTab(view);
    });
  });
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view) setActiveTab(view);
  });
});

createBtn?.addEventListener("click", openCreateModal);

taskForm?.querySelectorAll('input[name="assignment_type"]').forEach((input) => {
  input.addEventListener("change", updateAssigneePickerVisibility);
});

taskForm?.addEventListener("submit", (event) => {
  void submitTaskForm(event);
});

document.querySelectorAll("[data-task-modal-close]").forEach((button) => {
  button.addEventListener("click", () => taskModal?.close());
});

completeForm?.addEventListener("submit", (event) => {
  void submitCompleteForm(event);
});

document.querySelectorAll("[data-complete-modal-close]").forEach((button) => {
  button.addEventListener("click", () => completeModal?.close());
});

void loadTasks();
