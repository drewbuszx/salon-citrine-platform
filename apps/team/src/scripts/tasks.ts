import { showToast, friendlyError } from "../lib/toast";
import { tasksSkeletonHtml, errorPanelHtml } from "../lib/ui-states";
import { runGuardedSubmit } from "../lib/submit-guard";

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

type TaskPanelPreview = {
  id: string;
  title: string;
  dueAt: string | null;
  status: string;
  assignmentType: string;
  priority: string;
};

type TaskSummaryCounts = {
  assignedToMe: number;
  openToEveryone: number;
  needsAttention: number;
  dueToday: number;
  completedThisWeek: number;
};

type TaskActivityItem = {
  id: string;
  title: string;
  kind: "completed" | "claimed" | "created";
  at: string;
  byName: string | null;
};

type TaskSummaryPayload = {
  counts: TaskSummaryCounts;
  dueSoon: TaskPanelPreview[];
  openToClaim: TaskPanelPreview[];
  checklistProgress: { active: number; completedThisWeek: number };
  recentActivity: TaskActivityItem[];
};

type SummaryResponse = {
  ok: boolean;
  error?: string;
  summary?: TaskSummaryPayload;
};

type RoutineSlug = "opening" | "closing";

type RoutineItem = {
  id: string;
  label: string;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
  completedByName: string | null;
};

type Routine = {
  id: string;
  slug: RoutineSlug;
  title: string;
  salonDate: string;
  completedCount: number;
  totalCount: number;
  items: RoutineItem[];
};

type RoutinesResponse = {
  ok: boolean;
  error?: string;
  routines?: Routine[];
  routine?: Routine | null;
};

const root = document.querySelector<HTMLElement>("[data-tasks-app]");
if (!root) {
  throw new Error("Tasks app root not found");
}

const apiBase = root.dataset.apiBase ?? "";
const routinesApiBase = root.dataset.routinesApiBase ?? "";
const isManager = root.dataset.manager === "1";
const listEl = root.querySelector<HTMLElement>("[data-tasks-list]");
const errorEl = root.querySelector<HTMLElement>("[data-tasks-error]");
const tabButtons = root.querySelectorAll<HTMLButtonElement>("[data-tasks-nav] [data-view]");
const createBtn = root.querySelector<HTMLButtonElement>("[data-task-create]");
const createChecklistBtn = root.querySelector<HTMLButtonElement>("[data-task-create-checklist]");
const browseOpenBtn = root.querySelector<HTMLButtonElement>("[data-task-browse-open]");
const summaryEl = root.querySelector<HTMLElement>("[data-tasks-summary]");
const panelsEl = root.querySelector<HTMLElement>("[data-tasks-panels]");
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
let routines: Routine[] = [];

function isRoutineView(view: string) {
  return view === "routine-opening" || view === "routine-closing";
}

function routineSlugFromView(view: string): RoutineSlug | null {
  if (view === "routine-opening") return "opening";
  if (view === "routine-closing") return "closing";
  return null;
}

function currentRoutine(): Routine | null {
  const slug = routineSlugFromView(currentView);
  if (!slug) return null;
  return routines.find((routine) => routine.slug === slug) ?? null;
}

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

function renderRoutineChecklist(routine: Routine) {
  const pct =
    routine.totalCount > 0
      ? Math.round((routine.completedCount / routine.totalCount) * 100)
      : 0;
  const lead =
    routine.slug === "opening"
      ? "Shared opening checklist for today — anyone on the team can check items off."
      : "Shared closing checklist for today — anyone on the team can check items off.";

  const items = routine.items
    .map((item) => {
      const completed = formatSalonDayTime(item.completedAt);
      const meta =
        item.completed && item.completedByName && completed
          ? `<p class="routine-item__meta">Checked by ${escapeHtml(item.completedByName)} · ${escapeHtml(completed)}</p>`
          : "";
      return `
        <div class="routine-item${item.completed ? " is-done" : ""}" data-routine-item="${item.id}">
          <button
            class="routine-item__toggle"
            type="button"
            data-routine-toggle="${item.id}"
            aria-pressed="${item.completed ? "true" : "false"}"
            aria-label="${escapeHtml(item.label)}"
          >
            <span class="routine-item__check" aria-hidden="true"></span>
          </button>
          <div class="routine-item__body">
            <p class="routine-item__label">${escapeHtml(item.label)}</p>
            ${meta}
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="routine-checklist" data-routine-slug="${routine.slug}">
      <header class="routine-checklist__header">
        <h2 class="routine-checklist__title">${escapeHtml(routine.title)}</h2>
        <p class="routine-checklist__lead">${lead}</p>
        <div class="routine-checklist__progress" aria-live="polite">
          <span>${routine.completedCount} of ${routine.totalCount} complete</span>
          <div class="routine-checklist__progress-bar" role="presentation">
            <span class="routine-checklist__progress-fill" style="width: ${pct}%"></span>
          </div>
        </div>
      </header>
      ${items}
    </div>`;
}

function updateRoutineProgressUi() {
  for (const routine of routines) {
    const progressEl = root.querySelector<HTMLElement>(
      `[data-routine-progress="${routine.slug}"]`,
    );
    if (progressEl) {
      const complete = routine.completedCount === routine.totalCount && routine.totalCount > 0;
      progressEl.textContent = `${routine.completedCount}/${routine.totalCount} today`;
      progressEl.classList.toggle("is-complete", complete);
    }

    const badge = root.querySelector<HTMLElement>(`[data-routine-badge="${routine.slug}"]`);
    if (badge) {
      badge.textContent = `${routine.completedCount}/${routine.totalCount}`;
      badge.hidden = routine.totalCount === 0;
    }
  }

  root.querySelectorAll<HTMLButtonElement>(".tasks-routines__card").forEach((card) => {
    const view = card.dataset.view;
    card.classList.toggle("is-active", Boolean(view && view === currentView));
  });
}

function renderCurrentRoutine() {
  if (!listEl) return;
  clearError();

  const routine = currentRoutine();
  if (!routine) {
    listEl.innerHTML = errorPanelHtml({
      title: "Couldn't load checklist",
      hint: "Try again in a moment.",
      actionLabel: "Try again",
      actionAttr: "data-retry-routine",
    });
    listEl.querySelector<HTMLButtonElement>("[data-retry-routine]")?.addEventListener("click", () => {
      void loadRoutines(true);
    });
    return;
  }

  listEl.innerHTML = renderRoutineChecklist(routine);
  bindRoutineActions();
  updateRoutineProgressUi();
}

async function routinesFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${routinesApiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await response.json()) as RoutinesResponse & Record<string, unknown>;
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body;
}

async function loadRoutines(render = false) {
  try {
    const data = await routinesFetch("");
    routines = data.routines ?? [];
    updateRoutineProgressUi();
    if (render && isRoutineView(currentView)) {
      renderCurrentRoutine();
    }
  } catch (error) {
    console.error("salon routines load failed", error);
    if (render && isRoutineView(currentView)) {
      if (!listEl) return;
      listEl.innerHTML = errorPanelHtml({
        title: "Couldn't load checklist",
        hint: friendlyError(error, "Try again in a moment."),
        actionLabel: "Try again",
        actionAttr: "data-retry-routine",
      });
      listEl.querySelector<HTMLButtonElement>("[data-retry-routine]")?.addEventListener("click", () => {
        void loadRoutines(true);
      });
    }
  }
}

async function toggleRoutineItem(itemId: string, completed: boolean) {
  const routine = currentRoutine();
  if (!routine) return;

  const button = listEl?.querySelector<HTMLButtonElement>(`[data-routine-toggle="${itemId}"]`);
  if (button) button.disabled = true;

  try {
    const data = await routinesFetch(`/${routine.slug}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
    routines = data.routines ?? routines;
    renderCurrentRoutine();
  } catch (error) {
    showError(friendlyError(error, "Couldn't update checklist item"));
    showToast(friendlyError(error, "Couldn't update checklist item"), "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function bindRoutineActions() {
  listEl?.querySelectorAll<HTMLButtonElement>("[data-routine-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.dataset.routineToggle;
      if (!itemId) return;
      const pressed = button.getAttribute("aria-pressed") === "true";
      void toggleRoutineItem(itemId, !pressed);
    });
  });
}

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
      hint: "Use Create task to assign salon checklists.",
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
    ? `<button class="ui-btn ui-btn--primary ui-btn--compact" type="button" data-view-jump="${cta.view}">${escapeHtml(cta.label)}</button>`
    : "";
  return `<div class="ui-empty ui-empty--compact tasks-empty" role="status">
    <span class="ui-empty__icon" aria-hidden="true">☑</span>
    <p class="ui-empty__title">${escapeHtml(title)}</p>
    <p class="ui-empty__hint">${escapeHtml(hint)}</p>
    ${action ? `<div class="ui-empty__actions">${action}</div>` : ""}
  </div>`;
}

function updateAttentionBadge(count: number) {
  root.querySelectorAll<HTMLElement>("[data-attention-badge]").forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = count <= 0;
    badge.setAttribute(
      "aria-label",
      count > 0 ? `${count} tasks need attention` : "Tasks needing attention",
    );
  });
}

function renderSummaryCounts(counts: TaskSummaryCounts) {
  const assigned = root.querySelector<HTMLElement>("[data-summary-assigned]");
  const open = root.querySelector<HTMLElement>("[data-summary-open]");
  const attention = root.querySelector<HTMLElement>("[data-summary-attention]");
  const dueToday = root.querySelector<HTMLElement>("[data-summary-due-today]");
  const completedWeek = root.querySelector<HTMLElement>("[data-summary-completed-week]");

  if (assigned) assigned.textContent = String(counts.assignedToMe);
  if (open) open.textContent = String(counts.openToEveryone);
  if (attention) attention.textContent = String(counts.needsAttention);
  if (dueToday) dueToday.textContent = String(counts.dueToday);
  if (completedWeek) completedWeek.textContent = String(counts.completedThisWeek);

  if (summaryEl) {
    summaryEl.hidden = false;
  }
}

function panelDueLabel(dueAt: string | null) {
  if (!dueAt) return "No due date";
  const label = formatDueDate(dueAt);
  return label ? `Due ${label}` : "Due date set";
}

function renderPanelList(
  listEl: HTMLElement | null,
  panelEl: HTMLElement | null,
  items: TaskPanelPreview[],
  emptyLabel: string,
  metaFn: (item: TaskPanelPreview) => string,
) {
  if (!listEl || !panelEl) return;

  if (items.length === 0) {
    panelEl.hidden = true;
    listEl.innerHTML = "";
    return;
  }

  panelEl.hidden = false;
  listEl.innerHTML = items
    .map(
      (item) => `<li class="tasks-panel__item">
        <p class="tasks-panel__item-title">${escapeHtml(item.title)}</p>
        <p class="tasks-panel__item-meta">${escapeHtml(metaFn(item))}</p>
      </li>`,
    )
    .join("");
}

function activityLabel(item: TaskActivityItem) {
  const when = formatSalonDayTime(item.at) ?? "recently";
  if (item.kind === "completed") {
    return item.byName ? `Done by ${item.byName} · ${when}` : `Completed · ${when}`;
  }
  if (item.kind === "claimed") {
    return item.byName ? `Claimed by ${item.byName} · ${when}` : `Claimed · ${when}`;
  }
  return item.byName ? `Added by ${item.byName} · ${when}` : `Created · ${when}`;
}

function renderSummaryPanels(summary: TaskSummaryPayload) {
  renderPanelList(
    root.querySelector<HTMLElement>("[data-panel-due-soon-list]"),
    root.querySelector<HTMLElement>("[data-panel-due-soon]"),
    summary.dueSoon,
    "Nothing due in the next week.",
    (item) => panelDueLabel(item.dueAt),
  );

  renderPanelList(
    root.querySelector<HTMLElement>("[data-panel-open-claim-list]"),
    root.querySelector<HTMLElement>("[data-panel-open-claim]"),
    summary.openToClaim,
    "No open tasks right now.",
    () => "Available to claim",
  );

  const checklistPanel = root.querySelector<HTMLElement>("[data-panel-checklist]");
  const checklistBody = root.querySelector<HTMLElement>("[data-panel-checklist-body]");
  const { active, completedThisWeek } = summary.checklistProgress;
  const total = active + completedThisWeek;
  const pct = total > 0 ? Math.round((completedThisWeek / total) * 100) : 0;

  if (checklistPanel && checklistBody) {
    if (total === 0) {
      checklistPanel.hidden = true;
      checklistBody.innerHTML = "";
    } else {
      checklistPanel.hidden = false;
      checklistBody.innerHTML = `
        <div class="tasks-panel__progress-row">
          <span>${completedThisWeek} done this week</span>
          <span>${active} still active</span>
        </div>
        <div class="tasks-panel__progress-bar" role="presentation">
          <span class="tasks-panel__progress-fill" style="width: ${pct}%"></span>
        </div>`;
    }
  }

  const activityPanel = root.querySelector<HTMLElement>("[data-panel-activity]");
  const activityList = root.querySelector<HTMLElement>("[data-panel-activity-list]");
  if (activityPanel && activityList) {
    if (summary.recentActivity.length === 0) {
      activityPanel.hidden = true;
      activityList.innerHTML = "";
    } else {
      activityPanel.hidden = false;
      activityList.innerHTML = summary.recentActivity
        .map(
          (item) => `<li class="tasks-panel__item">
            <p class="tasks-panel__item-title">${escapeHtml(item.title)}</p>
            <p class="tasks-panel__item-meta">${escapeHtml(activityLabel(item))}</p>
          </li>`,
        )
        .join("");
    }
  }

  if (panelsEl) {
    const anyVisible = Boolean(
      summary.dueSoon.length ||
        summary.openToClaim.length ||
        total > 0 ||
        summary.recentActivity.length,
    );
    panelsEl.hidden = !anyVisible;
  }
}

async function loadSummary() {
  try {
    const data = (await apiFetch("/summary")) as SummaryResponse;
    if (!data.summary) return;
    renderSummaryCounts(data.summary.counts);
    renderSummaryPanels(data.summary);
    updateAttentionBadge(data.summary.counts.needsAttention);
  } catch (error) {
    console.error("task summary load failed", error);
  }
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
  listEl.innerHTML = tasksSkeletonHtml(4);
  listEl.setAttribute("aria-busy", "true");

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
    const message = friendlyError(error, "Couldn't load tasks");
    listEl.innerHTML = errorPanelHtml({
      title: "Couldn't load tasks",
      hint: message,
      actionLabel: "Try again",
      actionAttr: "data-retry-load",
    });
    listEl.querySelector<HTMLButtonElement>("[data-retry-load]")?.addEventListener("click", () => {
      void loadTasks();
    });
    showError(message);
  } finally {
    listEl.removeAttribute("aria-busy");
  }
}

function setActiveTab(view: string) {
  currentView = view;
  tabButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (isRoutineView(view)) {
    if (summaryEl) summaryEl.hidden = true;
    if (panelsEl) panelsEl.hidden = true;

    if (routines.length > 0) {
      renderCurrentRoutine();
    } else {
      if (listEl) {
        listEl.innerHTML = tasksSkeletonHtml(6);
        listEl.setAttribute("aria-busy", "true");
      }
      void loadRoutines(true).finally(() => {
        listEl?.removeAttribute("aria-busy");
      });
    }
    return;
  }

  void loadTasks();
  void loadSummary();
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

function openCreateModal(mode: "task" | "checklist" = "task") {
  resetTaskForm();
  if (taskModalTitle) {
    taskModalTitle.textContent = mode === "checklist" ? "New checklist" : "New task";
  }
  if (mode === "checklist" && taskForm) {
    const openRadio = taskForm.querySelector<HTMLInputElement>(
      'input[name="assignment_type"][value="open"]',
    );
    if (openRadio) openRadio.checked = true;
    updateAssigneePickerVisibility();
  }
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

  const submitBtn = taskForm.querySelector<HTMLButtonElement>('button[type="submit"]');
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
  await runGuardedSubmit(async () => {
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
      await Promise.all([loadTasks(), loadSummary()]);
    } catch (error) {
      showError(friendlyError(error, "Failed to save task"));
      showToast(friendlyError(error, "Failed to save task"), "error");
    }
  }, { button: submitBtn, busyLabel: wasEditing ? "Saving…" : "Adding…" });
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
    await Promise.all([loadTasks(), loadSummary()]);
  } catch (error) {
    showError(friendlyError(error, "Failed to complete task"));
  }
}

async function claimTask(taskId: string) {
  try {
    await apiFetch(`/${taskId}/claim`, { method: "POST", body: "{}" });
    showToast("It's yours — moved to Assigned to me.", "success");
    setActiveTab("my");
    void loadSummary();
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
    await Promise.all([loadTasks(), loadSummary()]);
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

root.querySelectorAll<HTMLButtonElement>("[data-tasks-routines] [data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view) setActiveTab(view);
  });
});

createBtn?.addEventListener("click", () => openCreateModal("task"));

createChecklistBtn?.addEventListener("click", () => openCreateModal("checklist"));

browseOpenBtn?.addEventListener("click", () => setActiveTab("available"));

root.querySelectorAll<HTMLButtonElement>("[data-summary-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.summaryView;
    if (view) setActiveTab(view);
  });
});

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
void loadRoutines();
