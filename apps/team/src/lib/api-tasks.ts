import { isSalonManager } from "./auth";
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
