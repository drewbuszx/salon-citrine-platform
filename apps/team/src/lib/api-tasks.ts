import type { SupabaseClient } from "@supabase/supabase-js";
import { isSalonManager } from "./auth";
import {
  addDays,
  dayOfWeek,
  localWallClockToUtc,
  salonLocalDate,
} from "./report-range";
import type { StaffProfile } from "../env.d.ts";

export type TaskStatus = "open" | "claimed" | "done" | "cancelled";
export type TaskAssignmentType = "assigned" | "open";
export type TaskPriority = "low" | "normal" | "high";

export type TaskAssigneeRow = {
  staff_id: string;
  claimed_at: string | null;
  staff:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignment_type: TaskAssignmentType;
  created_by_staff_id: string;
  due_at: string | null;
  priority: TaskPriority;
  completed_at: string | null;
  completed_by_staff_id: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  completed_by:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  task_assignees: TaskAssigneeRow[] | null;
};

export const TASK_SELECT = `
  id,
  title,
  description,
  status,
  assignment_type,
  created_by_staff_id,
  due_at,
  priority,
  completed_at,
  completed_by_staff_id,
  completion_notes,
  created_at,
  updated_at,
  created_by:staff!tasks_created_by_staff_id_fkey ( id, name ),
  completed_by:staff!tasks_completed_by_staff_id_fkey ( id, name ),
  task_assignees (
    staff_id,
    claimed_at,
    staff ( id, name )
  )
`;

function relOne<T extends { id: string; name: string }>(
  value: T | T[] | null | undefined,
) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function mapAssignee(row: TaskAssigneeRow) {
  const staff = relOne(row.staff);
  return {
    staffId: row.staff_id,
    staffName: staff?.name ?? "Unknown",
    claimedAt: row.claimed_at,
  };
}

export function mapTask(row: TaskRow, currentStaffId?: string) {
  const assignees = (row.task_assignees ?? []).map(mapAssignee);
  const isAssignee = assignees.some((a) => a.staffId === currentStaffId);
  const createdBy = relOne(row.created_by);
  const completedBy = relOne(row.completed_by);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assignmentType: row.assignment_type,
    createdByStaffId: row.created_by_staff_id,
    createdByName: createdBy?.name ?? null,
    dueAt: row.due_at,
    priority: row.priority,
    completedAt: row.completed_at,
    completedByStaffId: row.completed_by_staff_id,
    completedByName: completedBy?.name ?? null,
    completionNotes: row.completion_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignees,
    isAssignee,
    isOpenPool: row.assignment_type === "open",
    canClaim:
      row.assignment_type === "open" &&
      row.status === "open" &&
      !isAssignee,
    canComplete:
      row.status !== "done" &&
      row.status !== "cancelled" &&
      isAssignee,
  };
}

export function requireManager(staff: StaffProfile) {
  return isSalonManager(staff);
}

export function parsePriority(value: unknown): TaskPriority | { error: string } {
  const priority = String(value ?? "normal").trim() as TaskPriority;
  if (!["low", "normal", "high"].includes(priority)) {
    return { error: "Invalid priority" };
  }
  return priority;
}

export function parseAssignmentType(
  value: unknown,
): TaskAssignmentType | { error: string } {
  const type = String(value ?? "").trim() as TaskAssignmentType;
  if (type !== "assigned" && type !== "open") {
    return { error: "Invalid assignment type" };
  }
  return type;
}

export function parseDueAt(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const raw = String(value).trim();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { error: "Invalid due date" };
  }
  return date.toISOString();
}

export function isStaffAssignee(
  task: TaskRow | null | undefined,
  staffId: string,
) {
  return (task?.task_assignees ?? []).some((row) => row.staff_id === staffId);
}

/** Tasks due within this window (or already overdue) need attention. */
export const TASK_ATTENTION_HOURS = 24;

export function isTaskNeedsAttention(
  dueAt: string | null,
  status: TaskStatus,
): boolean {
  if (status === "done" || status === "cancelled" || !dueAt) {
    return false;
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const threshold = Date.now() + TASK_ATTENTION_HOURS * 60 * 60 * 1000;
  return due.getTime() <= threshold;
}

export async function countOpenPoolTasks(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("assignment_type", "open")
    .eq("status", "open");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function countAttentionTasks(
  supabase: SupabaseClient,
  staffId: string,
  manager: boolean,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, due_at, status, assignment_type, task_assignees(staff_id)")
    .in("status", ["open", "claimed"])
    .not("due_at", "is", null);

  if (error) {
    throw error;
  }

  return (data ?? []).filter((row) => {
    if (!isTaskNeedsAttention(row.due_at, row.status as TaskStatus)) {
      return false;
    }
    if (manager) return true;
    if (row.assignment_type === "open") return true;
    const assignees = (row.task_assignees ?? []) as Array<{ staff_id: string }>;
    return assignees.some((a) => a.staff_id === staffId);
  }).length;
}

async function loadAssigneeTaskIds(
  supabase: SupabaseClient,
  staffId: string,
) {
  const { data, error } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("staff_id", staffId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.task_id as string);
}

function salonWeekStartUtc(now = new Date()) {
  const today = salonLocalDate(now);
  const sunday = addDays(today, -dayOfWeek(today));
  return localWallClockToUtc(sunday, "00:00").toISOString();
}

function salonDayBoundsUtc(now = new Date()) {
  const today = salonLocalDate(now);
  return {
    start: localWallClockToUtc(today, "00:00").toISOString(),
    end: localWallClockToUtc(addDays(today, 1), "00:00").toISOString(),
  };
}

function isDueTodaySalon(dueAt: string | null, now = new Date()) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return salonLocalDate(due) === salonLocalDate(now);
}

export type TaskSummaryCounts = {
  assignedToMe: number;
  openToEveryone: number;
  needsAttention: number;
  dueToday: number;
  completedThisWeek: number;
};

export type TaskPanelPreview = {
  id: string;
  title: string;
  dueAt: string | null;
  status: TaskStatus;
  assignmentType: TaskAssignmentType;
  priority: TaskPriority;
};

export type TaskActivityItem = {
  id: string;
  title: string;
  kind: "completed" | "claimed" | "created";
  at: string;
  byName: string | null;
};

export type TaskChecklistProgress = {
  active: number;
  completedThisWeek: number;
};

export type TaskSummaryPayload = {
  counts: TaskSummaryCounts;
  dueSoon: TaskPanelPreview[];
  openToClaim: TaskPanelPreview[];
  checklistProgress: TaskChecklistProgress;
  recentActivity: TaskActivityItem[];
};

const PANEL_PREVIEW_SELECT = `
  id,
  title,
  due_at,
  status,
  assignment_type,
  priority,
  completed_at,
  updated_at,
  created_at,
  created_by:staff!tasks_created_by_staff_id_fkey ( id, name ),
  completed_by:staff!tasks_completed_by_staff_id_fkey ( id, name ),
  task_assignees (
    staff_id,
    claimed_at,
    staff ( id, name )
  )
`;

function toPanelPreview(row: TaskRow): TaskPanelPreview {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    status: row.status,
    assignmentType: row.assignment_type,
    priority: row.priority,
  };
}

function relOneName(
  value: { name: string } | { name: string }[] | null | undefined,
) {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? null;
}

export async function loadTaskSummary(
  supabase: SupabaseClient,
  staffId: string,
  manager: boolean,
): Promise<TaskSummaryPayload> {
  const weekStart = salonWeekStartUtc();
  const { start: todayStart, end: todayEnd } = salonDayBoundsUtc();
  const dueSoonEnd = localWallClockToUtc(addDays(salonLocalDate(), 7), "00:00").toISOString();

  const assigneeTaskIds = await loadAssigneeTaskIds(supabase, staffId);

  const [
    openPoolCount,
    attentionCount,
    assignedRows,
    dueTodayRows,
    completedWeekCount,
    activeCount,
    dueSoonResult,
    openPoolResult,
    recentDoneResult,
    recentUpdatedResult,
  ] = await Promise.all([
    countOpenPoolTasks(supabase),
    countAttentionTasks(supabase, staffId, manager),
    assigneeTaskIds.length > 0
      ? supabase
          .from("tasks")
          .select("id")
          .in("id", assigneeTaskIds)
          .in("status", ["open", "claimed"])
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("tasks")
      .select("id, due_at, status, assignment_type, task_assignees(staff_id)")
      .in("status", ["open", "claimed"])
      .not("due_at", "is", null)
      .gte("due_at", todayStart)
      .lt("due_at", todayEnd),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "done")
      .gte("completed_at", weekStart),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "claimed"]),
    supabase
      .from("tasks")
      .select(PANEL_PREVIEW_SELECT)
      .in("status", ["open", "claimed"])
      .not("due_at", "is", null)
      .gte("due_at", todayStart)
      .lte("due_at", dueSoonEnd)
      .order("due_at", { ascending: true })
      .limit(6),
    supabase
      .from("tasks")
      .select(PANEL_PREVIEW_SELECT)
      .eq("assignment_type", "open")
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("tasks")
      .select(PANEL_PREVIEW_SELECT)
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .limit(8),
    supabase
      .from("tasks")
      .select(PANEL_PREVIEW_SELECT)
      .in("status", ["open", "claimed"])
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  if (assignedRows.error) throw assignedRows.error;
  if (dueTodayRows.error) throw dueTodayRows.error;
  if (dueSoonResult.error) throw dueSoonResult.error;
  if (openPoolResult.error) throw openPoolResult.error;
  if (recentDoneResult.error) throw recentDoneResult.error;
  if (recentUpdatedResult.error) throw recentUpdatedResult.error;

  const dueTodayFiltered = (dueTodayRows.data ?? []).filter((row) => {
    if (!isDueTodaySalon(row.due_at)) return false;
    if (manager) return true;
    if (row.assignment_type === "open") return true;
    const assignees = (row.task_assignees ?? []) as Array<{ staff_id: string }>;
    return assignees.some((a) => a.staff_id === staffId);
  });

  let dueSoon = (dueSoonResult.data ?? []).map((row) => toPanelPreview(row as TaskRow));
  if (!manager) {
    dueSoon = dueSoon.filter((task) => {
      const row = (dueSoonResult.data ?? []).find((item) => item.id === task.id) as TaskRow | undefined;
      if (!row) return false;
      if (row.assignment_type === "open") return true;
      return (row.task_assignees ?? []).some((a) => a.staff_id === staffId);
    });
  }

  const recentActivity: TaskActivityItem[] = [];

  for (const row of recentDoneResult.data ?? []) {
    const task = row as TaskRow;
    if (!task.completed_at) continue;
    recentActivity.push({
      id: task.id,
      title: task.title,
      kind: "completed",
      at: task.completed_at,
      byName: relOneName(task.completed_by),
    });
  }

  for (const row of recentUpdatedResult.data ?? []) {
    const task = row as TaskRow;
    const claimer = (task.task_assignees ?? []).find((a) => a.claimed_at);
    if (claimer?.claimed_at) {
      recentActivity.push({
        id: task.id,
        title: task.title,
        kind: "claimed",
        at: claimer.claimed_at,
        byName: relOneName(claimer.staff),
      });
      continue;
    }
    if (task.created_at) {
      recentActivity.push({
        id: task.id,
        title: task.title,
        kind: "created",
        at: task.created_at,
        byName: relOneName(task.created_by),
      });
    }
  }

  recentActivity.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return {
    counts: {
      assignedToMe: assignedRows.data?.length ?? 0,
      openToEveryone: openPoolCount,
      needsAttention: attentionCount,
      dueToday: dueTodayFiltered.length,
      completedThisWeek: completedWeekCount.count ?? 0,
    },
    dueSoon: dueSoon.slice(0, 5),
    openToClaim: (openPoolResult.data ?? [])
      .map((row) => toPanelPreview(row as TaskRow))
      .slice(0, 5),
    checklistProgress: {
      active: activeCount.count ?? 0,
      completedThisWeek: completedWeekCount.count ?? 0,
    },
    recentActivity: recentActivity.slice(0, 6),
  };
}
