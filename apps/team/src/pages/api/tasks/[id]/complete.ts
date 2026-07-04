import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import {
  isStaffAssignee,
  mapTask,
  TASK_SELECT,
  type TaskRow,
} from "../../../../lib/api-tasks";

type CompleteTaskBody = {
  completion_notes?: string;
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const taskId = context.params.id;
  if (!taskId) {
    return jsonError("Missing task id", 400);
  }

  let body: CompleteTaskBody = {};
  try {
    const raw = await context.request.text();
    if (raw.trim()) {
      body = JSON.parse(raw) as CompleteTaskBody;
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { supabase, staff } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Task not found", 404);
  }

  const task = existing as TaskRow;

  if (task.status === "done" || task.status === "cancelled") {
    return jsonError("Task is already closed", 400);
  }

  if (!isStaffAssignee(task, staff.id)) {
    return jsonError("You are not assigned to this task", 403);
  }

  const completionNotes = String(body.completion_notes ?? "").trim() || null;
  const completedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "done",
      completed_at: completedAt,
      completed_by_staff_id: staff.id,
      completion_notes: completionNotes,
    })
    .eq("id", taskId);

  if (updateError) {
    console.error("task complete failed", updateError);
    return jsonError("Failed to complete task", 500);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (refreshError || !refreshed) {
    return jsonOk({ id: taskId, completed: true });
  }

  return jsonOk({ task: mapTask(refreshed as TaskRow, staff.id) });
};
