import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  isStaffAssignee,
  mapTask,
  parseAssignmentType,
  parseDueAt,
  parsePriority,
  requireManager,
  TASK_SELECT,
  type TaskRow,
} from "../../../lib/api-tasks";

type PatchTaskBody = {
  title?: string;
  description?: string | null;
  due_at?: string | null;
  priority?: string;
  assignment_type?: string;
  assignee_ids?: string[];
  status?: string;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const taskId = context.params.id;
  if (!taskId) {
    return jsonError("Missing task id", 400);
  }

  const { supabase, staff } = auth;
  const manager = requireManager(staff);

  const { data: existing, error: loadError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Task not found", 404);
  }

  let body: PatchTaskBody;
  try {
    body = (await context.request.json()) as PatchTaskBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!manager) {
    return jsonError("Forbidden", 403);
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return jsonError("Title is required", 400);
    }
    updates.title = title;
  }

  if (body.description !== undefined) {
    updates.description = String(body.description ?? "").trim() || null;
  }

  if (body.priority !== undefined) {
    const priority = parsePriority(body.priority);
    if (typeof priority === "object" && "error" in priority) {
      return jsonError(priority.error, 400);
    }
    updates.priority = priority;
  }

  if (body.due_at !== undefined) {
    const dueAt = parseDueAt(body.due_at);
    if (typeof dueAt === "object" && dueAt !== null && "error" in dueAt) {
      return jsonError(dueAt.error, 400);
    }
    updates.due_at = dueAt;
  }

  if (body.status !== undefined) {
    const status = String(body.status).trim();
    if (!["open", "claimed", "done", "cancelled"].includes(status)) {
      return jsonError("Invalid status", 400);
    }
    updates.status = status;
    if (status === "cancelled") {
      updates.completed_at = null;
      updates.completed_by_staff_id = null;
      updates.completion_notes = null;
    }
  }

  let assignmentType = existing.assignment_type;
  if (body.assignment_type !== undefined) {
    const parsed = parseAssignmentType(body.assignment_type);
    if (typeof parsed === "object" && "error" in parsed) {
      return jsonError(parsed.error, 400);
    }
    assignmentType = parsed;
    updates.assignment_type = parsed;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (updateError) {
      console.error("task update failed", updateError);
      return jsonError("Failed to update task", 500);
    }
  }

  if (body.assignee_ids !== undefined) {
    if (assignmentType === "open") {
      const { error: clearError } = await supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", taskId);

      if (clearError) {
        console.error("task assignees clear failed", clearError);
        return jsonError("Failed to update assignees", 500);
      }
    } else {
      const assigneeIds = [...new Set(body.assignee_ids.map(String).filter(Boolean))];
      if (assigneeIds.length === 0) {
        return jsonError("Select at least one team member", 400);
      }

      const { error: clearError } = await supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", taskId);

      if (clearError) {
        console.error("task assignees clear failed", clearError);
        return jsonError("Failed to update assignees", 500);
      }

      const { error: insertError } = await supabase.from("task_assignees").insert(
        assigneeIds.map((staffId) => ({
          task_id: taskId,
          staff_id: staffId,
        })),
      );

      if (insertError) {
        console.error("task assignees insert failed", insertError);
        return jsonError("Failed to update assignees", 500);
      }
    }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (refreshError || !refreshed) {
    return jsonOk({ id: taskId });
  }

  return jsonOk({ task: mapTask(refreshed as TaskRow, staff.id) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const taskId = context.params.id;
  if (!taskId) {
    return jsonError("Missing task id", 400);
  }

  const { supabase } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", taskId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Task not found", 404);
  }

  const cancel = context.url.searchParams.get("cancel") === "1";

  if (cancel && existing.status !== "cancelled") {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "cancelled" })
      .eq("id", taskId);

    if (error) {
      console.error("task cancel failed", error);
      return jsonError("Failed to cancel task", 500);
    }

    return jsonOk({ id: taskId, cancelled: true });
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    console.error("task delete failed", error);
    return jsonError("Failed to delete task", 500);
  }

  return jsonOk({ id: taskId, deleted: true });
};
