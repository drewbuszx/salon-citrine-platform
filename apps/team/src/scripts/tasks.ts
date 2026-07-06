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

function formatDueDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCompletedDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function assigneeLabel(task: Task) {
  if (task.assignmentType === "open" && task.assignees.length === 0) {
    return "Open to team";
  }
  if (task.assignees.length === 0) {
    return "Unassigned";
  }
  return task.assignees.map((a) => a.staffName).join(", ");
}

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
  if (task.status === "open" && task.assignmentType === "open") {
    return '<span class="task-badge task-badge--open">Available</span>';
  }
  if (task.status === "claimed") {
    return '<span class="task-badge">Claimed</span>';
  }
  if (task.status === "done") {
    return '<span class="task-badge">Done</span>';
  }
  if (task.status === "cancelled") {
    return '<span class="task-badge">Cancelled</span>';
  }
  return "";
}

function renderTaskActions(task: Task) {
  const actions: string[] = [];

  if (task.canClaim) {
    actions.push(
      `<button class="btn-primary" type="button" data-task-claim="${task.id}">Claim</button>`,
    );
  }

  if (task.canComplete) {
    actions.push(
      `<button class="btn-primary" type="button" data-task-complete="${task.id}">Complete</button>`,
    );
  }

  if (isManager && task.status !== "done" && task.status !== "cancelled") {
    actions.push(
      `<button class="btn-secondary" type="button" data-task-edit="${task.id}">Edit</button>`,
      `<button class="btn-secondary" type="button" data-task-cancel="${task.id}">Cancel</button>`,
    );
  }

  if (actions.length === 0) {
    return "";
  }

  return `<div class="notebook-entry__actions">${actions.join("")}</div>`;
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
  const due = formatDueDate(task.dueAt);
  const completed = formatCompletedDate(task.completedAt);
  const description = task.description
    ? `<p class="notebook-entry__description">${escapeHtml(task.description)}</p>`
    : "";

  const metaParts = [`<span>${escapeHtml(assigneeLabel(task))}</span>`];
  const claimedBy = task.assignees.find((a) => a.claimedAt);
  if (claimedBy && task.status !== "done") {
    metaParts.push(`<span>Claimed by ${escapeHtml(claimedBy.staffName)}</span>`);
  }
  if (due) metaParts.push(`<span>Due ${escapeHtml(due)}</span>`);
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

  const badges = `${priorityBadge(task.priority)}${statusBadge(task)}`;
  const tags = badges
    ? `<div class="notebook-entry__tags">${badges}</div>`
    : "";

  return `
    <article class="${entryClasses(task)}" data-task-id="${task.id}">
      <div class="notebook-entry__row">
        <span class="notebook-entry__check" aria-hidden="true"></span>
        <div class="notebook-entry__body">
          <div class="notebook-entry__main">
            <h3 class="notebook-entry__title">${escapeHtml(task.title)}</h3>
            ${tags}
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

function emptyStateContent(view: string) {
  const states: Record<string, { title: string; hint: string }> = {
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
      hint: "Claim a task from For everyone or wait for an assignment.",
    },
  };

  return states[view] ?? states.my;
}

function renderEmptyState(view: string) {
  const { title, hint } = emptyStateContent(view);
  return `<div class="notebook-empty notebook-empty--filter" role="status">
    <p class="notebook-empty__title">${escapeHtml(title)}</p>
    <p class="notebook-empty__hint">${escapeHtml(hint)}</p>
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
    taskModalTitle.textContent = "New task";
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
      taskModalTitle.textContent = "Edit task";
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
    if (dueInput && task.dueAt) {
      const date = new Date(task.dueAt);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
      dueInput.value = local;
    } else if (dueInput) {
      dueInput.value = "";
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

  const payload = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    due_at: String(formData.get("due_at") ?? "").trim() || null,
    priority: String(formData.get("priority") ?? "normal"),
    assignment_type: assignmentType,
    assignee_ids: assignmentType === "assigned" ? assigneeIds : [],
  };

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
    await loadTasks();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to save task");
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
    await loadTasks();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to complete task");
  }
}

async function claimTask(taskId: string) {
  try {
    await apiFetch(`/${taskId}/claim`, { method: "POST", body: "{}" });
    setActiveTab("my");
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to claim task");
  }
}

async function cancelTask(taskId: string) {
  if (!window.confirm("Cancel this task?")) return;

  try {
    await apiFetch(`/${taskId}?cancel=1`, { method: "DELETE" });
    await loadTasks();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to cancel task");
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
      if (taskId) void cancelTask(taskId);
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
